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
export declare const users: User[];
//# sourceMappingURL=User.d.ts.map