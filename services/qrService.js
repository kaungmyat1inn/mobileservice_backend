const crypto = require("crypto");

const BOT_USERNAME = "mobilepro_bot";

const buildQrLink = (payload) => `https://t.me/${BOT_USERNAME}?start=${payload}`;

const generateJobQrPayload = (jobId) => `job_${jobId}`;

const generateOwnerToken = () => crypto.randomBytes(24).toString("hex");

const generateOwnerQrPayload = (token) => `owner_${token}`;

module.exports = {
  buildQrLink,
  generateJobQrPayload,
  generateOwnerToken,
  generateOwnerQrPayload,
};
