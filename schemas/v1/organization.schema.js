const mongoose = require('mongoose');


//สร้าง Collection ชื่อ organization
const organizationSchema = new mongoose.Schema({
   businessId: { type: String },
   organizationId: { type: String, unique: true }, // objectId ของ organization
   name: { type: String, required: true }, // ชื่อ organization
   email: { type: String, required: true, unique: true, match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/}, //อีเมล organization
   password: { type: String, required: true }, //รหัสผ่าน organization
   image: { type: String }, //รูปของ organization
   location: { type: String }, //ที่อยู่ของ organization
   phoneNumber: { type: String }, //เบอร์โทรศัพท์ของ organization
   organizationDescription: { type: String }, //ข้อมูลของ organization
   language: { type: String, enum: ['th', 'en'], required: true }, //ภาษาที่แสดงในแอปที่ organizations เห็น
   prizes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'prize' }], //ของรางวัลของ organizations เก็บเป็น array โดยเก็บ objectId ของ "ของรางวัล" เพื่อแสดงว่า ตอนนี้มี "ของรางวัล" อะไรอยู่บ้าง ที่ organization เพิ่มเข้าไป
});

const organization = mongoose.model('organization', organizationSchema);

module.exports = { organization };