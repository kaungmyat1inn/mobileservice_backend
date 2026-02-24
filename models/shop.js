const mongoose = require("mongoose");

// Subscription class constants
const SUBSCRIPTION_CLASSES = {
  Basic: { defaultStaff: 1, label: 'Basic' },
  Pro: { defaultStaff: 10, label: 'Pro' },
  ProMax: { defaultStaff: 10000, label: 'Pro Max' },
};

const shopSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true },
    ownerName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    address: String,
    securityPinHash: { type: String, default: null },
    logoUrl: { type: String, default: null }, // Shop Logo URL
    customRule: { type: String, default: '' }, // Custom Rule for printing
    isActive: { type: Boolean, default: true },
    subscriptionStart: { type: Date, default: Date.now },
    subscriptionExpire: { type: Date, required: true },
    subscriptionPlan: {
      type: String,
      default: "trial",
    },
    // New: Subscription Class for feature limits (decoupled from time duration)
    subscriptionClass: {
      type: String,
      default: 'Basic',
    },
    // Staff limit - can be overridden manually
    maxStaffAllowed: {
      type: Number,
      default: 1,
      min: 1,
    },
    paymentHistory: [
      {
        planName: String,
        price: Number,
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Helper method to check if subscription is active
shopSchema.methods.isSubscriptionActive = function () {
  return this.isActive && new Date() < new Date(this.subscriptionExpire);
};

// Export subscription class constants for use in controllers
module.exports = mongoose.model("Shop", shopSchema);
module.exports.SUBSCRIPTION_CLASSES = SUBSCRIPTION_CLASSES;
