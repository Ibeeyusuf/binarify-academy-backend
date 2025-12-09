import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  track: {
    type: String,
    required: true
  },
  program: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'cancelled', 'expired'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: 'paystack'
  },
  metadata: {
    type: Object,
    default: {}
  },
  paidAt: {
    type: Date
  },
  verified: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 24*60*60*1000) // 24 hours from now
  }
}, {
  timestamps: true
});

// Index for faster queries
paymentSchema.index({ reference: 1 });
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ createdAt: 1 });
// Remove or fix the TTL index - it was set to expire immediately (0 seconds)
// paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Payment = mongoose.models.Payment ||  mongoose.model('Payment', paymentSchema);

export default Payment;