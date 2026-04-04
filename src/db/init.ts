import { pool } from './pool';

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      registration_number VARCHAR(8) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Backward-compatible migration for existing databases.
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS registration_number VARCHAR(8);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_registration_number_unique_idx
    ON users (registration_number);
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_registration_number_format_chk'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_registration_number_format_chk
        CHECK (registration_number ~ '^\\d{8}$' OR registration_number IS NULL);
      END IF;
    END
    $$;
  `);
}
