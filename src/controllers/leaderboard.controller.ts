import { Request, Response } from 'express';
import { detectIllegalCodeInjection } from '../services/code-security.service';
import {
  disqualifyCandidate,
  getCheatersLeaderboard,
  getComingSoonConfig,
  getDisqualifiedCandidates,
  getFinalLeaderboard,
  getLeaderboard,
  getMostRecentCheater,
  getUserCurrentPoints,
  getUserPointDeductions,
  getUserSolvedByDifficulty,
  isCandidateDisqualified,
  LeaderboardEventType,
  logLeaderboardEvent,
  logSubmission,
  updateComingSoonConfig,
} from '../models/leaderboard.model';

const ALLOWED_EVENTS: LeaderboardEventType[] = ['out_of_focus', 'copy_paste', 'fullscreen_exit'];
const REGISTRATION_NUMBER_REGEX = /^\d{8}$/;

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function toBodyLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
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

  const disqualified = await isCandidateDisqualified(req.user.userId);
  if (disqualified) {
    res.status(403).json({ message: 'Candidate is disqualified' });
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

  const disqualified = await isCandidateDisqualified(req.user.userId);
  if (disqualified) {
    res.status(403).json({ message: 'Candidate is disqualified' });
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

export async function getMyCurrentPoints(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const points = await getUserCurrentPoints(req.user.userId);

  res.status(200).json({
    data: points,
  });
}

export async function getMySolvedByDifficulty(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const solvedData = await getUserSolvedByDifficulty(req.user.userId);

  res.status(200).json({
    data: solvedData,
  });
}

export async function getFinalLeaderboardAdmin(req: Request, res: Response): Promise<void> {
  const limit = toBodyLimit(req.body.limit, 200, 1000);
  const rows = await getFinalLeaderboard(limit);

  res.status(200).json({
    total: rows.length,
    data: rows,
  });
}

export async function getCheatersLeaderboardAdmin(req: Request, res: Response): Promise<void> {
  const limit = toBodyLimit(req.body.limit, 100, 1000);
  const rows = await getCheatersLeaderboard(limit);

  res.status(200).json({
    total: rows.length,
    data: rows,
  });
}

export async function getMostRecentCheaterAdmin(_req: Request, res: Response): Promise<void> {
  const row = await getMostRecentCheater();

  res.status(200).json({
    data: row,
  });
}

export async function getConfig(req: Request, res: Response): Promise<void> {
  const config = await getComingSoonConfig();

  res.status(200).json({
    data: config,
  });
}

export async function updateConfigAdmin(req: Request, res: Response): Promise<void> {
  const { isComingSoon } = req.body;

  if (typeof isComingSoon !== 'boolean') {
    res.status(400).json({ message: 'isComingSoon must be a boolean' });
    return;
  }

  const updated = await updateComingSoonConfig(isComingSoon);

  res.status(200).json({
    message: 'Config updated',
    data: updated,
  });
}

export async function disqualifyCandidateAdmin(req: Request, res: Response): Promise<void> {
  const { registrationNumber, reason } = req.body;

  if (typeof registrationNumber !== 'string' || !REGISTRATION_NUMBER_REGEX.test(registrationNumber)) {
    res.status(400).json({ message: 'registrationNumber is required and must be exactly 8 digits' });
    return;
  }

  if (reason !== undefined && typeof reason !== 'string') {
    res.status(400).json({ message: 'reason must be a string when provided' });
    return;
  }

  let result;

  try {
    result = await disqualifyCandidate({
      registrationNumber,
      reason: typeof reason === 'string' ? reason.trim() : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    throw error;
  }

  res.status(200).json({
    message: result.alreadyDisqualified
      ? 'Candidate disqualification updated'
      : 'Candidate disqualified successfully',
    data: result,
  });
}

export async function getDisqualifiedCandidatesAdmin(req: Request, res: Response): Promise<void> {
  const limit = toBodyLimit(req.body.limit, 100, 1000);
  const rows = await getDisqualifiedCandidates(limit);

  res.status(200).json({
    total: rows.length,
    data: rows,
  });
}
