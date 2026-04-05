import { PoolClient } from 'pg';
import { pool } from '../db/pool';

export type LeaderboardEventType =
  | 'out_of_focus'
  | 'copy_paste'
  | 'illegal_injection'
  | 'fullscreen_exit';

type ParticipantRow = {
  score: number;
  total_deductions: number;
  copy_paste_attempts: number;
  out_of_focus_count: number;
  illegal_injection_count: number;
  wrong_submission_count: number;
};

type EventLogInput = {
  userId: number;
  eventType: LeaderboardEventType;
  metadata?: Record<string, unknown>;
};

type SubmissionLogInput = {
  userId: number;
  questionId?: number;
  languageId: number;
  sourceCode: string;
  verdict?: string;
  isCorrect: boolean;
  isIllegalInjection: boolean;
  illegalMatchPattern?: string | null;
};

function getEventPenalty(eventType: LeaderboardEventType, participant: ParticipantRow): number {
  if (eventType === 'out_of_focus' || eventType === 'fullscreen_exit') {
    return 1;
  }

  if (eventType === 'copy_paste') {
    return participant.copy_paste_attempts + 1;
  }

  return 5;
}

async function ensureParticipant(client: PoolClient, userId: number): Promise<void> {
  await client.query(
    `
      INSERT INTO leaderboard_participants (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
}

async function getParticipantForUpdate(client: PoolClient, userId: number): Promise<ParticipantRow> {
  await ensureParticipant(client, userId);

  const result = await client.query<ParticipantRow>(
    `
      SELECT
        score,
        total_deductions,
        copy_paste_attempts,
        out_of_focus_count,
        illegal_injection_count,
        wrong_submission_count
      FROM leaderboard_participants
      WHERE user_id = $1
      FOR UPDATE
    `,
    [userId]
  );

  if (!result.rows[0]) {
    throw new Error('Failed to load participant row');
  }

  return result.rows[0];
}

export async function logLeaderboardEvent(input: EventLogInput): Promise<{
  penaltyPoints: number;
}> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const participant = await getParticipantForUpdate(client, input.userId);
    const penaltyPoints = getEventPenalty(input.eventType, participant);

    await client.query(
      `
        INSERT INTO leaderboard_events (user_id, event_type, penalty_points, metadata)
        VALUES ($1, $2, $3, $4::jsonb)
      `,
      [input.userId, input.eventType, penaltyPoints, JSON.stringify(input.metadata || {})]
    );

    await client.query(
      `
        UPDATE leaderboard_participants
        SET
          score = score - $2,
          total_deductions = total_deductions + $2,
          copy_paste_attempts = copy_paste_attempts + CASE WHEN $3 = 'copy_paste' THEN 1 ELSE 0 END,
          out_of_focus_count = out_of_focus_count + CASE WHEN $3 = 'out_of_focus' THEN 1 ELSE 0 END,
          illegal_injection_count = illegal_injection_count + CASE WHEN $3 = 'illegal_injection' THEN 1 ELSE 0 END,
          updated_at = NOW()
        WHERE user_id = $1
      `,
      [input.userId, penaltyPoints, input.eventType]
    );

    await client.query('COMMIT');

    return { penaltyPoints };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function logSubmission(input: SubmissionLogInput): Promise<{
  submissionId: string;
  penaltyPoints: number;
  pointsAwarded: number;
  alreadySolved: boolean;
  logged: boolean;
}> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await getParticipantForUpdate(client, input.userId);

    const wrongSubmissionPenalty = input.isCorrect ? 0 : 1;
    const illegalInjectionPenalty = input.isIllegalInjection ? 5 : 0;
    const penaltyPoints = wrongSubmissionPenalty + illegalInjectionPenalty;
    let pointsAwarded = 0;
    let alreadySolved = false;

    let existingSolvedSubmissionId: string | null = null;

    if (input.isCorrect && input.questionId) {
      const solvedResult = await client.query<{ id: string }>(
        `
          SELECT id::text
          FROM user_submissions
          WHERE user_id = $1 AND question_id = $2 AND is_correct = TRUE
          ORDER BY created_at ASC
          LIMIT 1
        `,
        [input.userId, input.questionId]
      );

      alreadySolved = Boolean(solvedResult.rows[0]?.id);
      existingSolvedSubmissionId = solvedResult.rows[0]?.id || null;

      if (!alreadySolved) {
        const questionResult = await client.query<{ points: number }>(
          `
            SELECT points
            FROM questions
            WHERE id = $1
          `,
          [input.questionId]
        );

        if (!questionResult.rows[0]) {
          throw new Error('Question not found');
        }

        pointsAwarded = questionResult.rows[0].points;
      }
    }

    if (input.isCorrect && alreadySolved && !input.isIllegalInjection) {
      await client.query('COMMIT');

      return {
        submissionId: existingSolvedSubmissionId || 'already-solved',
        penaltyPoints: 0,
        pointsAwarded: 0,
        alreadySolved: true,
        logged: false,
      };
    }

    const submissionResult = await client.query<{ id: string }>(
      `
        INSERT INTO user_submissions (
          user_id,
          question_id,
          language_id,
          source_code,
          verdict,
          is_correct,
          is_illegal_injection,
          penalty_points
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id::text
      `,
      [
        input.userId,
        input.questionId || null,
        input.languageId,
        input.sourceCode,
        input.verdict || null,
        input.isCorrect,
        input.isIllegalInjection,
        penaltyPoints,
      ]
    );

    if (penaltyPoints > 0 || pointsAwarded > 0) {
      await client.query(
        `
          UPDATE leaderboard_participants
          SET
            score = score + $2 - $3,
            total_deductions = total_deductions + $3,
            wrong_submission_count = wrong_submission_count + $4,
            illegal_injection_count = illegal_injection_count + $5,
            updated_at = NOW()
          WHERE user_id = $1
        `,
        [
          input.userId,
          pointsAwarded,
          penaltyPoints,
          wrongSubmissionPenalty > 0 ? 1 : 0,
          illegalInjectionPenalty > 0 ? 1 : 0,
        ]
      );
    }

    if (illegalInjectionPenalty > 0) {
      await client.query(
        `
          INSERT INTO leaderboard_events (user_id, event_type, penalty_points, metadata)
          VALUES ($1, 'illegal_injection', $2, $3::jsonb)
        `,
        [
          input.userId,
          illegalInjectionPenalty,
          JSON.stringify({
            reason: 'illegal_code_injection_detected',
            matchedPattern: input.illegalMatchPattern || null,
            submissionId: submissionResult.rows[0].id,
          }),
        ]
      );
    }

    await client.query('COMMIT');

    return {
      submissionId: submissionResult.rows[0].id,
      penaltyPoints,
      pointsAwarded,
      alreadySolved,
      logged: true,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getLeaderboard(limit: number): Promise<
  Array<{
    userId: number;
    name: string;
    email: string;
    score: number;
    totalDeductions: number;
    copyPasteAttempts: number;
    outOfFocusCount: number;
    illegalInjectionCount: number;
    wrongSubmissionCount: number;
  }>
> {
  const result = await pool.query<{
    user_id: number;
    name: string;
    email: string;
    score: number;
    total_deductions: number;
    copy_paste_attempts: number;
    out_of_focus_count: number;
    illegal_injection_count: number;
    wrong_submission_count: number;
  }>(
    `
      SELECT
        lp.user_id,
        u.name,
        u.email,
        lp.score,
        lp.total_deductions,
        lp.copy_paste_attempts,
        lp.out_of_focus_count,
        lp.illegal_injection_count,
        lp.wrong_submission_count
      FROM leaderboard_participants lp
      INNER JOIN users u ON u.id = lp.user_id
      ORDER BY lp.score DESC, lp.total_deductions ASC, lp.updated_at ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    score: row.score,
    totalDeductions: row.total_deductions,
    copyPasteAttempts: row.copy_paste_attempts,
    outOfFocusCount: row.out_of_focus_count,
    illegalInjectionCount: row.illegal_injection_count,
    wrongSubmissionCount: row.wrong_submission_count,
  }));
}

