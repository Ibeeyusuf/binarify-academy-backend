import Paystack from 'paystack';
import crypto from 'crypto';
import dotenv from "dotenv";

dotenv.config();

const paystackClient = Paystack(process.env.PAYSTACK_SECRET_KEY);

class PaymentService {
  /**
   * Initialize a payment transaction
   */
  async initializePayment(paymentData) {
    try {
      const { email, amount, metadata } = paymentData;
      
      const response = await paystackClient.transaction.initialize({
        email,
        amount: Math.round(amount),
        metadata: JSON.stringify(metadata),
        callback_url: `${process.env.FRONTEND_URL}`
        // callback_url: `${process.env.FRONTEND_URL}/payment-verify`
      });

      return {
        success: true,
        data: {
          authorization_url: response.data.authorization_url,
          reference: response.data.reference,
          access_code: response.data.access_code
        }
      };
    } catch (error) {
      console.error('Payment initialization error:', error);
      return {
        success: false,
        error: error.message || 'Payment initialization failed'
      };
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(reference) {
    try {
      const response = await paystackClient.transaction.verify({ reference });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        success: false,
        error: error.message || 'Payment verification failed'
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    if (!process.env.PAYSTACK_WEBHOOK_SECRET) {
      console.warn('PAYSTACK_WEBHOOK_SECRET not set, skipping webhook verification');
      return true; // In development, you might want to skip
    }

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return hash === signature;
  }

  /**
   * Create a subscription plan
   */
  async createPlan(planData) {
    try {
      const response = await paystackClient.plan.create(planData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create subscription for a user
   */
  async createSubscription(subscriptionData) {
    try {
      const response = await paystackClient.subscription.create(subscriptionData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create transfer recipient
   */
  async createTransferRecipient(recipientData) {
    try {
      const response = await paystackClient.transfer_recipient.create(recipientData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Initiate transfer
   */
  async initiateTransfer(transferData) {
    try {
      const response = await paystackClient.transfer.initiate(transferData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new PaymentService();