import cors from 'cors';
import express, { Request, Response } from 'express';
import { activityRouter } from './routes/activity.routes';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import { authRouter } from './routes/auth.routes';
import { leaderboardRouter } from './routes/leaderboard.routes';
import { questionRouter } from './routes/question.routes';
import { submissionRouter } from './routes/submission.routes';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/activity', activityRouter);
app.use('/api/auth', authRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/questions', questionRouter);
app.use('/api/judge0', submissionRouter);

app.use(errorMiddleware);

function startServer(): void {
  app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`);
  });
}

if (require.main === module) {
  startServer();
}

export default app;
export { app, startServer };
