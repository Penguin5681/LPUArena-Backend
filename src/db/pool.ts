import { Pool } from 'pg';
import { env } from '../config/env';

const shouldUseSsl = process.env.DB_SSL !== 'false';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
});
