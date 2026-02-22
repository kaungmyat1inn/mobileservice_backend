// Database Maintenance Script
// Usage:
//   node clearDatabase.js --mode=reset
//   node clearDatabase.js --mode=reset --seed-admin
//   node clearDatabase.js --mode=normalize-status

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/user");
const Job = require("./models/Job");
const Shop = require("./models/shop");
const ShopOwner = require("./models/ShopOwner");
const Expense = require("./models/Expense");

const SUPER_ADMIN_EMAIL = "digitalmart.mag@gmail.com";
const SUPER_ADMIN_PASSWORD = "123456";

const ALLOWED_JOB_STATUSES = [
  "pending",
  "progress",
  "cancel",
  "complete",
  "checked_out",
];

const parseMode = () => {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  if (!modeArg) return "reset";
  return modeArg.split("=")[1] || "reset";
};

const shouldSeedAdmin = process.argv.includes("--seed-admin");

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

async function seedSuperAdmin() {
  const existingAdmin = await User.findOne({ email: SUPER_ADMIN_EMAIL });
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, salt);

  if (existingAdmin) {
    existingAdmin.password = hashedPassword;
    existingAdmin.isSuperAdmin = true;
    existingAdmin.shopId = null;
    await existingAdmin.save();
    console.log("✅ Super admin password updated");
    return;
  }

  await User.create({
    email: SUPER_ADMIN_EMAIL,
    password: hashedPassword,
    isSuperAdmin: true,
  });
  console.log("✅ Super admin created");
}

async function resetDatabase() {
  console.log("🗑️  Resetting database (dropDatabase)...");
  await mongoose.connection.db.dropDatabase();
  console.log("✅ Database reset complete");
}

async function normalizeLegacyStatuses() {
  console.log("🔧 Normalizing legacy job statuses...");
  const jobs = await Job.find({});
  let changed = 0;

  for (const job of jobs) {
    const normalizedStatus = normalizeStatus(job.status);
    let dirty = false;

    if (job.status !== normalizedStatus) {
      job.status = normalizedStatus;
      dirty = true;
    }

    if (!Array.isArray(job.timeline)) {
      job.timeline = [];
      dirty = true;
    }

    if (Array.isArray(job.timeline)) {
      const nextTimeline = job.timeline.map((entry) => ({
        status: normalizeStatus(entry?.status),
        updatedAt: entry?.updatedAt || new Date(),
      }));
      if (JSON.stringify(nextTimeline) !== JSON.stringify(job.timeline)) {
        job.timeline = nextTimeline;
        dirty = true;
      }
    }

    if (!job.timeline.length) {
      job.timeline.push({
        status: normalizeStatus(job.status),
        updatedAt: job.createdAt || new Date(),
      });
      dirty = true;
    }

    if (!ALLOWED_JOB_STATUSES.includes(job.status)) {
      job.status = "pending";
      dirty = true;
    }

    if (job.status === "checked_out" && job.isLocked !== true) {
      job.isLocked = true;
      dirty = true;
    }

    if (dirty) {
      await job.save();
      changed += 1;
    }
  }

  console.log(`✅ Normalized jobs: ${changed}/${jobs.length}`);
}

async function run() {
  const mode = parseMode();

  if (!["reset", "normalize-status"].includes(mode)) {
    console.error(
      "❌ Invalid mode. Use --mode=reset or --mode=normalize-status",
    );
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI not found in environment");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
    console.log(`ℹ️  Mode: ${mode}`);

    if (mode === "reset") {
      await resetDatabase();
      if (shouldSeedAdmin) {
        await seedSuperAdmin();
      } else {
        console.log("ℹ️  Super admin was not seeded (use --seed-admin)");
      }
    } else {
      await normalizeLegacyStatuses();
      if (shouldSeedAdmin) {
        await seedSuperAdmin();
      }
    }

    console.log("\nDone.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

run();
