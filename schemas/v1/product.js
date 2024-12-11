const mongoose = require("mongoose");

// สร้าง schema สำหรับสินค้า
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// สร้าง model
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
