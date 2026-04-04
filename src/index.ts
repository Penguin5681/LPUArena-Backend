import express, { Request, Response } from 'express';
import { env } from './config/env';
import { apiDocs } from './docs/api.docs';
import { initDb } from './db/init';
import { errorMiddleware } from './middleware/error.middleware';
import { authRouter } from './routes/auth.routes';

const app = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/docs', (_req: Request, res: Response) => {
  res.status(200).json(apiDocs);
});

app.use('/api/auth', authRouter);

app.use(errorMiddleware);

async function startServer(): Promise<void> {
  await initDb();

  app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
