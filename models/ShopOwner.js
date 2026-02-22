const mongoose = require("mongoose");

const shopOwnerSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    expiresAt: { type: Date, required: true },
    telegram_chat_id: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ShopOwner", shopOwnerSchema);
