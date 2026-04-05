import { env } from '../config/env';

type Judge0SubmissionRequest = {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
};

type Judge0Status = {
  id: number;
  description: string;
};

export type Judge0SubmissionResult = {
  token: string;
  status: Judge0Status;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  memory: number | null;
  exit_code: number | null;
};

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 25;

function toBase64(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Buffer.from(value, 'utf8').toString('base64');
}

function fromBase64(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return value;
  }
}

function buildBaseUrl(): string {
  return env.judgeZeroGcp.replace(/\/+$/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseJsonOrThrow(response: Response): Promise<any> {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Judge0 request failed with ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Judge0 returned non-JSON response');
  }
}

export async function submitAndWaitForResult(
  payload: Judge0SubmissionRequest
): Promise<Judge0SubmissionResult> {
  const baseUrl = buildBaseUrl();
  const submitUrl = `${baseUrl}/submissions?base64_encoded=true&wait=false`;

  const encodedPayload = {
    ...payload,
    source_code: toBase64(payload.source_code) as string,
    stdin: toBase64(payload.stdin),
    expected_output: toBase64(payload.expected_output),
  };

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(encodedPayload),
  });

  const submitData = await parseJsonOrThrow(submitResponse);
  const token = submitData?.token as string | undefined;

  if (!token) {
    throw new Error('Judge0 did not return a submission token');
  }

  const resultUrl = `${baseUrl}/submissions/${token}?base64_encoded=true&fields=token,status,stdout,stderr,compile_output,message,time,memory,exit_code`;

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    const resultResponse = await fetch(resultUrl);
    const resultData = (await parseJsonOrThrow(resultResponse)) as Judge0SubmissionResult;
    resultData.stdout = fromBase64(resultData.stdout);
    resultData.stderr = fromBase64(resultData.stderr);
    resultData.compile_output = fromBase64(resultData.compile_output);
    resultData.message = fromBase64(resultData.message);

    if (resultData?.status?.id && resultData.status.id > 2) {
      return resultData;
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new Error('Timed out while waiting for Judge0 execution result');
}
