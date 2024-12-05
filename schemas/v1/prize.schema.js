const mongoose = require("mongoose");

// สร้าง Collection ชื่อ prize
const prizeSchema = new mongoose.Schema({
  businessId: { type: String },
  prizeId: { type: String, unique: true }, // objectId ของ "ของรางวัล" ที่ทำการแลก
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "organization",
    required: true,
  }, // objectId ของ organization ที่เป็นคนลง "ของรางวัล"
  name: { type: String, required: true }, // ชื่อ "ของรางวัล"
  image: { type: String, required: true }, // รูป "ของรางวัล"
  description: { type: String, required: true }, // ข้อมูล "ของรางวัล"
  maxAmount: { type: Number, required: true }, // จำนวน "ของรางวัล" สุงสุด
  amount: { type: Number, required: true }, // จำนวน "ของรางวัล"
  requiredPoints: { type: Number, required: true }, // points ที่ต้องใช้ในการแลก "ของรางวัล" ต่อ 1 ชิ้น
  timestamp: { type: date, default: Date.now }, // เวลาที่เพิ่มของรางวัล
  conditions: [
    {
      requiredActivity: { type: Number, required: true }, // จำนวน activity ที่ต้องทำ
      activityCompleted: { type: Number, required: true }, // จำนวน activity ทำไปแล้ว
      maxRedemption: { type: Number, required: true }, // 1 คนแลก "ของรางวัล" ได้กี่ชิ้น
    },
  ], // เงื่อนไขในการแลก "ของรางวัล"
});

const prize = mongoose.model("prize", prizeSchema);

module.exports = { prize };
