export const leaderboardTableQueries: string[] = [
  `
    CREATE TABLE IF NOT EXISTS leaderboard_participants (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      score INTEGER NOT NULL DEFAULT 0,
      total_deductions INTEGER NOT NULL DEFAULT 0,
      copy_paste_attempts INTEGER NOT NULL DEFAULT 0,
      out_of_focus_count INTEGER NOT NULL DEFAULT 0,
      illegal_injection_count INTEGER NOT NULL DEFAULT 0,
      wrong_submission_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS leaderboard_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (
        event_type IN ('out_of_focus', 'copy_paste', 'illegal_injection', 'fullscreen_exit')
      ),
      penalty_points INTEGER NOT NULL CHECK (penalty_points >= 0),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS user_submissions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id BIGINT REFERENCES questions(id) ON DELETE SET NULL,
      language_id INTEGER NOT NULL,
      source_code TEXT NOT NULL,
      verdict TEXT,
      is_correct BOOLEAN NOT NULL DEFAULT FALSE,
      is_illegal_injection BOOLEAN NOT NULL DEFAULT FALSE,
      penalty_points INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS leaderboard_events_user_created_idx
    ON leaderboard_events (user_id, created_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS user_submissions_user_created_idx
    ON user_submissions (user_id, created_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS leaderboard_participants_score_idx
    ON leaderboard_participants (score DESC, total_deductions ASC);
  `,
];

export const leaderboardMigrationQueries: string[] = [
  `
    ALTER TABLE leaderboard_events
    DROP CONSTRAINT IF EXISTS leaderboard_events_event_type_check;
  `,
  `
    ALTER TABLE leaderboard_events
    ADD CONSTRAINT leaderboard_events_event_type_check
    CHECK (
      event_type IN ('out_of_focus', 'copy_paste', 'illegal_injection', 'fullscreen_exit')
    );
  `,
];
