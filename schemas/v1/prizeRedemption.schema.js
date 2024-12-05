const mongoose = require('mongoose');


// สร้าง Collection ชื่อ prize
const prizeRedemptionSchema = new mongoose.Schema({
    businessId: { type: String },
    prizeRedemptionId: { type: String, unique: true }, // objectId การแลก "ของรางวัล"
    prizeId: { type: mongoose.Schema.Types.ObjectId, ref: 'prize', required: true }, // objectId ของ "ของรางวัล" ที่ทำการแลก
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true }, // objectId ของ users ที่ทำการแลก
    amount: { type: Number, required: true }, // จำนวน "ของรางวัล" ที่ทำการแลก
    points: { type: Number, required: true }, // points ที่ใช้
    timestamp: { type: Date, default: Date.now } // เวลาที่ทำการแลก
 });

 const prizeRedemption = mongoose.model('prizeRedemption', prizeRedemptionSchema);

 module.exports = { prizeRedemption };