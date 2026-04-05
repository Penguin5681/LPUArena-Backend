import { Router } from 'express';
import {
  getLeaderboardTable,
  logParticipantEvent,
  logParticipantSubmission,
} from '../controllers/leaderboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const leaderboardRouter = Router();

leaderboardRouter.get('/', authMiddleware, getLeaderboardTable);
leaderboardRouter.post('/events', authMiddleware, logParticipantEvent);
leaderboardRouter.post('/submissions', authMiddleware, logParticipantSubmission);

export { leaderboardRouter };
