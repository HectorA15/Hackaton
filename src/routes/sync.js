const express = require('express');
const db = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Sync offline changes
router.post('/sync', authenticate, async (req, res) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'Operations must be an array' });
    }

    const results = {
      synced: [],
      conflicts: [],
      errors: []
    };

    for (const op of operations) {
      try {
        // Add to sync queue
        const sql = `INSERT INTO sync_queue 
          (user_id, operation, entity_type, entity_data, sync_status) 
          VALUES (?, ?, ?, ?, 'pending')`;
        
        await new Promise((resolve, reject) => {
          db.run(sql, [
            req.user.id,
            op.operation,
            op.entity_type,
            JSON.stringify(op.data)
          ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });

        // Process the operation
        // This is a simplified implementation
        // In production, you would implement conflict resolution logic
        results.synced.push({
          operation: op.operation,
          entity_type: op.entity_type,
          status: 'synced'
        });
      } catch (error) {
        results.errors.push({
          operation: op.operation,
          error: error.message
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync operations' });
  }
});

// Get pending sync operations
router.get('/pending', authenticate, async (req, res) => {
  try {
    const sql = `
      SELECT * FROM sync_queue 
      WHERE user_id = ? AND sync_status = 'pending'
      ORDER BY created_at ASC
    `;

    db.all(sql, [req.user.id], (err, rows) => {
      if (err) {
        console.error('Get pending sync error:', err);
        return res.status(500).json({ error: 'Failed to fetch pending operations' });
      }
      res.json(rows);
    });
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ error: 'Failed to fetch pending operations' });
  }
});

module.exports = router;
