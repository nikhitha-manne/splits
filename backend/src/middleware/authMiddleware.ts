import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../utils/jwt';
import { users } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const user = users.find((u) => u.id === payload.userId);
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  req.user = { id: user.id };
  next();
}
