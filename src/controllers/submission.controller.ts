import { Request, Response } from 'express';
import { env } from '../config/env';
import { createSubmissionJob, getSubmissionJobById } from '../models/submission-job.model';

const DEFAULT_MAX_ATTEMPTS = Math.floor(env.judge0WorkerMaxAttempts ?? 3);

export async function submitCode(req: Request, res: Response): Promise<void> {

  const {
    source_code,
    language_id,
    stdin,
    expected_output,
    cpu_time_limit,
    memory_limit,
  } = req.body;

  if (typeof source_code !== 'string' || source_code.trim().length === 0) {
    res.status(400).json({ message: 'source_code is required and must be a non-empty string' });
    return;
  }

  if (!Number.isInteger(language_id)) {
    res.status(400).json({ message: 'language_id is required and must be an integer' });
    return;
  }

  const payload = {
    source_code,
    language_id,
    stdin: typeof stdin === 'string' ? stdin : undefined,
    expected_output: typeof expected_output === 'string' ? expected_output : undefined,
    cpu_time_limit: typeof cpu_time_limit === 'number' ? cpu_time_limit : undefined,
    memory_limit: typeof memory_limit === 'number' ? memory_limit : undefined,
  };

  const job = await createSubmissionJob({
    userId: req.user?.userId ?? null,
    payload,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
  });

  res.status(202).json({
    message: 'Submission accepted',
    job: {
      id: job.id,
      status: job.status,
      createdAt: job.created_at,
    },
  });
}

export async function getSubmissionStatus(req: Request, res: Response): Promise<void> {
  const jobId = Number(req.params.jobId);

  if (!Number.isInteger(jobId) || jobId <= 0) {
    res.status(400).json({ message: 'jobId must be a positive integer' });
    return;
  }

  const job = await getSubmissionJobById(jobId);

  if (!job) {
    res.status(404).json({ message: 'Submission job not found' });
    return;
  }

  res.status(200).json({
    job: {
      id: job.id,
      status: job.status,
      attemptCount: job.attempt_count,
      maxAttempts: job.max_attempts,
      runAfter: job.run_after,
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      error: job.error,
      result: job.result,
    },
  });
}
