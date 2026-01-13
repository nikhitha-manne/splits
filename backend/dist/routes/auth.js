"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
exports.authRouter = (0, express_1.Router)();
const DEFAULT_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
};
exports.authRouter.post('/signup', async (req, res) => {
    const { email, password, name, phone, profilePhotoUrl, defaultCurrency, dietaryPreference } = req.body;
    if (!email || !password || !name || !defaultCurrency || !dietaryPreference) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    if (!['Veg', 'Non-Veg'].includes(dietaryPreference)) {
        return res.status(400).json({ message: 'Invalid dietary preference' });
    }
    const existing = User_1.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
    }
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const now = new Date();
    const user = {
        id: (0, uuid_1.v4)(),
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
    User_1.users.push(user);
    const token = (0, jwt_1.signAuthToken)(user);
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
exports.authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = User_1.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!ok) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = (0, jwt_1.signAuthToken)(user);
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
exports.authRouter.post('/logout', (req, res) => {
    res.clearCookie('auth_token', DEFAULT_COOKIE_OPTIONS).status(204).send();
});
//# sourceMappingURL=auth.js.map