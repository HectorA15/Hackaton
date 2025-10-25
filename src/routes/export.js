const express = require('express');
const { authenticate } = require('../middleware/auth');
const { exportInventoryToCSV } = require('../utils/csvExport');

const router = express.Router();

// Export inventory to CSV
router.get('/inventory', authenticate, async (req, res) => {
  try {
    const options = {
      status: req.query.status,
      expired: req.query.expired === 'true' ? true : req.query.expired === 'false' ? false : undefined
    };

    const csv = await exportInventoryToCSV(options);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
