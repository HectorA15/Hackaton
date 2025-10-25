const express = require('express');
const Batch = require('../models/Batch');
const Product = require('../models/Product');
const { authenticate, authorize } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');

const router = express.Router();

// Get all batches
router.get('/', authenticate, async (req, res) => {
  try {
    const options = {
      expired: req.query.expired === 'true' ? true : req.query.expired === 'false' ? false : undefined,
      limit: parseInt(req.query.limit) || undefined
    };
    
    const batches = await Batch.getAll(options);
    res.json(batches);
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// Get batch by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    console.error('Get batch error:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

// Create batch
router.post('/', authenticate, authorize('admin', 'manager'), auditLogger('create', 'batch'), async (req, res) => {
  try {
    const { product_id, batch_number, manufacturing_date, expiry_date, quantity, priority_level } = req.body;

    if (!product_id || !batch_number || !expiry_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify product exists
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const batchId = await Batch.create({
      product_id,
      batch_number,
      manufacturing_date,
      expiry_date,
      quantity,
      priority_level
    });

    // Calculate priority based on expiry date
    await Batch.calculatePriority(batchId);

    const batch = await Batch.findById(batchId);
    res.status(201).json(batch);
  } catch (error) {
    console.error('Create batch error:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Batch with this number already exists for this product' });
    }
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// Update expired batches
router.post('/update-expired', authenticate, async (req, res) => {
  try {
    const changes = await Batch.updateExpiredStatus();
    res.json({ 
      message: 'Expired batches updated',
      updated: changes 
    });
  } catch (error) {
    console.error('Update expired error:', error);
    res.status(500).json({ error: 'Failed to update expired batches' });
  }
});

module.exports = router;
