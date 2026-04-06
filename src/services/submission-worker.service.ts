import { env } from '../config/env';
import {
  claimSubmissionJobs,
  markSubmissionJobCompleted,
  markSubmissionJobFailed,
  resetRunningSubmissionJobs,
  SubmissionJobPayload,
  SubmissionJobRow,
} from '../models/submission-job.model';
import {
  Judge0HttpError,
  Judge0QueueFullError,
  Judge0ResultTimeoutError,
  Judge0TimeoutError,
  submitAndWaitForResult,
} from './judge0.service';

const WORKER_ENABLED = env.judge0WorkerEnabled ?? true;
const WORKER_CONCURRENCY = Math.floor(env.judge0WorkerConcurrency ?? 35);
const WORKER_BATCH_SIZE = Math.floor(env.judge0WorkerBatchSize ?? 20);
const WORKER_POLL_INTERVAL_MS = Math.floor(env.judge0WorkerPollIntervalMs ?? 500);
const WORKER_MAX_ATTEMPTS = Math.floor(env.judge0WorkerMaxAttempts ?? 3);
const WORKER_RETRY_DELAY_MS = Math.floor(env.judge0WorkerRetryDelayMs ?? 2500);

let started = false;
let loopInProgress = false;
let inFlight = 0;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isSubmissionPayload(payload: unknown): payload is SubmissionJobPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as SubmissionJobPayload;

  if (typeof candidate.source_code !== 'string' || candidate.source_code.trim().length === 0) {
    return false;
  }

  if (!Number.isInteger(candidate.language_id)) {
    return false;
  }

  if (candidate.stdin !== undefined && typeof candidate.stdin !== 'string') {
    return false;
  }

  if (candidate.expected_output !== undefined && typeof candidate.expected_output !== 'string') {
    return false;
  }

  if (candidate.cpu_time_limit !== undefined && typeof candidate.cpu_time_limit !== 'number') {
    return false;
  }

  if (candidate.memory_limit !== undefined && typeof candidate.memory_limit !== 'number') {
    return false;
  }

  return true;
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof Judge0QueueFullError) {
    return true;
  }

  if (error instanceof Judge0TimeoutError || error instanceof Judge0ResultTimeoutError) {
    return true;
  }

  if (error instanceof Judge0HttpError) {
    return error.status >= 500;
  }

  return false;
}

async function processJob(job: SubmissionJobRow): Promise<void> {
  const jobTrace = `[SubmissionWorker] job=${job.id} attempt=${job.attempt_count}/${job.max_attempts}`;

  if (!isSubmissionPayload(job.payload)) {
    await markSubmissionJobFailed(job.id, 'Invalid submission payload', null);
    console.warn(`${jobTrace} invalid payload; marked failed`);
    return;
  }

  try {
    const result = await submitAndWaitForResult(job.payload);
    await markSubmissionJobCompleted(job.id, result);
    console.info(`${jobTrace} completed`);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const cappedMaxAttempts = Math.max(1, Math.min(job.max_attempts, WORKER_MAX_ATTEMPTS));
    const canRetry = shouldRetry(error) && job.attempt_count < cappedMaxAttempts;

    if (canRetry) {
      const delayMs = WORKER_RETRY_DELAY_MS * job.attempt_count;
      const retryAt = new Date(Date.now() + delayMs);
      await markSubmissionJobFailed(job.id, errorMessage, retryAt);
      console.warn(`${jobTrace} failed; requeued in ${delayMs}ms`);
      return;
    }

    await markSubmissionJobFailed(job.id, errorMessage, null);
    console.error(`${jobTrace} failed permanently: ${errorMessage}`);
  }
}

async function tick(): Promise<void> {
  if (loopInProgress) {
    return;
  }

  if (inFlight >= WORKER_CONCURRENCY) {
    return;
  }

  loopInProgress = true;

  try {
    const capacity = Math.max(0, WORKER_CONCURRENCY - inFlight);

    if (capacity === 0) {
      return;
    }

    const jobs = await claimSubmissionJobs(Math.min(WORKER_BATCH_SIZE, capacity));

    if (jobs.length === 0) {
      return;
    }

    for (const job of jobs) {
      inFlight += 1;

      void processJob(job).finally(() => {
        inFlight -= 1;
      });
    }
  } catch (error) {
    console.error('[SubmissionWorker] tick failed', error);
  } finally {
    loopInProgress = false;
  }
}

export async function startSubmissionWorker(): Promise<void> {
  if (!WORKER_ENABLED) {
    console.info('[SubmissionWorker] disabled by configuration');
    return;
  }

  if (started) {
    return;
  }

  started = true;

  const requeued = await resetRunningSubmissionJobs();
  if (requeued > 0) {
    console.warn(`[SubmissionWorker] requeued ${requeued} stale running jobs`);
  }

  console.info(
    `[SubmissionWorker] started with concurrency=${WORKER_CONCURRENCY} batchSize=${WORKER_BATCH_SIZE} pollIntervalMs=${WORKER_POLL_INTERVAL_MS}`
  );

  await tick();

  setInterval(() => {
    void tick();
  }, WORKER_POLL_INTERVAL_MS);
}
