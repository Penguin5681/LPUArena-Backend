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
const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

let nextNodeIndex = 0;

class Judge0HttpError extends Error {
  status: number;
  url: string;

  constructor(status: number, body: string, url: string) {
    super(`Judge0 request failed with ${status}: ${body}`);
    this.name = 'Judge0HttpError';
    this.status = status;
    this.url = url;
  }
}

class Judge0TimeoutError extends Error {
  url: string;

  constructor(url: string, timeoutMs: number) {
    super(`Judge0 request timed out after ${timeoutMs}ms for ${url}`);
    this.name = 'Judge0TimeoutError';
    this.url = url;
  }
}

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

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function getBaseUrls(): string[] {
  const nodeUrls = env.judgeZeroNodes?.map(normalizeBaseUrl) ?? [];

  if (nodeUrls.length > 0) {
    return nodeUrls;
  }

  return [normalizeBaseUrl(env.judgeZeroGcp)];
}

function getSubmitCandidates(): string[] {
  const baseUrls = getBaseUrls();

  if (baseUrls.length === 1) {
    return baseUrls;
  }

  // Simple process-local round robin to distribute submissions across Judge0 nodes.
  const startIndex = nextNodeIndex % baseUrls.length;
  nextNodeIndex = (nextNodeIndex + 1) % baseUrls.length;

  return [...baseUrls.slice(startIndex), ...baseUrls.slice(0, startIndex)];
}

function getPollCandidates(primaryBaseUrl: string, fallbackBaseUrls: string[]): string[] {
  return [primaryBaseUrl, ...fallbackBaseUrls.filter((baseUrl) => baseUrl !== primaryBaseUrl)];
}

function isRetryableSubmitError(error: unknown): boolean {
  if (error instanceof Judge0TimeoutError) {
    return true;
  }

  if (error instanceof Judge0HttpError) {
    return RETRYABLE_HTTP_STATUSES.has(error.status);
  }

  return true;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Judge0TimeoutError(url, REQUEST_TIMEOUT_MS);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonOrThrow(response: Response, url: string): Promise<any> {
  const text = await response.text();

  if (!response.ok) {
    throw new Judge0HttpError(response.status, text, url);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Judge0 returned non-JSON response for ${url}`);
  }
}

function decodeSubmissionResult(resultData: Judge0SubmissionResult): Judge0SubmissionResult {
  resultData.stdout = fromBase64(resultData.stdout);
  resultData.stderr = fromBase64(resultData.stderr);
  resultData.compile_output = fromBase64(resultData.compile_output);
  resultData.message = fromBase64(resultData.message);

  return resultData;
}

async function submitToNode(baseUrl: string, encodedPayload: Judge0SubmissionRequest): Promise<string> {
  const submitUrl = `${baseUrl}/submissions?base64_encoded=true&wait=false`;
  const submitResponse = await fetchWithTimeout(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(encodedPayload),
  });

  const submitData = await parseJsonOrThrow(submitResponse, submitUrl);
  const token = submitData?.token as string | undefined;

  if (!token) {
    throw new Error(`Judge0 did not return a submission token for ${submitUrl}`);
  }

  return token;
}

async function pollForResult(
  token: string,
  primaryBaseUrl: string,
  fallbackBaseUrls: string[]
): Promise<Judge0SubmissionResult> {
  const pollCandidates = getPollCandidates(primaryBaseUrl, fallbackBaseUrls);
  let lastErrorMessage = '';

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    let sawInProgressResult = false;

    for (const baseUrl of pollCandidates) {
      const resultUrl = `${baseUrl}/submissions/${token}?base64_encoded=true&fields=token,status,stdout,stderr,compile_output,message,time,memory,exit_code`;

      try {
        const resultResponse = await fetchWithTimeout(resultUrl);
        const resultData = decodeSubmissionResult(
          (await parseJsonOrThrow(resultResponse, resultUrl)) as Judge0SubmissionResult
        );

        if (resultData?.status?.id && resultData.status.id > 2) {
          return resultData;
        }

        sawInProgressResult = true;
        break;
      } catch (error) {
        if (error instanceof Judge0HttpError && error.status === 404) {
          lastErrorMessage = `${baseUrl}: token not found yet`;
          continue;
        }

        lastErrorMessage = `${baseUrl}: ${toErrorMessage(error)}`;
      }
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }

    if (sawInProgressResult) {
      continue;
    }
  }

  if (lastErrorMessage) {
    throw new Error(`Timed out while waiting for Judge0 result. Last error: ${lastErrorMessage}`);
  }

  throw new Error('Timed out while waiting for Judge0 execution result');
}

export async function submitAndWaitForResult(
  payload: Judge0SubmissionRequest
): Promise<Judge0SubmissionResult> {
  const submitCandidates = getSubmitCandidates();

  const encodedPayload = {
    ...payload,
    source_code: toBase64(payload.source_code) as string,
    stdin: toBase64(payload.stdin),
    expected_output: toBase64(payload.expected_output),
  };

  const submitErrors: string[] = [];

  for (const baseUrl of submitCandidates) {
    try {
      const token = await submitToNode(baseUrl, encodedPayload);
      return await pollForResult(token, baseUrl, submitCandidates);
    } catch (error) {
      submitErrors.push(`${baseUrl}: ${toErrorMessage(error)}`);

      if (!isRetryableSubmitError(error)) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to submit to all Judge0 nodes. ${submitErrors.join(' | ')}`);
}
