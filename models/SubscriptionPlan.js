const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "MMK",
    },
    durationDays: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
    },
    maxStaffAllowed: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for faster queries
subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

