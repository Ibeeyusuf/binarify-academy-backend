import express from 'express';
import { body } from 'express-validator';
import {
  submitApplication,
  getApplication,
  getAllApplications,
  updateApplicationStatus,
  getApplicationStats
} from '../controllers/applicationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { 
  validatePhoneNumber, 
  checkDuplicateEmail,
  handleValidationErrors,
  sanitizeInput 
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { rateLimitByUser } from '../middleware/auth.js';

const router = express.Router();

// Apply sanitization to all routes
router.use(sanitizeInput);

// Validation rules
const applicationValidation = [
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail()
    .custom(checkDuplicateEmail),
  
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .trim()
    .custom(validatePhoneNumber),
  
  body('countryCode')
    .optional()
    .isIn(['+234', '+233', '+27', '+254', '+256', '+250', '+255', '+251', '+237', '+225', '+221', '+212', '+20', '+1', '+44', '+49', '+33'])
    .withMessage('Invalid country code'),
  
  body('country')
    .notEmpty().withMessage('Country is required')
    .isIn(['nigeria', 'ghana', 'south-africa', 'kenya', 'uganda', 'rwanda', 'tanzania', 'ethiopia', 'cameroon', 'ivory-coast', 'senegal', 'morocco', 'egypt', 'usa', 'uk', 'canada', 'germany', 'france', 'other'])
    .withMessage('Please select a valid country'),
  
  body('state')
    .notEmpty().withMessage('State/Region is required')
    .trim(),
  
  body('track')
    .notEmpty().withMessage('Track is required')
    .isIn(['project-management', 'frontend-development', 'backend-development', 'quality-assurance', 'devops'])
    .withMessage('Please select a valid track'),
  
  body('program')
    .notEmpty().withMessage('Program is required')
    .isIn(['launchpad', 'professional'])
    .withMessage('Please select a valid program'),
  
  body('motivation')
    .notEmpty().withMessage('Motivation is required')
    .trim()
    .isLength({ min: 50, max: 1000 }).withMessage('Motivation must be between 50 and 1000 characters'),
  
  body('agreeToTerms')
    .equals('true').withMessage('You must agree to the terms and conditions'),
  
  body('education')
    .optional()
    .isIn(['high-school', 'associate', 'bachelor', 'master', 'phd', 'other']),
  
  body('experience')
    .optional()
    .isIn(['entry', 'mid', 'senior', 'career-change']),
  
  body('currentRole')
    .optional()
    .isIn(['student', 'recent-graduate', 'unemployed', 'entrepreneur', 'tech-developer', 'tech-other', 'finance', 'healthcare', 'education', 'marketing', 'sales', 'operations', 'hr', 'retail', 'consulting', 'government', 'ngo', 'media', 'manufacturing', 'oil-gas', 'agriculture', 'other']),
  
  body('preferredStartDate')
    .optional()
    .isIn(['immediately', 'within-2-weeks', 'within-month', 'next-cohort', 'flexible']),
  
  body('availableHours')
    .optional()
    .isIn(['5-10', '10-15', '15-20', '20-25', '25+', 'flexible']),
  
  body('referralSource')
    .optional()
    .isIn(['google', 'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'whatsapp', 'friend', 'colleague', 'tech-community', 'university', 'job-board', 'podcast', 'blog', 'event', 'advertisement', 'other']),
  
  body('hasLaptop')
    .optional()
    .isBoolean(),
  
  body('wantsUpdates')
    .optional()
    .isBoolean(),
  
  handleValidationErrors
];

// Public routes
router.post(
  '/submit',
  applicationValidation,
  asyncHandler(submitApplication)
);

// Protected routes (admin only)
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  rateLimitByUser(15 * 60 * 1000, 50), // 50 requests per 15 minutes for admin endpoints
  asyncHandler(getAllApplications)
);

router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  asyncHandler(getApplicationStats)
);

router.get(
  '/:id',
  authenticate,
  authorize(['admin']),
  asyncHandler(getApplication)
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  [
    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['pending', 'reviewing', 'accepted', 'rejected'])
      .withMessage('Invalid status'),
    body('adminNotes').optional().trim(),
    handleValidationErrors
  ],
  asyncHandler(updateApplicationStatus)
);

export default router;