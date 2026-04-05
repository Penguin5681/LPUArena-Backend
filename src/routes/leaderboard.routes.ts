import { Router } from 'express';
import {
  getCheatersLeaderboardAdmin,
  getFinalLeaderboardAdmin,
  getLeaderboardTable,
  getMostRecentCheaterAdmin,
  getMyCurrentPoints,
  getMyPointDeductions,
  getMySolvedByDifficulty,
  logParticipantEvent,
  logParticipantSubmission,
} from '../controllers/leaderboard.controller';
import { adminPasswordMiddleware } from '../middleware/admin-password.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const leaderboardRouter = Router();

leaderboardRouter.get('/', authMiddleware, getLeaderboardTable);
leaderboardRouter.get('/points', authMiddleware, getMyCurrentPoints);
leaderboardRouter.get('/deductions', authMiddleware, getMyPointDeductions);
leaderboardRouter.get('/solved-by-difficulty', authMiddleware, getMySolvedByDifficulty);
leaderboardRouter.post('/events', authMiddleware, logParticipantEvent);
leaderboardRouter.post('/submissions', authMiddleware, logParticipantSubmission);

leaderboardRouter.post('/admin/final', adminPasswordMiddleware, getFinalLeaderboardAdmin);
leaderboardRouter.post('/admin/cheaters', adminPasswordMiddleware, getCheatersLeaderboardAdmin);
leaderboardRouter.post(
  '/admin/cheaters/recent',
  adminPasswordMiddleware,
  getMostRecentCheaterAdmin
);

export { leaderboardRouter };
