const mongoose = require('mongoose');

// สร้าง Schema สำหรับสินค้า
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true }, // ชื่อสินค้า
  price: { type: Number, required: true }, // ราคาสินค้า
  description: { type: String }, // รายละเอียดสินค้า
  category: { type: String }, // หมวดหมู่สินค้า
  stock: { type: Number, default: 0 }, // จำนวนสินค้าในคลัง
  createdAt: { type: Date, default: Date.now }, // วันที่สร้าง
});

// สร้าง Model
const Product = mongoose.model('Product', ProductSchema);

module.exports = Product;
