import Application from '../models/Application.js';
import User from '../models/User.js';
import { validationResult } from 'express-validator';

// Submit new application
export const submitApplication = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check if email already has a pending application
    const existingApplication = await Application.findOne({
      email: req.body.email,
      status: 'pending'
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending application. Please wait for review.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists. Please use a different email or login.',
        errors: [{ field: "email", message: "Email is already registered" }]
      });
    }

    // Validate password match (extra validation)
    if (req.body.password !== req.body.confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
        errors: [{ field: "confirmPassword", message: "Passwords do not match" }]
      });
    }

    // Create new user account
    const user = await User.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.countryCode + req.body.phone,
      password: req.body.password,
      role: 'student',
      isEmailVerified: false,
      isActive: true
    });

    // Create new application with IP and user agent
    const applicationData = {
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const application = new Application(applicationData);
    await application.save();

    // Remove password fields from response
    application.password = undefined;
    application.confirmPassword = undefined;

    // Send confirmation email (you can implement this)
    // await sendConfirmationEmail(application.email, application.firstName);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully! You can now login with your email and password.',
      data: {
        id: application._id,
        userId: user._id,
        applicationDate: application.applicationDate,
        track: application.track,
        program: application.program,
        status: application.status,
        email: application.email,
        firstName: application.firstName
      }
    });
  } catch (error) {
    console.error('Application submission error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000 || error.name === 'MongoError') {
      return res.status(409).json({
        success: false,
        message: 'Email already exists',
        errors: [{ field: "email", message: "Email is already registered" }]
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error submitting application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get application by ID (admin or owner)
export const getApplication = async (req, res) => {
  try {
    const { id } = req.params;
    
    const application = await Application.findById(id).select('-__v -password -confirmPassword');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching application'
    });
  }
};

// Get all applications (admin only - with pagination and filtering)
export const getAllApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      track,
      program,
      startDate,
      endDate,
      search
    } = req.query;

    const query = {};

    // Add filters
    if (status) query.status = status;
    if (track) query.track = track;
    if (program) query.program = program;
    
    // Date range filter
    if (startDate || endDate) {
      query.applicationDate = {};
      if (startDate) query.applicationDate.$gte = new Date(startDate);
      if (endDate) query.applicationDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    const applications = await Application.find(query)
      .select('-password -confirmPassword -__v')
      .sort({ applicationDate: -1 })
      .skip(skip)
      .limit(pageSize);

    const total = await Application.countDocuments(query);

    res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(total / pageSize),
        totalItems: total,
        hasNextPage: pageNumber < Math.ceil(total / pageSize),
        hasPreviousPage: pageNumber > 1
      }
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching applications'
    });
  }
};

// Update application status (admin only)
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status || !['pending', 'reviewing', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }

    const application = await Application.findByIdAndUpdate(
      id,
      {
        status,
        ...(adminNotes && { adminNotes }),
        reviewedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password -confirmPassword');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating application status'
    });
  }
};

// Get application statistics (admin only)
export const getApplicationStats = async (req, res) => {
  try {
    const stats = await Application.aggregate([
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          trackCounts: [
            {
              $group: {
                _id: '$track',
                count: { $sum: 1 }
              }
            }
          ],
          programCounts: [
            {
              $group: {
                _id: '$program',
                count: { $sum: 1 }
              }
            }
          ],
          countryCounts: [
            {
              $group: {
                _id: '$country',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          dailyApplications: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$applicationDate' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: -1 } },
            { $limit: 30 }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
};