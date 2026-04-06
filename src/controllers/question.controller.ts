import { Request, Response } from 'express';
import {
  listAllQuestions,
  listQuestionsPaginated,
  listSolvedQuestionsByUser,
} from '../models/question.model';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function getQuestions(req: Request, res: Response): Promise<void> {
  const page = toPositiveInteger(req.query.page, 1);
  const requestedLimit = toPositiveInteger(req.query.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const offset = (page - 1) * limit;

  const { questions, total } = await listQuestionsPaginated({ limit, offset });
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  res.status(200).json({
    page,
    limit,
    total,
    totalPages,
    data: questions,
  });
}

export async function getAllQuestions(_req: Request, res: Response): Promise<void> {
  const questions = await listAllQuestions();

  res.status(200).json({
    total: questions.length,
    data: questions,
  });
}

export async function getMySolvedQuestions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const solvedQuestions = await listSolvedQuestionsByUser(req.user.userId);

  res.status(200).json({
    total: solvedQuestions.length,
    data: solvedQuestions,
  });
}
