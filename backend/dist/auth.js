"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;
/**
 * Generate JWT token for user
 */
function generateToken(userId, email) {
    const payload = { userId, email };
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        throw new Error('Invalid or expired token');
    }
}
/**
 * Hash password using bcrypt
 */
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, SALT_ROUNDS);
}
/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
    return bcrypt_1.default.compare(password, hash);
}
/**
 * Authentication middleware
 */
function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const payload = verifyToken(token);
        req.user = payload;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: error.message || 'Authentication failed' });
    }
}
