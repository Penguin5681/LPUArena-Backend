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

    if (input.isCorrect && input.questionId) {
      const solvedResult = await client.query<{ solved: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM user_submissions
            WHERE user_id = $1 AND question_id = $2 AND is_correct = TRUE
          ) AS solved
        `,
        [input.userId, input.questionId]
      );

      alreadySolved = Boolean(solvedResult.rows[0]?.solved);

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
