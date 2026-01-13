export type DietaryPreference = 'Veg' | 'Non-Veg';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone?: string | undefined;
  profilePhotoUrl?: string | undefined;
  defaultCurrency: string;
  dietaryPreference: DietaryPreference;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory user store for now (can be replaced with a real DB later)
export const users: User[] = [];
