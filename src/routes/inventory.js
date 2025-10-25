const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const InventoryItem = require('../models/InventoryItem');
const Batch = require('../models/Batch');
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const { parseQRCode } = require('../utils/externalApi');
const config = require('../config');

const router = express.Router();

// Setup multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = config.uploadPath;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'label-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Get all inventory items
router.get('/', authenticate, async (req, res) => {
  try {
    const options = {
      status: req.query.status,
      batch_id: req.query.batch_id,
      limit: parseInt(req.query.limit) || undefined
    };
    
    const items = await InventoryItem.getAll(options);
    res.json(items);
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
});

// Get item by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
});

// Scan and create inventory item
router.post('/scan', authenticate, auditLogger('scan', 'inventory'), async (req, res) => {
  try {
    const { barcode, qr_code, batch_id, location, notes } = req.body;

    if (!batch_id && !barcode && !qr_code) {
      return res.status(400).json({ error: 'At least batch_id or barcode/qr_code is required' });
    }

    let finalBatchId = batch_id;
    let parsedData = null;

    // Parse QR code if provided
    if (qr_code) {
      parsedData = parseQRCode(qr_code);
    }

    // If batch_id not provided, try to find or create batch
    if (!finalBatchId && (barcode || qr_code)) {
      // This is a simplified implementation
      // In production, you would implement more sophisticated logic
      return res.status(400).json({ 
        error: 'Batch ID is required. Please scan product first to get batch information.',
        parsedData 
      });
    }

    // Verify batch exists
    const batch = await Batch.findById(finalBatchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const itemId = await InventoryItem.create({
      batch_id: finalBatchId,
      barcode,
      qr_code,
      location,
      notes,
      scanned_by: req.user.id
    });

    const item = await InventoryItem.findById(itemId);
    res.status(201).json({ 
      item,
      parsedData 
    });
  } catch (error) {
    console.error('Scan item error:', error);
    res.status(500).json({ error: 'Failed to scan item' });
  }
});

// Update item status
router.patch('/:id/status', authenticate, auditLogger('update_status', 'inventory'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['in_stock', 'shipped', 'expired', 'damaged'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const changes = await InventoryItem.updateStatus(req.params.id, status, req.user.id);
    
    if (changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = await InventoryItem.findById(req.params.id);
    res.json(item);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update item status' });
  }
});

// Upload label photo
router.post('/:id/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const itemId = parseInt(req.params.id);
    
    // Validate item ID
    if (isNaN(itemId)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    // Verify item exists
    const item = await InventoryItem.findById(itemId);
    if (!item) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Sanitize file path to prevent directory traversal
    const fileName = path.basename(req.file.filename);
    const safePath = path.join(config.uploadPath, fileName);

    // Save photo record
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO label_photos (inventory_item_id, file_path, uploaded_by) VALUES (?, ?, ?)';
      db.run(sql, [itemId, safePath, req.user.id], function(err) {
        if (err) {
          reject(err);
        } else {
          res.json({
            message: 'Photo uploaded successfully',
            photoId: this.lastID,
            path: safePath
          });
        }
      });
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Failed to delete file:', e);
      }
    }
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Get photos for item
router.get('/:id/photos', authenticate, async (req, res) => {
  try {
    const sql = `
      SELECT lp.*, u.username as uploaded_by_user
      FROM label_photos lp
      LEFT JOIN users u ON lp.uploaded_by = u.id
      WHERE lp.inventory_item_id = ?
      ORDER BY lp.created_at DESC
    `;
    
    db.all(sql, [req.params.id], (err, rows) => {
      if (err) {
        console.error('Get photos error:', err);
        return res.status(500).json({ error: 'Failed to fetch photos' });
      }
      res.json(rows);
    });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

module.exports = router;
