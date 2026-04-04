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
      points INTEGER,
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

  await pool.query(`
    ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS points INTEGER;
  `);

  await pool.query(`
    UPDATE questions
    SET points = CASE difficulty
      WHEN 'easy' THEN (FLOOR(RANDOM() * 6)::int + 10)
      WHEN 'medium' THEN (FLOOR(RANDOM() * 7)::int + 16)
      WHEN 'hard' THEN (FLOOR(RANDOM() * 4)::int + 22)
    END
    WHERE points IS NULL;
  `);

  await pool.query(`
    ALTER TABLE questions
    ALTER COLUMN points SET NOT NULL;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'questions_points_range_by_difficulty_chk'
      ) THEN
        ALTER TABLE questions
        ADD CONSTRAINT questions_points_range_by_difficulty_chk
        CHECK (
          (difficulty = 'easy' AND points BETWEEN 10 AND 15)
          OR (difficulty = 'medium' AND points BETWEEN 16 AND 22)
          OR (difficulty = 'hard' AND points BETWEEN 22 AND 25)
        );
      END IF;
    END
    $$;
  `);

  await seedQuestions();
}
