import { pool } from '../db/pool';

export type SubmissionJobPayload = {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
};

export type SubmissionJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type SubmissionJobRow = {
  id: number;
  user_id: number | null;
  status: SubmissionJobStatus;
  payload: SubmissionJobPayload;
  result: unknown;
  error: string | null;
  attempt_count: number;
  max_attempts: number;
  run_after: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type CreateSubmissionJobInput = {
  userId: number | null;
  payload: SubmissionJobPayload;
  maxAttempts: number;
};

export async function createSubmissionJob(
  input: CreateSubmissionJobInput
): Promise<Pick<SubmissionJobRow, 'id' | 'status' | 'created_at'>> {
  const result = await pool.query<Pick<SubmissionJobRow, 'id' | 'status' | 'created_at'>>(
    `
      INSERT INTO submission_jobs (user_id, status, payload, max_attempts)
      VALUES ($1, 'queued', $2::jsonb, $3)
      RETURNING id, status, created_at
    `,
    [input.userId, JSON.stringify(input.payload), input.maxAttempts]
  );

  return result.rows[0];
}

export async function getSubmissionJobById(jobId: number): Promise<SubmissionJobRow | null> {
  const result = await pool.query<SubmissionJobRow>(
    `
      SELECT
        id,
        user_id,
        status,
        payload,
        result,
        error,
        attempt_count,
        max_attempts,
        run_after,
        started_at,
        finished_at,
        created_at,
        updated_at
      FROM submission_jobs
      WHERE id = $1
      LIMIT 1
    `,
    [jobId]
  );

  return result.rows[0] ?? null;
}

export async function claimSubmissionJobs(batchSize: number): Promise<SubmissionJobRow[]> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const selectedIds = await client.query<{ id: number }>(
      `
        SELECT id
        FROM submission_jobs
        WHERE status = 'queued'
          AND run_after <= NOW()
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      `,
      [batchSize]
    );

    if (selectedIds.rowCount === 0) {
      await client.query('COMMIT');
      return [];
    }

    const ids = selectedIds.rows.map((row) => row.id);

    const claimedJobs = await client.query<SubmissionJobRow>(
      `
        UPDATE submission_jobs
        SET
          status = 'running',
          attempt_count = attempt_count + 1,
          started_at = NOW(),
          updated_at = NOW(),
          error = NULL
        WHERE id = ANY($1::bigint[])
        RETURNING
          id,
          user_id,
          status,
          payload,
          result,
          error,
          attempt_count,
          max_attempts,
          run_after,
          started_at,
          finished_at,
          created_at,
          updated_at
      `,
      [ids]
    );

    await client.query('COMMIT');
    return claimedJobs.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markSubmissionJobCompleted(jobId: number, resultPayload: unknown): Promise<void> {
  await pool.query(
    `
      UPDATE submission_jobs
      SET
        status = 'completed',
        result = $2::jsonb,
        error = NULL,
        finished_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `,
    [jobId, JSON.stringify(resultPayload)]
  );
}

export async function markSubmissionJobFailed(
  jobId: number,
  errorMessage: string,
  retryAt: Date | null
): Promise<void> {
  if (retryAt) {
    await pool.query(
      `
        UPDATE submission_jobs
        SET
          status = 'queued',
          run_after = $2,
          error = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [jobId, retryAt.toISOString(), errorMessage]
    );

    return;
  }

  await pool.query(
    `
      UPDATE submission_jobs
      SET
        status = 'failed',
        error = $2,
        finished_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `,
    [jobId, errorMessage]
  );
}

export async function resetRunningSubmissionJobs(): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      UPDATE submission_jobs
      SET
        status = 'queued',
        run_after = NOW(),
        error = 'Requeued after worker restart',
        updated_at = NOW()
      WHERE status = 'running'
      RETURNING id
    `
  );

  return result.rowCount ?? 0;
}
