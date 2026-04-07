#!/usr/bin/env python3
"""Ramps concurrent submissions across multiple Judge0 nodes and reports max stable load.

This script sends code directly to Judge0 nodes (round-robin), polls each token on the
same node, and measures stability per concurrency stage.
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import json
import math
import os
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

HELLO_WORLD_CPP = """#include <iostream>
int main() {
  std::cout << \"Hello, World!\" << std::endl;
  return 0;
}
"""


@dataclass
class SubmissionResult:
    ok: bool
    node: str
    duration_s: float
    status_id: int | None = None
    status_description: str | None = None
    fail_reason: str | None = None


def parse_nodes(raw_nodes: str) -> List[str]:
    nodes = [node.strip().rstrip("/") for node in raw_nodes.split(",") if node.strip()]
    if not nodes:
        raise ValueError("No Judge0 nodes provided. Use --nodes or set JUDGE_ZERO_NODES")
    return nodes


def b64(value: str | None) -> str | None:
    if value is None:
        return None
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def http_json_request(url: str, method: str = "GET", body: Dict[str, Any] | None = None, timeout_s: float = 30.0) -> Dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")

    request = urllib.request.Request(url=url, data=payload, headers=headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            content = response.read().decode("utf-8")
            if not content:
                return {}
            return json.loads(content)
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body_text}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"URL error: {exc.reason}") from exc


def submit_and_poll_single(
    node: str,
    language_id: int,
    source_code: str,
    stdin: str | None,
    expected_output: str | None,
    submit_timeout_s: float,
    poll_timeout_s: float,
    poll_interval_s: float,
) -> SubmissionResult:
    started = time.perf_counter()

    try:
        submit_url = f"{node}/submissions?base64_encoded=true&wait=false"
        submit_payload = {
            "source_code": b64(source_code),
            "language_id": language_id,
            "stdin": b64(stdin),
            "expected_output": b64(expected_output),
        }

        submit_data = http_json_request(
            url=submit_url,
            method="POST",
            body=submit_payload,
            timeout_s=submit_timeout_s,
        )

        token = submit_data.get("token")
        if not token:
            return SubmissionResult(
                ok=False,
                node=node,
                duration_s=time.perf_counter() - started,
                fail_reason="missing_token",
            )

        fields = "token,status,stdout,stderr,compile_output,message,time,memory,exit_code"
        result_url = f"{node}/submissions/{token}?base64_encoded=true&fields={urllib.parse.quote(fields)}"

        max_attempts = max(1, int(math.ceil(poll_timeout_s / poll_interval_s)))
        for _ in range(max_attempts):
            try:
                result_data = http_json_request(url=result_url, timeout_s=submit_timeout_s)
            except RuntimeError as exc:
                text = str(exc).lower()
                if "http 404" in text:
                    time.sleep(poll_interval_s)
                    continue
                if "queue is full" in text:
                    return SubmissionResult(
                        ok=False,
                        node=node,
                        duration_s=time.perf_counter() - started,
                        fail_reason="queue_full",
                    )
                return SubmissionResult(
                    ok=False,
                    node=node,
                    duration_s=time.perf_counter() - started,
                    fail_reason="poll_http_error",
                )

            status = result_data.get("status") or {}
            status_id = status.get("id")
            status_description = status.get("description")

            if isinstance(status_id, int) and status_id > 2:
                return SubmissionResult(
                    ok=True,
                    node=node,
                    duration_s=time.perf_counter() - started,
                    status_id=status_id,
                    status_description=status_description,
                )

            time.sleep(poll_interval_s)

        return SubmissionResult(
            ok=False,
            node=node,
            duration_s=time.perf_counter() - started,
            fail_reason="poll_timeout",
        )
    except RuntimeError as exc:
        text = str(exc).lower()
        if "queue is full" in text:
            reason = "queue_full"
        elif "timed out" in text:
            reason = "submit_timeout"
        elif "http" in text:
            reason = "submit_http_error"
        else:
            reason = "submit_network_error"

        return SubmissionResult(
            ok=False,
            node=node,
            duration_s=time.perf_counter() - started,
            fail_reason=reason,
        )


def percentile(data: List[float], p: float) -> float:
    if not data:
        return 0.0
    if len(data) == 1:
        return data[0]
    ordered = sorted(data)
    idx = int(math.ceil((p / 100.0) * len(ordered))) - 1
    idx = max(0, min(idx, len(ordered) - 1))
    return ordered[idx]


def run_stage(
    nodes: List[str],
    concurrency: int,
    requests_count: int,
    language_id: int,
    source_code: str,
    submit_timeout_s: float,
    poll_timeout_s: float,
    poll_interval_s: float,
) -> Tuple[List[SubmissionResult], float]:
    stage_started = time.perf_counter()
    futures: List[concurrent.futures.Future[SubmissionResult]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        for i in range(requests_count):
            node = nodes[i % len(nodes)]
            futures.append(
                executor.submit(
                    submit_and_poll_single,
                    node,
                    language_id,
                    source_code,
                    None,
                    None,
                    submit_timeout_s,
                    poll_timeout_s,
                    poll_interval_s,
                )
            )

    results = [future.result() for future in futures]
    stage_duration = time.perf_counter() - stage_started
    return results, stage_duration


def summarize_stage(concurrency: int, requests_count: int, results: List[SubmissionResult], stage_duration: float) -> Dict[str, Any]:
    success = [r for r in results if r.ok]
    failed = [r for r in results if not r.ok]

    success_rate = (len(success) / len(results)) * 100 if results else 0.0
    latencies = [r.duration_s for r in success]
    fail_reasons = Counter(r.fail_reason for r in failed if r.fail_reason)
    node_success = Counter(r.node for r in success)
    node_fail = Counter(r.node for r in failed)

    summary = {
        "concurrency": concurrency,
        "requests": requests_count,
        "success": len(success),
        "failed": len(failed),
        "success_rate": success_rate,
        "stage_duration_s": stage_duration,
        "throughput_rps": (len(results) / stage_duration) if stage_duration > 0 else 0.0,
        "p50_s": percentile(latencies, 50),
        "p95_s": percentile(latencies, 95),
        "p99_s": percentile(latencies, 99),
        "avg_s": statistics.mean(latencies) if latencies else 0.0,
        "fail_reasons": dict(fail_reasons),
        "node_success": dict(node_success),
        "node_fail": dict(node_fail),
    }
    return summary


def print_stage_summary(summary: Dict[str, Any]) -> None:
    print("\n" + "=" * 84)
    print(
        f"Concurrency={summary['concurrency']} | Requests={summary['requests']} | "
        f"Success={summary['success']} | Failed={summary['failed']} | "
        f"SuccessRate={summary['success_rate']:.2f}%"
    )
    print(
        f"StageTime={summary['stage_duration_s']:.2f}s | Throughput={summary['throughput_rps']:.2f} req/s | "
        f"Avg={summary['avg_s']:.2f}s | P50={summary['p50_s']:.2f}s | "
        f"P95={summary['p95_s']:.2f}s | P99={summary['p99_s']:.2f}s"
    )
    print(f"Node success counts: {summary['node_success']}")
    print(f"Node fail counts: {summary['node_fail']}")
    print(f"Failure reasons: {summary['fail_reasons']}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find max stable concurrent load across multiple Judge0 instances"
    )
    parser.add_argument(
        "--nodes",
        default=os.getenv("JUDGE_ZERO_NODES", ""),
        help="Comma-separated Judge0 node URLs, e.g. http://1.2.3.4:2358,http://5.6.7.8:2358",
    )
    parser.add_argument("--start-concurrency", type=int, default=20)
    parser.add_argument("--step", type=int, default=20)
    parser.add_argument("--max-concurrency", type=int, default=300)
    parser.add_argument(
        "--requests-per-stage",
        type=int,
        default=0,
        help="If 0, uses concurrency * 3",
    )
    parser.add_argument("--pass-rate-threshold", type=float, default=98.0)
    parser.add_argument("--language-id", type=int, default=54)
    parser.add_argument("--submit-timeout", type=float, default=30.0)
    parser.add_argument("--poll-timeout", type=float, default=90.0)
    parser.add_argument("--poll-interval", type=float, default=1.0)

    args = parser.parse_args()

    nodes = parse_nodes(args.nodes)

    print("Judge0 max concurrency ramp test")
    print(f"Nodes: {nodes}")
    print(
        f"Ramp: start={args.start_concurrency}, step={args.step}, max={args.max_concurrency}, "
        f"pass-threshold={args.pass_rate_threshold}%"
    )

    best_summary: Dict[str, Any] | None = None
    first_failed_summary: Dict[str, Any] | None = None

    concurrency = args.start_concurrency
    while concurrency <= args.max_concurrency:
        requests_count = args.requests_per_stage if args.requests_per_stage > 0 else concurrency * 3

        results, stage_duration = run_stage(
            nodes=nodes,
            concurrency=concurrency,
            requests_count=requests_count,
            language_id=args.language_id,
            source_code=HELLO_WORLD_CPP,
            submit_timeout_s=args.submit_timeout,
            poll_timeout_s=args.poll_timeout,
            poll_interval_s=args.poll_interval,
        )

        summary = summarize_stage(
            concurrency=concurrency,
            requests_count=requests_count,
            results=results,
            stage_duration=stage_duration,
        )
        print_stage_summary(summary)

        if summary["success_rate"] >= args.pass_rate_threshold:
            best_summary = summary
            concurrency += args.step
            continue

        first_failed_summary = summary
        break

    print("\n" + "#" * 84)
    if best_summary is None:
        print("No stage met the pass threshold. Start with lower concurrency.")
    else:
        print(
            f"Max stable concurrency: {best_summary['concurrency']} "
            f"(success rate {best_summary['success_rate']:.2f}%)"
        )

    if first_failed_summary is not None:
        print(
            f"First failing stage: {first_failed_summary['concurrency']} "
            f"(success rate {first_failed_summary['success_rate']:.2f}%)"
        )


if __name__ == "__main__":
    main()
