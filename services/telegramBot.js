const { Telegraf } = require("telegraf");
const cron = require("node-cron");

const Job = require("../models/Job");
const ShopOwner = require("../models/ShopOwner");
const Shop = require("../models/shop");

let bot = null;

const BOT_USERNAME = "mobilepro_bot";

const isOlderThan = (date, days) => {
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date < limit;
};

const formatAmount = (value) =>
  `${Number(value || 0).toLocaleString("en-US")} MMK`;

const buildReceiptText = ({ job, shop }) => {
  const createdAt = job.createdAt
    ? new Date(job.createdAt).toLocaleString("en-GB")
    : "";
  const lines = [
    shop?.shopName || "Shop",
    shop?.address ? shop.address : "",
    shop?.phone ? `Phone: ${shop.phone}` : "",
    "------------------------------",
    `Job No: ${job.jobNo || job._id}`,
    createdAt ? `Date: ${createdAt}` : "",
    "------------------------------",
    `Customer: ${job.customerName}`,
    `Phone: ${job.customerPhone}`,
    `Device: ${job.deviceModel}`,
    `Issue: ${job.issue}`,
    "------------------------------",
    `ပစ္စည်းဖိုး: ${formatAmount(job.partsCost)}`,
    `ဆားဗစ်ခ: ${formatAmount(job.serviceFee)}`,
    `စရံငွေ: ${formatAmount(job.reserves)}`,
    `ကျသင့်ငွေ: ${formatAmount(job.totalAmount)}`,
    `Status: ${job.status}`,
    "------------------------------",
  ].filter(Boolean);

  return lines.join("\n");
};

const startBot = (token) => {
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN missing. Bot not started.");
    return null;
  }

  bot = new Telegraf(token);

  bot.start(async (ctx) => {
    try {
      const payload = (ctx.startPayload || "").trim();
      if (!payload) {
        await ctx.reply(
          "Welcome to Mobile Service Bot. Please scan a valid QR code.",
        );
        return;
      }

      if (payload.startsWith("job_")) {
        const jobId = payload.replace("job_", "");
        const job = await Job.findById(jobId);
        if (!job) {
          await ctx.reply("Job not found.");
          return;
        }

        if (isOlderThan(job.createdAt, 30)) {
          await ctx.reply("This job link has expired.");
          return;
        }

        job.customer_chat_id = ctx.chat.id.toString();
        await job.save();

        const shop = await Shop.findById(job.shopId);
        await ctx.reply(buildReceiptText({ job, shop }));
        return;
      }

      if (payload.startsWith("owner_")) {
        const tokenValue = payload.replace("owner_", "");
        const ownerToken = await ShopOwner.findOne({ token: tokenValue });
        if (!ownerToken) {
          await ctx.reply("Invalid owner token.");
          return;
        }

        if (ownerToken.expiresAt < new Date()) {
          await ctx.reply("Owner login link has expired.");
          return;
        }

        ownerToken.telegram_chat_id = ctx.chat.id.toString();
        await ownerToken.save();

        await ctx.reply(
          "Admin Login Successful. You will receive daily reports.",
        );
        return;
      }

      await ctx.reply("Invalid QR payload.");
    } catch (err) {
      console.error("Bot /start error:", err);
      await ctx.reply("Something went wrong. Please try again.");
    }
  });

  bot.launch();

  cron.schedule("0 21 * * *", async () => {
    try {
      await sendDailyReports();
    } catch (err) {
      console.error("Daily report cron error:", err);
    }
  });

  return bot;
};

const sendMessage = async (chatId, text) => {
  if (!bot || !chatId) return;
  await bot.telegram.sendMessage(chatId, text);
};

const notifyJobStatusChange = async (job) => {
  if (!job.customer_chat_id) return;
  const shop = await Shop.findById(job.shopId);
  const receipt = buildReceiptText({ job, shop });
  if (job.status === "complete") {
    await sendMessage(
      job.customer_chat_id,
      `မိတ်ဆွေရဲ့ဖုန်းကို ပြင်ဆင်ပြီးပါပြီ။\n${receipt}`,
    );
    return;
  }
};

const sendDailyReports = async () => {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  );

  const owners = await ShopOwner.find({
    telegram_chat_id: { $ne: null },
  });

  for (const owner of owners) {
    const shopId = owner.shopId;
    const jobs = await Job.find({
      shopId,
      createdAt: { $gte: start, $lt: end },
    });

    const totalJobs = jobs.length;
    const income = jobs.reduce((sum, j) => sum + (j.totalAmount || 0), 0);
    const pendingJobs = jobs.filter((j) => j.status !== "complete").length;

    const msg = `နေ့စဉ်အစီရင်ခံစာ\nTotalJobs: ${totalJobs}\nIncome: ${income}`;
    await sendMessage(owner.telegram_chat_id, msg);
  }
};

module.exports = {
  startBot,
  sendMessage,
  notifyJobStatusChange,
  sendDailyReports,
  BOT_USERNAME,
};
