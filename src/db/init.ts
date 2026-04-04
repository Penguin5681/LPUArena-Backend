import { pool } from './pool';
import { seedQuestions } from './seed-questions';

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
      constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
      examples JSONB NOT NULL DEFAULT '[]'::jsonb,
      hints JSONB NOT NULL DEFAULT '[]'::jsonb,
      time_complexity TEXT,
      space_complexity TEXT,
      extra JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS questions_difficulty_idx
    ON questions (difficulty);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS questions_topic_idx
    ON questions (topic);
  `);

  await seedQuestions();
}
