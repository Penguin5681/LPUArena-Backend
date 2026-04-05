import { Request, Response } from 'express';
import { getActiveUsersCount, upsertHeartbeat } from '../models/activity.model';

const DEFAULT_WINDOW_SECONDS = 60;
const MAX_WINDOW_SECONDS = 3600;

function parseWindowSeconds(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_WINDOW_SECONDS;
  }

  return Math.min(parsed, MAX_WINDOW_SECONDS);
}

export async function heartbeat(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const windowSeconds = parseWindowSeconds(req.query.windowSeconds);
  const metadata =
    typeof req.body?.metadata === 'object' && req.body?.metadata !== null
      ? req.body.metadata
      : undefined;

  const lastSeenAt = await upsertHeartbeat(req.user.userId, metadata);
  const activeUsers = await getActiveUsersCount(windowSeconds);

  res.status(200).json({
    message: 'Heartbeat recorded',
    userId: req.user.userId,
    lastSeenAt,
    activeUsers,
    windowSeconds,
  });
}

export async function getLiveActiveUsers(req: Request, res: Response): Promise<void> {
  const windowSeconds = parseWindowSeconds(req.query.windowSeconds);
  const activeUsers = await getActiveUsersCount(windowSeconds);

  res.status(200).json({
    activeUsers,
    windowSeconds,
  });
}
