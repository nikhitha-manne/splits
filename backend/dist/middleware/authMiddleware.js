"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jwt_1 = require("../utils/jwt");
const User_1 = require("../models/User");
function authMiddleware(req, res, next) {
    const token = req.cookies?.auth_token;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const payload = (0, jwt_1.verifyAuthToken)(token);
    if (!payload) {
        return res.status(401).json({ message: 'Invalid token' });
    }
    const user = User_1.users.find((u) => u.id === payload.userId);
    if (!user) {
        return res.status(401).json({ message: 'User not found' });
    }
    req.user = { id: user.id };
    next();
}
//# sourceMappingURL=authMiddleware.js.map