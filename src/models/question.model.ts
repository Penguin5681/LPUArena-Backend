import { pool } from '../db/pool';

export type QuestionRecord = {
  id: number;
  title: string;
  slug: string;
  description: string;
  topic: string;
  difficulty: string;
  points: number;
  constraints: unknown[];
  examples: unknown[];
  hints: unknown[];
  time_complexity: string | null;
  space_complexity: string | null;
  extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ListQuestionsResult = {
  questions: QuestionRecord[];
  total: number;
};

export type SolvedQuestionRecord = {
  id: number;
  title: string;
  slug: string;
  topic: string;
  difficulty: string;
  points: number;
  first_solved_at: string;
};

export async function listQuestionsPaginated(params: {
  limit: number;
  offset: number;
}): Promise<ListQuestionsResult> {
  const [questionsResult, countResult] = await Promise.all([
    pool.query<QuestionRecord>(
      `
        SELECT
          id,
          title,
          slug,
          description,
          topic,
          difficulty,
          points,
          constraints,
          examples,
          hints,
          time_complexity,
          space_complexity,
          extra,
          created_at,
          updated_at
        FROM questions
        ORDER BY id ASC
        LIMIT $1 OFFSET $2
      `,
      [params.limit, params.offset]
    ),
    pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM questions'),
  ]);

  return {
    questions: questionsResult.rows,
    total: Number(countResult.rows[0]?.count || '0'),
  };
}

export async function listAllQuestions(): Promise<QuestionRecord[]> {
  const result = await pool.query<QuestionRecord>(
    `
      SELECT
        id,
        title,
        slug,
        description,
        topic,
        difficulty,
        points,
        constraints,
        examples,
        hints,
        time_complexity,
        space_complexity,
        extra,
        created_at,
        updated_at
      FROM questions
      ORDER BY id ASC
    `
  );

  return result.rows;
}

export async function listSolvedQuestionsByUser(userId: number): Promise<SolvedQuestionRecord[]> {
  const result = await pool.query<SolvedQuestionRecord>(
    `
      SELECT
        q.id,
        q.title,
        q.slug,
        q.topic,
        q.difficulty,
        q.points,
        MIN(us.created_at)::text AS first_solved_at
      FROM user_submissions us
      INNER JOIN questions q ON q.id = us.question_id
      WHERE us.user_id = $1
        AND us.is_correct = TRUE
        AND us.question_id IS NOT NULL
      GROUP BY q.id, q.title, q.slug, q.topic, q.difficulty, q.points
      ORDER BY MIN(us.created_at) ASC, q.id ASC
    `,
    [userId]
  );

  return result.rows;
}
