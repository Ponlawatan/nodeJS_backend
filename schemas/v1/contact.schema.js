const mongoose = require("mongoose");


const contactInfoSchema = new mongoose.Schema({
  businessId: { type: String },
  platform: {
    type: String,
    enum: ["facebook", "email", "phone", "line", "twitter", "instagram", "tiktok", "lemon8", "other"],
  },
  platformName: {
    type: String, // ชื่อที่แสดงบนแพลตฟอร์ม
  },
  link: {
    type: String,
  },
  isPrimary: {
    type: Boolean,
    default: false, // ระบุว่าเป็น contact หลักหรือไม่
  },
});

module.exports = contactInfoSchema;
