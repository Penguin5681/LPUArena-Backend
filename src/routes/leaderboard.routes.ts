import { Router } from 'express';
import {
  getLeaderboardTable,
  getMyPointDeductions,
  logParticipantEvent,
  logParticipantSubmission,
} from '../controllers/leaderboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const leaderboardRouter = Router();

leaderboardRouter.get('/', authMiddleware, getLeaderboardTable);
leaderboardRouter.get('/deductions', authMiddleware, getMyPointDeductions);
leaderboardRouter.post('/events', authMiddleware, logParticipantEvent);
leaderboardRouter.post('/submissions', authMiddleware, logParticipantSubmission);

export { leaderboardRouter };
