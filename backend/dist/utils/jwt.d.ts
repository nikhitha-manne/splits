import { User } from '../models/User';
export interface AuthTokenPayload {
    userId: string;
}
export declare function signAuthToken(user: User): string;
export declare function verifyAuthToken(token: string): AuthTokenPayload | null;
//# sourceMappingURL=jwt.d.ts.map