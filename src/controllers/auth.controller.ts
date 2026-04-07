import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { signAuthToken } from '../config/jwt';
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByRegistrationNumber,
  updateUserSessionToken,
} from '../models/user.model';

const REGISTRATION_NUMBER_REGEX = /^\d{8}$/;

function sanitizeUser(user: {
  id: number;
  name: string;
  email: string;
  registration_number: string;
  created_at: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    registrationNumber: user.registration_number,
    createdAt: user.created_at,
  };
}

export async function signUp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, registrationNumber, password } = req.body;

    if (!name || !email || !registrationNumber || !password) {
      res.status(400).json({
        message: 'name, email, registrationNumber and password are required',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'password must be at least 6 characters long' });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedRegistrationNumber = String(registrationNumber).trim();

    if (!REGISTRATION_NUMBER_REGEX.test(normalizedRegistrationNumber)) {
      res.status(400).json({ message: 'registrationNumber must be exactly 8 digits' });
      return;
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    const existingRegistrationNumber = await findUserByRegistrationNumber(
      normalizedRegistrationNumber
    );

    if (existingUser) {
      res.status(409).json({ message: 'Email already exists' });
      return;
    }

    if (existingRegistrationNumber) {
      res.status(409).json({ message: 'Registration number already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      name: String(name).trim(),
      email: normalizedEmail,
      registrationNumber: normalizedRegistrationNumber,
      passwordHash,
    });

    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      sessionId: randomUUID(),
    });
    await updateUserSessionToken(user.id, token);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function signIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, registrationNumber, password } = req.body;

    if ((!email && !registrationNumber) || !password) {
      res.status(400).json({
        message: 'email or registrationNumber, and password are required',
      });
      return;
    }

    let user = null;

    if (email) {
      const normalizedEmail = String(email).toLowerCase().trim();
      user = await findUserByEmail(normalizedEmail);
    } else {
      const normalizedRegistrationNumber = String(registrationNumber).trim();

      if (!REGISTRATION_NUMBER_REGEX.test(normalizedRegistrationNumber)) {
        res.status(400).json({ message: 'registrationNumber must be exactly 8 digits' });
        return;
      }

      user = await findUserByRegistrationNumber(normalizedRegistrationNumber);
    }

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      sessionId: randomUUID(),
    });
    await updateUserSessionToken(user.id, token);

    res.status(200).json({
      message: 'Sign in successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await findUserById(req.user.userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function getSessionToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await findUserById(req.user.userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      sessionToken: user.session_token,
    });
  } catch (error) {
    next(error);
  }
}
