import express from 'express';
import { body } from 'express-validator';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  assignApplicationsToReviewer,
  getReviewerApplications
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation rules
const updateUserValidation = [
  body('role')
    .optional()
    .isIn(['admin', 'reviewer', 'admissions', 'student']).withMessage('Invalid role'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone().withMessage('Invalid phone number'),
  handleValidationErrors
];

const assignApplicationsValidation = [
  body('reviewerId')
    .notEmpty().withMessage('Reviewer ID is required')
    .isMongoId().withMessage('Invalid reviewer ID'),
  body('applicationIds')
    .isArray().withMessage('Application IDs must be an array')
    .notEmpty().withMessage('At least one application ID is required'),
  body('applicationIds.*')
    .isMongoId().withMessage('Invalid application ID'),
  handleValidationErrors
];

// Admin only routes
router.get('/', authorize(['admin']), asyncHandler(getAllUsers));
router.get('/stats', authorize(['admin']), asyncHandler(getUserStats));
router.post('/assign-applications', authorize(['admin']), assignApplicationsValidation, asyncHandler(assignApplicationsToReviewer));

// Shared routes (admin can access all, users can access their own)
router.get('/:id', asyncHandler(getUserById));
router.put('/:id', updateUserValidation, asyncHandler(updateUser));
router.delete('/:id', authorize(['admin']), asyncHandler(deleteUser));

// Reviewer routes
router.get('/:id/assigned-applications', authorize(['reviewer', 'admissions', 'admin']), asyncHandler(getReviewerApplications));

export default router;