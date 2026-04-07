import { Router } from 'express';
import { getSessionToken, me, signIn, signUp } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const authRouter = Router();

authRouter.post('/signup', signUp);
authRouter.post('/signin', signIn);
authRouter.get('/me', authMiddleware, me);
authRouter.get('/session-token', authMiddleware, getSessionToken);

export { authRouter };
