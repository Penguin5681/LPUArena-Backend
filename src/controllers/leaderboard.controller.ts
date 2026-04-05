import { Request, Response } from 'express';
import { detectIllegalCodeInjection } from '../services/code-security.service';
import {
  getLeaderboard,
  getUserPointDeductions,
  LeaderboardEventType,
  logLeaderboardEvent,
  logSubmission,
} from '../models/leaderboard.model';

const ALLOWED_EVENTS: LeaderboardEventType[] = ['out_of_focus', 'copy_paste', 'fullscreen_exit'];

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function logParticipantEvent(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { eventType, metadata } = req.body;

  if (!ALLOWED_EVENTS.includes(eventType)) {
    res.status(400).json({
      message: "eventType must be one of: 'out_of_focus', 'copy_paste', 'fullscreen_exit'",
    });
    return;
  }

  const result = await logLeaderboardEvent({
    userId: req.user.userId,
    eventType,
    metadata: typeof metadata === 'object' && metadata !== null ? metadata : undefined,
  });

  res.status(201).json({
    message: 'Event logged',
    eventType,
    penaltyPoints: result.penaltyPoints,
  });
}

export async function logParticipantSubmission(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { questionId, languageId, sourceCode, verdict, isCorrect } = req.body;

  if (!Number.isInteger(questionId)) {
    res.status(400).json({ message: 'questionId is required and must be an integer' });
    return;
  }

  if (!Number.isInteger(languageId)) {
    res.status(400).json({ message: 'languageId must be an integer' });
    return;
  }

  if (typeof sourceCode !== 'string' || sourceCode.trim().length === 0) {
    res.status(400).json({ message: 'sourceCode is required and must be a non-empty string' });
    return;
  }

  if (typeof isCorrect !== 'boolean') {
    res.status(400).json({ message: 'isCorrect must be a boolean' });
    return;
  }

  const detection = detectIllegalCodeInjection(sourceCode);

  const result = await logSubmission({
    userId: req.user.userId,
    questionId,
    languageId,
    sourceCode,
    verdict: typeof verdict === 'string' ? verdict : undefined,
    isCorrect,
    isIllegalInjection: detection.isIllegal,
    illegalMatchPattern: detection.matchedPattern,
  });

  res.status(201).json({
    message: result.logged ? 'Submission logged' : 'Already solved, submission not logged',
    submissionId: result.submissionId,
    logged: result.logged,
    penaltyPoints: result.penaltyPoints,
    pointsAwarded: result.pointsAwarded,
    alreadySolved: result.alreadySolved,
    illegalInjectionDetected: detection.isIllegal,
  });
}

export async function getLeaderboardTable(req: Request, res: Response): Promise<void> {
  const requestedLimit = toPositiveInteger(req.query.limit, 50);
  const limit = Math.min(requestedLimit, 100);

  const rows = await getLeaderboard(limit);

  res.status(200).json({
    total: rows.length,
    data: rows,
  });
}

export async function getMyPointDeductions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const requestedLimit = toPositiveInteger(req.query.limit, 50);
  const limit = Math.min(requestedLimit, 200);

  const rows = await getUserPointDeductions(req.user.userId, limit);

  res.status(200).json({
    total: rows.length,
    data: rows,
  });
}
