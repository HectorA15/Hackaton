const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get audit logs (admin and manager only)
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    const options = {
      user_id: req.query.user_id,
      entity_type: req.query.entity_type,
      entity_id: req.query.entity_id,
      limit: parseInt(req.query.limit) || 100
    };

    const logs = await AuditLog.getAll(options);
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
