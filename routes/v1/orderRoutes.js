const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/orderControllers');

// CRUD Routes
router.post('/', orderController.createOrder);  // สร้างออร์เดอร์
router.get('/', orderController.getAllOrders);  // อ่านออร์เดอร์ทั้งหมด
router.get('/:orderId', orderController.getOrderById);  // อ่านออร์เดอร์ตาม ID
router.get('/user/:userId', orderController.getOrdersByUser);  // อ่านออร์เดอร์ของผู้ใช้คนหนึ่ง
router.put('/:orderId', orderController.updateOrder);  // อัพเดทออร์เดอร์
router.delete('/:orderId', orderController.deleteOrder);  // ลบออร์เดอร์

module.exports = router;
