import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't return password in queries
  },
  confirmPassword: {
    type: String,
    required: [true, 'Confirm password is required'],
    validate: {
      validator: function(el) {
        return el === this.password;
      },
      message: 'Passwords do not match'
    }
  },
  countryCode: {
    type: String,
    default: '+234'
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required']
  },
  state: {
    type: String,
    required: [true, 'State/Region is required']
  },
  
  // Add these to your Application schema
status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'enrolled'],
    default: 'pending'
  },

  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  
  // Program Information
  track: {
    type: String,
    required: [true, 'Track is required'],
    enum: [
      'project-management',
      'frontend-development',
      'backend-development',
      'quality-assurance',
      'devops'
    ]
  },
  program: {
    type: String,
    required: [true, 'Program is required'],
    enum: ['launchpad', 'professional']
  },
  
  // Background Information
  education: {
    type: String,
    enum: [
      'high-school',
      'associate',
      'bachelor',
      'master',
      'phd',
      'other'
    ]
  },
  experience: {
    type: String,
    enum: [
      'entry',
      'mid',
      'senior',
      'career-change'
    ]
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'expired', 'failed'],
    default: 'pending'
  },


  currentRole: {
    type: String,
    enum: [
      'student',
      'recent-graduate',
      'unemployed',
      'entrepreneur',
      'tech-developer',
      'tech-other',
      'finance',
      'healthcare',
      'education',
      'marketing',
      'sales',
      'operations',
      'hr',
      'retail',
      'consulting',
      'government',
      'ngo',
      'media',
      'manufacturing',
      'oil-gas',
      'agriculture',
      'other'
    ]
  },
  motivation: {
    type: String,
    required: [true, 'Motivation is required'],
    trim: true
  },
  goals: {
    type: String,
    trim: true
  },
  
  // Additional Information
  preferredStartDate: {
    type: String,
    enum: [
      'immediately',
      'within-2-weeks',
      'within-month',
      'next-cohort',
      'flexible'
    ]
  },
  availableHours: {
    type: String,
    enum: [
      '5-10',
      '10-15',
      '15-20',
      '20-25',
      '25+',
      'flexible'
    ]
  },
  referralSource: {
    type: String,
    enum: [
      'google',
      'facebook',
      'instagram',
      'twitter',
      'linkedin',
      'youtube',
      'whatsapp',
      'friend',
      'colleague',
      'tech-community',
      'university',
      'job-board',
      'podcast',
      'blog',
      'event',
      'advertisement',
      'other'
    ]
  },
  
  // Booleans
  hasLaptop: {
    type: Boolean,
    default: false
  },
  wantsUpdates: {
    type: Boolean,
    default: true
  },
  agreeToTerms: {
    type: Boolean,
    required: [true, 'You must agree to terms and conditions'],
    validate: {
      validator: function(v) {
        return v === true;
      },
      message: 'You must agree to terms and conditions'
    }
  },
  
  // Metadata
  
  applicationDate: {
    type: Date,
    default: Date.now
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Index for better query performance
applicationSchema.index({ email: 1, applicationDate: -1 });
applicationSchema.index({ status: 1, applicationDate: -1 });
applicationSchema.index({ track: 1, program: 1 });

applicationSchema.add({
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'enrolled'],
      default: 'pending'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'expired'],
      default: 'pending'
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    program: {
      type: String,
      required: true
    },
    track: {
      type: String,
      required: true
    }
  });

const Application = mongoose.model('Application', applicationSchema);

export default Application;