import { Router } from 'express';
import {
  getLeaderboardTable,
  getMyCurrentPoints,
  getMyPointDeductions,
  getMySolvedByDifficulty,
  logParticipantEvent,
  logParticipantSubmission,
} from '../controllers/leaderboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const leaderboardRouter = Router();

leaderboardRouter.get('/', authMiddleware, getLeaderboardTable);
leaderboardRouter.get('/points', authMiddleware, getMyCurrentPoints);
leaderboardRouter.get('/deductions', authMiddleware, getMyPointDeductions);
leaderboardRouter.get('/solved-by-difficulty', authMiddleware, getMySolvedByDifficulty);
leaderboardRouter.post('/events', authMiddleware, logParticipantEvent);
leaderboardRouter.post('/submissions', authMiddleware, logParticipantSubmission);

export { leaderboardRouter };
