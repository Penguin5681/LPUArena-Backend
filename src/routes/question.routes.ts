import { Router } from 'express';
import { getAllQuestions, getQuestions } from '../controllers/question.controller';

const questionRouter = Router();

questionRouter.get('/', getQuestions);
questionRouter.get('/all', getAllQuestions);

export { questionRouter };
