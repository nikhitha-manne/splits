import { Router } from 'express';
import { users } from '../models/User';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const userRouter = Router();

userRouter.get('/me', (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    profilePhotoUrl: user.profilePhotoUrl,
    defaultCurrency: user.defaultCurrency,
    dietaryPreference: user.dietaryPreference,
  });
});

userRouter.put('/me', (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { name, phone, profilePhotoUrl, defaultCurrency, dietaryPreference } = req.body as {
    name?: string;
    phone?: string;
    profilePhotoUrl?: string;
    defaultCurrency?: string;
    dietaryPreference?: 'Veg' | 'Non-Veg';
  };

  if (dietaryPreference && !['Veg', 'Non-Veg'].includes(dietaryPreference)) {
    return res.status(400).json({ message: 'Invalid dietary preference' });
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (profilePhotoUrl !== undefined) user.profilePhotoUrl = profilePhotoUrl;
  if (defaultCurrency !== undefined) user.defaultCurrency = defaultCurrency;
  if (dietaryPreference !== undefined) user.dietaryPreference = dietaryPreference;
  user.updatedAt = new Date();

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    profilePhotoUrl: user.profilePhotoUrl,
    defaultCurrency: user.defaultCurrency,
    dietaryPreference: user.dietaryPreference,
  });
});
