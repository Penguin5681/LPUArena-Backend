import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './pool';

type RawQuestion = {
  title: string;
  slug: string;
  description: string;
  topic: string;
  difficulty: string;
  constraints?: unknown;
  examples?: unknown;
  hints?: unknown;
  time_complexity?: unknown;
  space_complexity?: unknown;
  [key: string]: unknown;
};

function getRandomIntInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPointsByDifficulty(difficulty: string): number {
  const normalized = difficulty.toLowerCase().trim();

  if (normalized === 'easy') {
    return getRandomIntInRange(10, 15);
  }

  if (normalized === 'medium') {
    return getRandomIntInRange(16, 22);
  }

  if (normalized === 'hard') {
    return getRandomIntInRange(22, 25);
  }

  throw new Error(`Unsupported difficulty for points assignment: ${difficulty}`);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNullableText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function validateQuestion(raw: RawQuestion, index: number): void {
  if (!raw.title || !raw.slug || !raw.description || !raw.topic || !raw.difficulty) {
    throw new Error(`Invalid question at index ${index}: missing required fields`);
  }

  if (typeof raw.title !== 'string' || typeof raw.slug !== 'string') {
    throw new Error(`Invalid question at index ${index}: title/slug must be strings`);
  }
}

export async function seedQuestions(): Promise<void> {
  const filePath = path.resolve(process.cwd(), 'coding-questions.json');
  const rawContent = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(rawContent) as RawQuestion[];
  const slugCounts = new Map<string, number>();

  if (!Array.isArray(parsed)) {
    throw new Error('coding-questions.json must contain an array');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let index = 0; index < parsed.length; index += 1) {
      const item = parsed[index];
      validateQuestion(item, index);

      const {
        title,
        slug,
        description,
        topic,
        difficulty,
        constraints,
        examples,
        hints,
        time_complexity,
        space_complexity,
        ...extra
      } = item;

      const baseSlug = slug.trim();
      const occurrence = (slugCounts.get(baseSlug) || 0) + 1;
      slugCounts.set(baseSlug, occurrence);
      const uniqueSlug = occurrence === 1 ? baseSlug : `${baseSlug}-${occurrence}`;
      const normalizedExtra =
        occurrence === 1 ? extra : { ...extra, original_slug: baseSlug, duplicate_index: occurrence };
      const normalizedDifficulty = difficulty.trim().toLowerCase();
      const points = randomPointsByDifficulty(normalizedDifficulty);

      await client.query(
        `
          INSERT INTO questions (
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
            extra
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb)
          ON CONFLICT (slug)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            topic = EXCLUDED.topic,
            difficulty = EXCLUDED.difficulty,
            points = EXCLUDED.points,
            constraints = EXCLUDED.constraints,
            examples = EXCLUDED.examples,
            hints = EXCLUDED.hints,
            time_complexity = EXCLUDED.time_complexity,
            space_complexity = EXCLUDED.space_complexity,
            extra = EXCLUDED.extra,
            updated_at = NOW()
        `,
        [
          title.trim(),
          uniqueSlug,
          description.trim(),
          topic.trim(),
          normalizedDifficulty,
          points,
          JSON.stringify(toArray(constraints)),
          JSON.stringify(toArray(examples)),
          JSON.stringify(toArray(hints)),
          toNullableText(time_complexity),
          toNullableText(space_complexity),
          JSON.stringify(normalizedExtra),
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
