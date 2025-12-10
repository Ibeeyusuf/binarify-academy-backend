import User from '../models/user.js';
import Application from '../models/Application.js';

// Get all users (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Add filters
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    // Search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Exclude current user if not admin
    if (req.user.role !== 'admin') {
      query._id = { $ne: req.user._id };
    }

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires')
      .sort(sort)
      .skip(skip)
      .limit(pageSize);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(total / pageSize),
        totalItems: total,
        hasNextPage: pageNumber < Math.ceil(total / pageSize),
        hasPreviousPage: pageNumber > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check permissions (admin can view anyone, users can only view themselves)
    if (req.user.role !== 'admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this user'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    });
  }
};

// Update user (admin only)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, permissions, firstName, lastName, phone } = req.body;

    const updateData = {};
    
    // Only admin can update these fields
    if (req.user.role === 'admin') {
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (permissions !== undefined) updateData.permissions = permissions;
    }
    
    // Anyone can update these fields
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user'
    });
  }
};

// Delete user (admin only)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
};

// Get user statistics
export const getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $facet: {
          totalUsers: [
            { $count: 'count' }
          ],
          usersByRole: [
            {
              $group: {
                _id: '$role',
                count: { $sum: 1 }
              }
            }
          ],
          usersByStatus: [
            {
              $group: {
                _id: '$isActive',
                count: { $sum: 1 }
              }
            }
          ],
          newUsersByMonth: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 }
          ],
          emailVerificationStatus: [
            {
              $group: {
                _id: '$isEmailVerified',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    // Format the response
    const formattedStats = {
      total: stats[0].totalUsers[0]?.count || 0,
      byRole: stats[0].usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byStatus: stats[0].usersByStatus.reduce((acc, item) => {
        acc[item._id ? 'active' : 'inactive'] = item.count;
        return acc;
      }, {}),
      byEmailVerification: stats[0].emailVerificationStatus.reduce((acc, item) => {
        acc[item._id ? 'verified' : 'unverified'] = item.count;
        return acc;
      }, {}),
      recentMonths: stats[0].newUsersByMonth.map(item => ({
        month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
        count: item.count
      }))
    };

    res.status(200).json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics'
    });
  }
};

// Assign applications to reviewer
export const assignApplicationsToReviewer = async (req, res) => {
  try {
    const { reviewerId, applicationIds } = req.body;

    // Check if reviewer exists and is a reviewer
    const reviewer = await User.findById(reviewerId);
    if (!reviewer || !['reviewer', 'admissions'].includes(reviewer.role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reviewer ID or reviewer role'
      });
    }

    // Check if applications exist
    const applications = await Application.find({
      _id: { $in: applicationIds },
      status: 'pending'
    });

    if (applications.length !== applicationIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some applications are invalid or not in pending status'
      });
    }

    // Assign applications to reviewer
    await User.findByIdAndUpdate(
      reviewerId,
      { $addToSet: { assignedApplications: { $each: applicationIds } } }
    );

    // Update application status to reviewing
    await Application.updateMany(
      { _id: { $in: applicationIds } },
      { status: 'reviewing' }
    );

    res.status(200).json({
      success: true,
      message: `Assigned ${applications.length} applications to reviewer`
    });
  } catch (error) {
    console.error('Assign applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning applications'
    });
  }
};

// Get reviewer's assigned applications
export const getReviewerApplications = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    // Check if user is reviewer
    const reviewer = await User.findById(id);
    if (!reviewer || !['reviewer', 'admissions'].includes(reviewer.role)) {
      return res.status(400).json({
        success: false,
        message: 'User is not a reviewer'
      });
    }

    const query = { _id: { $in: reviewer.assignedApplications } };
    if (status) query.status = status;

    const applications = await Application.find(query)
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
    console.error('Get reviewer applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviewer applications'
    });
  }
};