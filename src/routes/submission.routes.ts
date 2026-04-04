import { Router } from 'express';
import { submitCode } from '../controllers/submission.controller';

const submissionRouter = Router();

submissionRouter.post('/submit', submitCode);

export { submissionRouter };
