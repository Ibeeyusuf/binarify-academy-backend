// backend/controllers/dashboardController.js
import User from '../models/User.js';
import Application from '../models/Application.js';
import Payment from '../models/Payment.js';

// Get user dashboard stats
export const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get counts
    const activeApplications = await Application.countDocuments({
      user: userId,
      status: { $in: ['pending', 'under_review'] }
    });

    const completedCourses = await Application.countDocuments({
      user: userId,
      status: 'enrolled'
    });

    const totalPayments = await Payment.aggregate([
      { $match: { user: userId, status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Calculate study progress (mock for now)
    const studyProgress = 78; // This should be calculated based on actual course progress

    res.json({
      success: true,
      data: {
        activeApplications,
        completedCourses,
        totalPayments: totalPayments[0]?.total || 0,
        studyProgress
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get admin dashboard stats
export const getAdminStats = async (req, res) => {
  try {
    // Get counts
    const totalUsers = await User.countDocuments();
    const totalApplications = await Application.countDocuments();
    
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const approvedApplications = await Application.countDocuments({ status: 'approved' });
    const approvalRate = totalApplications > 0 
      ? Math.round((approvedApplications / totalApplications) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalApplications,
        totalRevenue: totalRevenue[0]?.total || 0,
        approvalRate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get analytics data
export const getAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    // Get user registrations over time
    const userRegistrations = await User.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);

    // Get application submissions over time
    const applicationSubmissions = await Application.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);

    // Get revenue over time
    const revenueData = await Payment.aggregate([
      { $match: { status: 'success' } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$paidAt" }
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        userRegistrations,
        applicationSubmissions,
        revenueData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all applications for admin
export const getAllApplications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const applications = await Application.find(query)
      .populate('user', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Application.countDocuments(query);

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all payments for admin
export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const payments = await Payment.find(query)
      .populate('user', 'firstName lastName email')
      .populate('application', 'program track')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Export all functions as named exports
export default {
  getUserStats,
  getAdminStats,
  getAnalytics,
  getAllApplications,
  getAllPayments
};