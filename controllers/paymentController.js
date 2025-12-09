import Payment from '../models/payment.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import paymentService from '../services/paymentService.js';

class PaymentController {
  /**
   * Initialize payment for application
   */
  async initializePayment(req, res) {
    try {
      const { applicationId, program, track, amount, email, metadata } = req.body;
      const userId = req.user?.id;

      console.log('Payment request body:', { applicationId, program, track, amount, email }); // Debug log

      // Find application
      const application = await Application.findById(applicationId);

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found'
        });
      }

      // Check if payment already exists and is pending
      const existingPayment = await Payment.findOne({
        application: applicationId,
        status: 'pending'
      });

      if (existingPayment) {
        // Check if payment is expired
        if (existingPayment.expiresAt < new Date()) {
          existingPayment.status = 'expired';
          await existingPayment.save();
        } else {
          // Re-use existing payment
          const paymentResult = await paymentService.initializePayment({
            email,
            amount: amount * 100, // Convert to kobo
            metadata: {
              ...metadata,
              paymentId: existingPayment._id?.toString(),
              applicationId: applicationId?.toString(),
            }
          });

          if (!paymentResult.success) {
            return res.status(500).json({
              success: false,
              message: 'Payment initialization failed',
              error: paymentResult.error
            });
          }

          return res.status(200).json({
            success: true,
            message: 'Payment initialized successfully',
            data: paymentResult.data
          });
        }
      }

      // ============ FIXED SECTION ============
      // Find user with select to exclude password field
      const findUser = await User.findOne({ email })
        .select('-password -confirmPassword'); // Explicitly exclude these fields

      if (!findUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Clean the user object to remove any potential confirmPassword
      const cleanUser = findUser.toObject();
      delete cleanUser.password;
      delete cleanUser.confirmPassword;
      // ============ END FIX ============

      // Create new payment record
      const payment = await Payment.create({
        user: findUser._id,
        application: applicationId,
        track,
        program,
        amount: amount * 100, // Store in kobo
        currency: 'NGN',
        reference: `PAY-${Date.now()}-${Math.random()?.toString(36).substr(2, 9).toUpperCase()}`,
        status: 'pending',
        metadata: {
          ...metadata,
          applicationId: applicationId?.toString()
        }
      });

      // Update application with payment reference
      application.payment = payment._id;
      await application.save();

      // Initialize payment with Paystack
      const paymentResult = await paymentService.initializePayment({
        email,
        amount: amount * 100, // Convert to kobo
        metadata: {
          paymentId: payment._id?.toString(),
          applicationId: applicationId?.toString(),
          track,
          program
        }
      });

      if (!paymentResult.success) {
        await Payment.findByIdAndDelete(payment._id);
        application.payment = null;
        await application.save();
        
        return res.status(500).json({
          success: false,
          message: 'Payment initialization failed',
          error: paymentResult.error
        });
      }

      // Update payment with Paystack reference
      payment.reference = paymentResult.data.reference;
      await payment.save();

      res.status(200).json({
        success: true,
        message: 'Payment initialized successfully',
        data: paymentResult.data
      });

    } catch (error) {
      console.error('Initialize payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Verify payment
   */
  async verifyPayment(req, res) {
    try {
      const { reference } = req.query;

      if (!reference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference is required'
        });
      }

      // Find payment
      const payment = await Payment.findOne({ reference })
        .populate({
          path: 'user',
          select: '-password -confirmPassword' // Fix: Exclude problematic fields
        })
        .populate('application');

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Check if already verified
      if (payment.verified) {
        return res.status(200).json({
          success: true,
          message: 'Payment already verified',
          data: { payment }
        });
      }

      // Verify with Paystack
      const verificationResult = await paymentService.verifyPayment(reference);

      if (!verificationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed',
          error: verificationResult.error
        });
      }

      const verificationData = verificationResult.data;

      // Update payment record
      payment.status = verificationData.status === 'success' ? 'success' : 'failed';
      payment.paidAt = new Date(verificationData.paid_at);
      payment.verified = true;
      payment.metadata.paystackData = verificationData;
      await payment.save();

      if (payment.status === 'success') {
        // Update application status
        await Application.findByIdAndUpdate(payment.application._id, {
          status: 'enrolled',
          paymentStatus: 'paid'
        });

        // Update user (use findByIdAndUpdate to avoid validation)
        await User.findByIdAndUpdate(payment.user._id, {
          $addToSet: { enrolledPrograms: payment.application._id }
        }, { runValidators: false }); // Important: Skip validation

        return res.status(200).json({
          success: true,
          message: 'Payment verified successfully',
          data: {
            payment,
            redirectUrl: `${process.env.FRONTEND_URL}/dashboard`
          }
        });
      } else {
        await Application.findByIdAndUpdate(payment.application._id, {
          paymentStatus: 'failed'
        });

        return res.status(400).json({
          success: false,
          message: 'Payment was not successful',
          data: { payment }
        });
      }

    } catch (error) {
      console.error('Verify payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Get user payment history
   */
  async getPaymentHistory(req, res) {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 10 } = req.query;

      const payments = await Payment.find({ user: userId })
        .populate({
          path: 'application',
          select: 'program track createdAt'
        })
        .populate({
          path: 'user',
          select: '-password -confirmPassword' // Fix: Exclude problematic fields
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Payment.countDocuments({ user: userId });

      res.status(200).json({
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
      console.error('Get payment history error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(req, res) {
    try {
      const { paymentId } = req.params;
      const userId = req.user?.id;

      const payment = await Payment.findOne({
        _id: paymentId,
        user: userId
      }).populate({
        path: 'application user',
        select: '-password -confirmPassword' // Fix: Exclude problematic fields
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.status(200).json({
        success: true,
        data: { payment }
      });

    } catch (error) {
      console.error('Get payment details error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Handle Paystack webhook
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['x-paystack-signature'];
      const payload = req.body;

      // Verify webhook signature
      const isValid = paymentService.verifyWebhookSignature(payload, signature);
      
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }

      const event = payload.event;
      const data = payload.data;

      switch (event) {
        case 'charge.success':
          await this.processSuccessfulCharge(data);
          break;
        
        case 'transfer.success':
          await this.processSuccessfulTransfer(data);
          break;
        
        case 'invoice.payment_failed':
          await this.processFailedPayment(data);
          break;
        
        default:
          console.log(`Unhandled event type: ${event}`);
      }

      res.status(200).json({ success: true });

    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Process successful charge from webhook
   */
  async processSuccessfulCharge(data) {
    try {
      const { reference, metadata } = data;
      
      // Parse metadata if it's a string
      const paymentMetadata = typeof metadata === 'string' 
        ? JSON.parse(metadata) 
        : metadata;

      // Find payment by reference
      const payment = await Payment.findOne({ reference })
        .populate({
          path: 'user',
          select: '-password -confirmPassword' // Fix: Exclude problematic fields
        })
        .populate('application');

      if (!payment) {
        console.error('Payment not found for reference:', reference);
        return;
      }

      // Update payment
      payment.status = 'success';
      payment.paidAt = new Date(data.paid_at);
      payment.verified = true;
      payment.metadata.paystackWebhookData = data;
      await payment.save();

      // Update application status
      if (payment.application) {
        await Application.findByIdAndUpdate(payment.application._id, {
          status: 'enrolled',
          paymentStatus: 'paid'
        });
      }

      // Update user (skip validation to avoid confirmPassword issues)
      await User.findByIdAndUpdate(payment.user._id, {
        $addToSet: { enrolledPrograms: payment.application?._id }
      }, { runValidators: false });

      console.log(`Payment ${reference} processed successfully`);

    } catch (error) {
      console.error('Process charge error:', error);
      throw error;
    }
  }

  /**
   * Check pending payments
   */
  async checkPendingPayments(req, res) {
    try {
      const userId = req.user?.id;

      const pendingPayments = await Payment.find({
        user: userId,
        status: 'pending',
        expiresAt: { $gt: new Date() }
      }).populate({
        path: 'application',
        select: 'program track'
      }).populate({
        path: 'user',
        select: '-password -confirmPassword' // Fix: Exclude problematic fields
      });

      res.status(200).json({
        success: true,
        data: { pendingPayments }
      });

    } catch (error) {
      console.error('Check pending payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }
}

export default new PaymentController();