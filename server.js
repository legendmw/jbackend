const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');

const uri = "mongodb+srv://brianmtonga592:1Brisothi20*@cluster0.4d9rw0d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create an instance of Express
const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(express.json()); // Use built-in JSON parser

// MongoDB connection
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
  });

  

  // Multer setup for image uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = './upload/images';
      fs.exists(dir, (exist) => {
        if (!exist) {
          return fs.mkdir(dir, (error) => cb(error, dir));
        }
        return cb(null, dir);
      });
    },
    filename: (req, file, cb) => {
      cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
  });
  
  const upload = multer({ storage: storage });

  app.use('/images', express.static('upload/images'));
  

// Define Inventory schema and model
const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  stock: { type: Number, required: true },
  imageUrl: { type: String, required: true }
});

const Inventory = mongoose.model('Inventory', inventorySchema);

// Define Sale schema and model
const saleSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  quantity: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  saleDate: { type: Date, default: Date.now }
});

const Sale = mongoose.model('Sale', saleSchema);

// Fetch all products
app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new product
app.post('/api/inventory', async (req, res) => {
  console.log('Request body:', req.body); // Log the received data

  const { name, description, price, category, stock, imageUrl } = req.body;

  const newInventory = new Inventory({ name, description, price, category, stock, imageUrl });

  try {
    const savedInventory = await newInventory.save();
    res.status(201).json(savedInventory);
  } catch (err) {
    console.error('Error saving inventory:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// Fetch product by ID
app.get('/api/inventory/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Received ID:', id);

  try {
    const product = await Inventory.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update product stock
app.put('/api/inventory/:id', async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;

  try {
    if (isNaN(stock) || stock < 0) {
      return res.status(400).json({ message: 'Invalid stock value' });
    }

    const product = await Inventory.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.stock = stock;
    await product.save();
    return res.status(200).json(product);
  } catch (error) {
    console.error('Error updating stock:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Delete product by ID
app.delete('/api/inventory/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Inventory.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(`Error deleting product ${id}:`, error.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Record a sale
app.post('/api/sales', async (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity) {
    return res.status(400).json({ message: 'Product ID and quantity are required' });
  }

  if (isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ message: 'Invalid quantity sold' });
  }

  try {
    const product = await Inventory.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    product.stock -= quantity;
    await product.save();

    const sale = new Sale({ productId, quantity, sellingPrice: product.price, saleDate: new Date() });
    await sale.save();

    res.status(201).json({ message: 'Sale recorded successfully', sale });
  } catch (error) {
    console.error('Error recording sale:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch all sales
app.get('/api/sales', async (req, res) => {
  try {
    const sales = await Sale.find().populate('productId', 'name');
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
