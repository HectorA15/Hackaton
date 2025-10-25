const express = require('express');
const Product = require('../models/Product');
const { authenticate, authorize } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const { fetchProductByGTIN } = require('../utils/externalApi');

const router = express.Router();

// Get all products
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const products = await Product.getAll(limit, offset);
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Lookup product by GTIN (with external API)
router.get('/lookup/:gtin', authenticate, async (req, res) => {
  try {
    const { gtin } = req.params;
    
    // Check if product exists in database
    let product = await Product.findByGtin(gtin);
    
    if (product) {
      return res.json({ source: 'database', product });
    }

    // Fetch from external API
    const externalProduct = await fetchProductByGTIN(gtin);
    
    if (externalProduct) {
      // Save to database
      const productId = await Product.create(externalProduct);
      product = await Product.findById(productId);
      return res.json({ source: 'external', product });
    }

    res.status(404).json({ error: 'Product not found' });
  } catch (error) {
    console.error('Product lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup product' });
  }
});

// Create product
router.post('/', authenticate, authorize('admin', 'manager'), auditLogger('create', 'product'), async (req, res) => {
  try {
    const { gtin, name, description, manufacturer, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const productId = await Product.create({
      gtin,
      name,
      description,
      manufacturer,
      category
    });

    const product = await Product.findById(productId);
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Product with this GTIN already exists' });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', authenticate, authorize('admin', 'manager'), auditLogger('update', 'product'), async (req, res) => {
  try {
    const { name, description, manufacturer, category } = req.body;

    const changes = await Product.update(req.params.id, {
      name,
      description,
      manufacturer,
      category
    });

    if (changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = await Product.findById(req.params.id);
    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

module.exports = router;
