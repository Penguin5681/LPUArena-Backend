import { Router } from 'express';
import { getLiveActiveUsers, heartbeat } from '../controllers/activity.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const activityRouter = Router();

activityRouter.post('/heartbeat', authMiddleware, heartbeat);
activityRouter.get('/live', getLiveActiveUsers);

export { activityRouter };
