const Product = require('../schemas/v1/products');

// สร้างสินค้า (Create)
exports.createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).send(product);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

// อ่านสินค้าทั้งหมด (Read All)
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.send(products);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// อ่านสินค้าชิ้นเดียว (Read One)
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send({ message: 'Product not found' });
    res.send(product);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// อัพเดทสินค้า (Update)
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).send({ message: 'Product not found' });
    res.send(product);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

// ลบสินค้า (Delete)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).send({ message: 'Product not found' });
    res.send({ message: 'Product deleted', product });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};
