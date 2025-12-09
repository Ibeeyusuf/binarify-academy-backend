import { validationResult } from 'express-validator';

// Custom validation for phone numbers
export const validatePhoneNumber = (value, { req }) => {
  // Remove all non-digit characters
  const phoneDigits = value.replace(/\D/g, '');
  
  // Basic validation - adjust based on your requirements
  if (phoneDigits.length < 7) {
    throw new Error('Phone number is too short');
  }
  
  if (phoneDigits.length > 15) {
    throw new Error('Phone number is too long');
  }
  
  return true;
};

// Custom validation for country-state combination
export const validateCountryState = async (value, { req }) => {
  const { country, state } = req.body;
  
  // Define valid country-state combinations
  const validCombinations = {
    nigeria: ['abia', 'adamawa', 'akwa-ibom', /* ... other states */],
    ghana: ['greater-accra', 'ashanti', /* ... other regions */],
    // Add more countries as needed
  };

  if (validCombinations[country] && !validCombinations[country].includes(state)) {
    throw new Error(`Invalid state/region for ${country}`);
  }
  
  return true;
};

// Check if email is already used for pending application
export const checkDuplicateEmail = async (value, { req }) => {
  const Application = (await import('../models/Application.js')).default;
  
  const existingApplication = await Application.findOne({
    email: value,
    status: { $in: ['pending', 'reviewing'] }
  });

  if (existingApplication && !req.body.allowResubmission) {
    throw new Error('You already have a pending application');
  }
  
  return true;
};

// Error handler middleware for validation
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

// Sanitize input data
export const sanitizeInput = (req, res, next) => {
  // Recursive sanitization function
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj.trim()
        .replace(/<[^>]*>?/gm, '') // Remove HTML tags
        .replace(/[<>]/g, ''); // Remove angle brackets
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize body, query, and params
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};