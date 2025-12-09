import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'reviewer', 'admissions', 'student']).withMessage('Invalid role'),
  body('phone')
    .optional()
    .isMobilePhone().withMessage('Invalid phone number'),
  handleValidationErrors
];

const loginValidation = [
  body('email')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  handleValidationErrors
];

const forgotPasswordValidation = [
  body('email')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  handleValidationErrors
];

const resetPasswordValidation = [
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

// Public routes
router.post('/register', authenticate, authorize(['admin']), registerValidation, asyncHandler(register));
router.post('/login', loginValidation, asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.post('/forgot-password', forgotPasswordValidation, asyncHandler(forgotPassword));
router.post('/verify-email/resend', asyncHandler(resendVerificationEmail));
router.get('/verify-email/:token', asyncHandler(verifyEmail));
router.post('/reset-password/:token', resetPasswordValidation, asyncHandler(resetPassword));

// Protected routes (require authentication)
router.get('/me', authenticate, asyncHandler(getMe));
router.put('/profile', authenticate, asyncHandler(updateProfile));
router.put('/change-password', authenticate, changePasswordValidation, asyncHandler(changePassword));

export default router;