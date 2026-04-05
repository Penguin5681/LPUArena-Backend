import { pool } from '../db/pool';

export async function upsertHeartbeat(
  userId: number,
  metadata?: Record<string, unknown>
): Promise<string> {
  const result = await pool.query<{ last_seen_at: string }>(
    `
      INSERT INTO user_heartbeats (user_id, last_seen_at, metadata, updated_at)
      VALUES ($1, NOW(), $2::jsonb, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        last_seen_at = NOW(),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING last_seen_at::text
    `,
    [userId, JSON.stringify(metadata || {})]
  );

  return result.rows[0].last_seen_at;
}

export async function getActiveUsersCount(windowSeconds: number): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM user_heartbeats
      WHERE last_seen_at >= NOW() - ($1 * INTERVAL '1 second')
    `,
    [windowSeconds]
  );

  return Number(result.rows[0]?.count || '0');
}
