const db = require('../db/connection');

/**
 * Export data to CSV format
 */
function exportToCSV(data, columns) {
  if (!data || data.length === 0) {
    return '';
  }

  // Header row
  const header = columns.join(',');
  
  // Data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col];
      // Escape quotes and wrap in quotes if contains comma or quote
      if (value === null || value === undefined) return '';
      const strValue = String(value);
      if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Export inventory items to CSV
 */
async function exportInventoryToCSV(options = {}) {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        i.id,
        i.barcode,
        i.qr_code,
        i.status,
        i.location,
        p.name as product_name,
        p.gtin,
        p.manufacturer,
        b.batch_number,
        b.manufacturing_date,
        b.expiry_date,
        b.is_expired,
        b.priority_level,
        i.created_at
      FROM inventory_items i
      JOIN batches b ON i.batch_id = b.id
      JOIN products p ON b.product_id = p.id
      WHERE 1=1`;
    
    const params = [];

    if (options.status) {
      sql += ' AND i.status = ?';
      params.push(options.status);
    }

    if (options.expired !== undefined) {
      sql += ' AND b.is_expired = ?';
      params.push(options.expired ? 1 : 0);
    }

    sql += ' ORDER BY b.expiry_date ASC';

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const columns = [
          'id', 'barcode', 'qr_code', 'status', 'location',
          'product_name', 'gtin', 'manufacturer',
          'batch_number', 'manufacturing_date', 'expiry_date',
          'is_expired', 'priority_level', 'created_at'
        ];
        const csv = exportToCSV(rows, columns);
        resolve(csv);
      }
    });
  });
}

module.exports = {
  exportToCSV,
  exportInventoryToCSV
};
