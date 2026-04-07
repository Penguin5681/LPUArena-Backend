import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../config/jwt';
import { findUserById } from '../models/user.model';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAuthToken(token);

    const user = await findUserById(payload.userId);

    if (!user || !user.session_token || user.session_token !== token) {
      res.status(401).json({ message: 'Session expired. Please sign in again.' });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
