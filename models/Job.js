const mongoose = require("mongoose");

const ALLOWED_JOB_STATUSES = [
  "pending",
  "progress",
  "cancel",
  "complete",
  "checked_out",
];

const normalizeStatus = (value) => {
  switch ((value || "").toString().trim().toLowerCase()) {
    case "pending":
      return "pending";
    case "progress":
    case "in-progress":
      return "progress";
    case "cancel":
    case "cancelled":
      return "cancel";
    case "complete":
    case "completed":
      return "complete";
    case "checked_out":
    case "checked-out":
    case "picked-up":
      return "checked_out";
    default:
      return "pending";
  }
};

const jobSchema = mongoose.Schema(
  {
    jobNo: {
      type: String,
      required: [true, "Job number is required"],
      unique: true,
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
    },
    customerPhone: {
      type: String,
      required: [true, "Customer phone is required"],
    },
    deviceModel: {
      type: String,
      required: [true, "Device model is required"],
    },
    imeiOrSn: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      default: "",
    },
    issue: {
      type: String,
      required: [true, "Issue description is required"],
    },
    partsCost: {
      type: Number,
      default: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
    },
    reserves: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    finalCost: {
      type: Number,
      default: 0,
    },
    profit: {
      type: Number,
      default: 0,
    },
    checkoutDate: {
      type: Date,
      default: null,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ALLOWED_JOB_STATUSES,
      default: "pending",
    },
    timeline: [
      {
        status: {
          type: String,
          enum: ALLOWED_JOB_STATUSES,
          required: true,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    statusLogs: [
      {
        fromStatus: {
          type: String,
          default: null,
        },
        toStatus: {
          type: String,
          required: true,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        updatedByName: {
          type: String,
          default: "System",
        },
        source: {
          type: String,
          default: "manual",
        },
      },
    ],
    customer_chat_id: {
      type: String,
      default: null,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop", // Assuming you have a Shop model
      required: true,
    },
    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
  },
  { timestamps: true },
);

jobSchema.pre("validate", function normalizeLegacyStatuses() {
  this.status = normalizeStatus(this.status);

  if (Array.isArray(this.timeline)) {
    this.timeline = this.timeline.map((entry) => ({
      status: normalizeStatus(entry?.status),
      updatedAt: entry?.updatedAt || new Date(),
    }));
  }

  if (Array.isArray(this.statusLogs)) {
    this.statusLogs = this.statusLogs.map((log) => ({
      ...(log && typeof log.toObject === "function" ? log.toObject() : log),
      fromStatus: log?.fromStatus ? normalizeStatus(log.fromStatus) : null,
      toStatus: normalizeStatus(log?.toStatus),
    }));
  }

});

jobSchema.pre("save", function ensureInitialTimeline() {
  if (this.isNew) {
    this.status = "pending";
    if (!Array.isArray(this.timeline) || this.timeline.length === 0) {
      this.timeline = [{ status: "pending", updatedAt: new Date() }];
    }
  }

  if (this.status === "checked_out") {
    this.isLocked = true;
  }
});

jobSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model("Job", jobSchema);
