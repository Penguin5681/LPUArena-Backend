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
