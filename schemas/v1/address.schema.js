const mongoose = require("mongoose");


const addressSchema = new mongoose.Schema({
  businessId: { type: String },
  address: {
    type: String, // ชื่อถนน
  },
  city: {
    type: String, // ชื่อเมือง
  },
  province: {
    type: String, // ชื่อจังหวัด
  },
  postalCode: {
    type: String,
    match: /^\d{5}$/, // รูปแบบรหัสไปรษณีย์ (5 หลัก)
  },
  country: {
    type: String, // ชื่อประเทศ
  },
  description: {
    type: String, // ชื่อประเทศ
  },
});

module.exports = addressSchema;
