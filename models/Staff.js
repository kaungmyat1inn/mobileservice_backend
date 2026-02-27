const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Staff name is required"],
      trim: true,
    },
    role: {
      type: String,
      required: [true, "Staff role is required"],
      enum: ["Technician", "Admin", "Manager", "Helper", "Other"],
      default: "Technician",
    },
    phone: {
      type: String,
      trim: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

staffSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model("Staff", staffSchema);
