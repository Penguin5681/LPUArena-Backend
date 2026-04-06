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

export const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  judgeZeroGcp: getRequiredEnv('JUDGE_ZERO_GCP'),
  judgeZeroNodes: getOptionalListEnv('JUDGE_ZERO_NODES'),
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
