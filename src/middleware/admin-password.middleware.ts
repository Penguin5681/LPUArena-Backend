import { NextFunction, Request, Response } from 'express';

const ADMIN_API_PASSWORD = 'algoarena_admin_420';

export function adminPasswordMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { password } = req.body;

  if (typeof password !== 'string' || password.length === 0) {
    res.status(400).json({ message: 'password is required in request body' });
    return;
  }

  if (password !== ADMIN_API_PASSWORD) {
    res.status(403).json({ message: 'Invalid password' });
    return;
  }

  next();
}
