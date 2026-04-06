import dotenv from 'dotenv';

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalListEnv(name: string): string[] | undefined {
  const value = process.env[name];

  if (!value) {
    return undefined;
  }

  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return values.length > 0 ? values : undefined;
}

function getOptionalPositiveNumberEnv(name: string): number | undefined {
  const value = process.env[name];

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${name}. Expected a positive number.`);
  }

  return parsed;
}

function getOptionalBooleanEnv(name: string): boolean | undefined {
  const value = process.env[name];

  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Invalid value for ${name}. Expected true or false.`);
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  judgeZeroGcp: getRequiredEnv('JUDGE_ZERO_GCP'),
  judgeZeroNodes: getOptionalListEnv('JUDGE_ZERO_NODES'),
  judge0PollIntervalMs: getOptionalPositiveNumberEnv('JUDGE0_POLL_INTERVAL_MS'),
  judge0MaxPollAttempts: getOptionalPositiveNumberEnv('JUDGE0_MAX_POLL_ATTEMPTS'),
  judge0RequestTimeoutMs: getOptionalPositiveNumberEnv('JUDGE0_REQUEST_TIMEOUT_MS'),
  judge0MaxInFlightSubmissions: getOptionalPositiveNumberEnv('JUDGE0_MAX_IN_FLIGHT_SUBMISSIONS'),
  judge0OverloadRetryAfterSeconds: getOptionalPositiveNumberEnv(
    'JUDGE0_OVERLOAD_RETRY_AFTER_SECONDS'
  ),
  judge0WorkerEnabled: getOptionalBooleanEnv('JUDGE0_WORKER_ENABLED'),
  judge0WorkerConcurrency: getOptionalPositiveNumberEnv('JUDGE0_WORKER_CONCURRENCY'),
  judge0WorkerBatchSize: getOptionalPositiveNumberEnv('JUDGE0_WORKER_BATCH_SIZE'),
  judge0WorkerPollIntervalMs: getOptionalPositiveNumberEnv('JUDGE0_WORKER_POLL_INTERVAL_MS'),
  judge0WorkerMaxAttempts: getOptionalPositiveNumberEnv('JUDGE0_WORKER_MAX_ATTEMPTS'),
  judge0WorkerRetryDelayMs: getOptionalPositiveNumberEnv('JUDGE0_WORKER_RETRY_DELAY_MS'),
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
