// backend/routes/dashboardRoutes.js
import express from 'express';
const DashboardRoutes = express.Router();
import dashboardController from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

// User dashboard routes
DashboardRoutes.get('/stats', authenticate, dashboardController.getUserStats);
DashboardRoutes.get('/admin/stats', authenticate, authorize('admin'), dashboardController.getAdminStats);
DashboardRoutes.get('/admin/analytics', authenticate, authorize('admin'), dashboardController.getAnalytics);

export default DashboardRoutes;