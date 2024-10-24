const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// MongoDB URI (update as necessary)
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
        return fs.mkdir(dir, { recursive: true }, (error) => cb(error, dir));
      }
      return cb(null, dir);
    });
  },
  filename: (req, file, cb) => {
    const uniqueName = `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// Serve static files for images
app.use('/images', express.static(path.join(__dirname, 'upload/images')));

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

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  coordinates: { type: String, required: true }, // Use the term 'coordinates'
});

const Location = mongoose.model("Location", locationSchema);

// POST route to save the location
app.post("/api/locations", async (req, res) => {
  const { name, location } = req.body; // Accept 'location' from frontend

  if (!name || !location) {
    return res.status(400).json({ error: "Name and coordinates are required" });
  }

  try {
    const newLocation = new Location({ name, coordinates: location }); // Save 'location' as 'coordinates'
    await newLocation.save();
    res
      .status(201)
      .json({ message: "Location saved successfully", location: newLocation });
  } catch (error) {
    console.error("Error saving location:", error);
    res.status(500).json({ error: "Error saving location" });
  }
});

app.get("/api/locations", async (req, res) => {
  try {
    const locations = await Location.find(); // Fetch all locations from the database
    res.status(200).json(locations); // Send the list of locations as JSON
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: "Error fetching locations" }); // Handle errors
  }
});

// Add a new product with image upload
app.post('/api/inventory', upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;
    
    // Check if the image was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Image upload failed' });
    }

    const imageUrl = `/images/${req.file.filename}`;

    // Validate all other fields
    if (!name || !description || !price || !category || !stock) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const newInventory = new Inventory({
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      imageUrl,
    });

    const savedInventory = await newInventory.save();
    res.status(201).json(savedInventory);
  } catch (err) {
    console.error('Error saving inventory:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// Fetch all products
app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fetch product by ID
app.get('/api/inventory/:id', async (req, res) => {
  const { id } = req.params;
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
