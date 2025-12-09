import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public webhook endpoint (no authentication)
router.post('/webhook', paymentController.handleWebhook);

// Protected routes
// router.use(authenticate);

// Initialize payment
router.post('/initialize', paymentController.initializePayment);

// Verify payment
router.get('/verify', paymentController.verifyPayment);

// Get payment history
router.get('/history', paymentController.getPaymentHistory);

// Get payment details
router.get('/:paymentId', paymentController.getPaymentDetails);

// Check pending payments
router.get('/pending', paymentController.checkPendingPayments);

export default router;