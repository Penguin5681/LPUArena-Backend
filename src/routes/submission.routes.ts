import { Router } from 'express';
import { getSubmissionStatus, submitCode } from '../controllers/submission.controller';

const submissionRouter = Router();

submissionRouter.post('/submit', submitCode);
submissionRouter.get('/submissions/:jobId', getSubmissionStatus);

export { submissionRouter };
