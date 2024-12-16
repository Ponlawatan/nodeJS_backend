const express = require('express');
const router = express.Router();
const productController = require('../../controllers/productController');

// สร้างสินค้า
router.post('/', productController.createProduct);

// อ่านสินค้าทั้งหมด
router.get('/', productController.getAllProducts);

// อ่านสินค้าชิ้นเดียว
router.get('/:id', productController.getProductById);

// อัพเดทสินค้า
router.put('/:id', productController.updateProduct);

// ลบสินค้า
router.delete('/:id', productController.deleteProduct);

module.exports = router;

