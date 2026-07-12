const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'business'],
    default: 'free',
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual'],
    default: 'monthly',
  },
  screenshotsThisMonth: {
    type: Number,
    default: 0,
  },
  screenshotsResetDate: {
    type: Date,
    default: () => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    },
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  paymentProvider: {
    type: String,
    enum: ['paystack', 'stripe', null],
    default: null,
  },
  paystackCustomerId: { type: String, default: null },
  paystackSubscriptionCode: { type: String, default: null },
  stripeCustomerId: { type: String, default: null },
  stripeSubscriptionId: { type: String, default: null },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'past_due'],
    default: 'inactive',
  },
  subscriptionStartDate: { type: Date, default: null },
  subscriptionEndDate: { type: Date, default: null },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verifyToken: {
    type: String,
    default: null,
  },
  verifyTokenExpiry: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