export async function getUserPointDeductions(
  userId: number,
  limit: number
): Promise<
  Array<{
    source: 'event' | 'submission';
    pointsDeducted: number;
    reason: string;
    occurredAt: string;
    eventType?: string;
    submissionId?: string;
    questionId?: number | null;
    verdict?: string | null;
    metadata?: Record<string, unknown>;
  }>
> {
  const result = await pool.query<{
    source: 'event' | 'submission';
    points_deducted: number;
    reason: string;
    occurred_at: string;
    event_type: string | null;
    submission_id: string | null;
    question_id: number | null;
    verdict: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `
      (
        SELECT
          'event'::text AS source,
          le.penalty_points AS points_deducted,
          le.event_type AS reason,
          le.created_at::text AS occurred_at,
          le.event_type,
          NULL::text AS submission_id,
          NULL::bigint AS question_id,
          NULL::text AS verdict,
          le.metadata
        FROM leaderboard_events le
        WHERE le.user_id = $1
          AND le.penalty_points > 0
          AND le.event_type IN ('out_of_focus', 'copy_paste', 'fullscreen_exit')
      )
      UNION ALL
      (
        SELECT
          'submission'::text AS source,
          us.penalty_points AS points_deducted,
          CASE
            WHEN us.is_correct = FALSE AND us.is_illegal_injection = TRUE THEN 'wrong_submission + illegal_injection'
            WHEN us.is_correct = FALSE THEN 'wrong_submission'
            WHEN us.is_illegal_injection = TRUE THEN 'illegal_injection'
            ELSE 'submission_penalty'
          END AS reason,
          us.created_at::text AS occurred_at,
          NULL::text AS event_type,
          us.id::text AS submission_id,
          us.question_id,
          us.verdict,
          NULL::jsonb AS metadata
        FROM user_submissions us
        WHERE us.user_id = $1
          AND us.penalty_points > 0
      )
      ORDER BY occurred_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows.map((row) => ({
    source: row.source,
    pointsDeducted: row.points_deducted,
    reason: row.reason,
    occurredAt: row.occurred_at,
    eventType: row.event_type || undefined,
    submissionId: row.submission_id || undefined,
    questionId: row.question_id,
    verdict: row.verdict,
    metadata: row.metadata || undefined,
  }));
}

export async function getUserCurrentPoints(userId: number): Promise<{
  userId: number;
  score: number;
  totalDeductions: number;
  wrongSubmissionCount: number;
  illegalInjectionCount: number;
}> {
  await pool.query(
    `
      INSERT INTO leaderboard_participants (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );

  const pointsResult = await pool.query<{
    score: number;
    total_deductions: number;
    wrong_submission_count: number;
    illegal_injection_count: number;
  }>(
    `
      SELECT
        score,
        total_deductions,
        wrong_submission_count,
        illegal_injection_count
      FROM leaderboard_participants
      WHERE user_id = $1
    `,
    [userId]
  );

  if (!pointsResult.rows[0]) {
    throw new Error('Failed to load user points');
  }

  const row = pointsResult.rows[0];

  return {
    userId,
    score: row.score,
    totalDeductions: row.total_deductions,
    wrongSubmissionCount: row.wrong_submission_count,
    illegalInjectionCount: row.illegal_injection_count,
  };
}

type SolvedDifficulty = 'easy' | 'medium' | 'hard';

export async function getUserSolvedByDifficulty(userId: number): Promise<{
  totalSolved: number;
  byDifficulty: Record<
    SolvedDifficulty,
    {
      solvedCount: number;
      problems: Array<{
        questionId: number;
        title: string;
        slug: string;
      }>;
    }
  >;
}> {
  const result = await pool.query<{
    difficulty: SolvedDifficulty;
    question_id: number;
    title: string;
    slug: string;
  }>(
    `
      SELECT
        q.difficulty,
        q.id AS question_id,
        q.title,
        q.slug
      FROM user_submissions us
      INNER JOIN questions q ON q.id = us.question_id
      WHERE us.user_id = $1
        AND us.is_correct = TRUE
        AND us.question_id IS NOT NULL
      GROUP BY q.difficulty, q.id, q.title, q.slug
      ORDER BY q.difficulty ASC, q.id ASC
    `,
    [userId]
  );

  const byDifficulty: Record<
    SolvedDifficulty,
    {
      solvedCount: number;
      problems: Array<{
        questionId: number;
        title: string;
        slug: string;
      }>;
    }
  > = {
    easy: { solvedCount: 0, problems: [] },
    medium: { solvedCount: 0, problems: [] },
    hard: { solvedCount: 0, problems: [] },
  };

  for (const row of result.rows) {
    byDifficulty[row.difficulty].problems.push({
      questionId: row.question_id,
      title: row.title,
      slug: row.slug,
    });
  }

  byDifficulty.easy.solvedCount = byDifficulty.easy.problems.length;
  byDifficulty.medium.solvedCount = byDifficulty.medium.problems.length;
  byDifficulty.hard.solvedCount = byDifficulty.hard.problems.length;

  return {
    totalSolved:
      byDifficulty.easy.solvedCount + byDifficulty.medium.solvedCount + byDifficulty.hard.solvedCount,
    byDifficulty,
  };
}
