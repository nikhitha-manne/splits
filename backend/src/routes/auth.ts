import { Router } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { users, User, DietaryPreference } from '../models/User';
import { signAuthToken } from '../utils/jwt';

export const authRouter = Router();

const DEFAULT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
};

authRouter.post('/signup', async (req, res) => {
  const { email, password, name, phone, profilePhotoUrl, defaultCurrency, dietaryPreference } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    profilePhotoUrl?: string;
    defaultCurrency?: string;
    dietaryPreference?: DietaryPreference;
  };

  if (!email || !password || !name || !defaultCurrency || !dietaryPreference) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!['Veg', 'Non-Veg'].includes(dietaryPreference)) {
    return res.status(400).json({ message: 'Invalid dietary preference' });
  }

  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const user: User = {
    id: uuidv4(),
    email,
    passwordHash,
    name,
    phone: phone ?? undefined,
    profilePhotoUrl: profilePhotoUrl ?? undefined,
    defaultCurrency,
    dietaryPreference,
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);

  const token = signAuthToken(user);
  res
    .cookie('auth_token', token, DEFAULT_COOKIE_OPTIONS)
    .status(201)
    .json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      profilePhotoUrl: user.profilePhotoUrl,
      defaultCurrency: user.defaultCurrency,
      dietaryPreference: user.dietaryPreference,
    });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = signAuthToken(user);
  res
    .cookie('auth_token', token, DEFAULT_COOKIE_OPTIONS)
    .json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      profilePhotoUrl: user.profilePhotoUrl,
      defaultCurrency: user.defaultCurrency,
      dietaryPreference: user.dietaryPreference,
    });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('auth_token', DEFAULT_COOKIE_OPTIONS).status(204).send();
});
