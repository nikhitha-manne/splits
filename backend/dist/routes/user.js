"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const User_1 = require("../models/User");
exports.userRouter = (0, express_1.Router)();
exports.userRouter.get('/me', (req, res) => {
    const userId = req.user?.id;
    const user = User_1.users.find((u) => u.id === userId);
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
exports.userRouter.put('/me', (req, res) => {
    const userId = req.user?.id;
    const user = User_1.users.find((u) => u.id === userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    const { name, phone, profilePhotoUrl, defaultCurrency, dietaryPreference } = req.body;
    if (dietaryPreference && !['Veg', 'Non-Veg'].includes(dietaryPreference)) {
        return res.status(400).json({ message: 'Invalid dietary preference' });
    }
    if (name !== undefined)
        user.name = name;
    if (phone !== undefined)
        user.phone = phone;
    if (profilePhotoUrl !== undefined)
        user.profilePhotoUrl = profilePhotoUrl;
    if (defaultCurrency !== undefined)
        user.defaultCurrency = defaultCurrency;
    if (dietaryPreference !== undefined)
        user.dietaryPreference = dietaryPreference;
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
//# sourceMappingURL=user.js.map