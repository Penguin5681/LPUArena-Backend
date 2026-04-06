import { Router } from 'express';
import { getAllQuestions, getMySolvedQuestions, getQuestions } from '../controllers/question.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const questionRouter = Router();

questionRouter.get('/', getQuestions);
questionRouter.get('/all', getAllQuestions);
questionRouter.get('/solved', authMiddleware, getMySolvedQuestions);

export { questionRouter };
