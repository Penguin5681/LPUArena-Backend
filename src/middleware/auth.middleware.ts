import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../config/jwt';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAuthToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
