const db = require('../db/connection');

class InventoryItem {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO inventory_items 
        (batch_id, barcode, qr_code, status, location, notes, scanned_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [
        data.batch_id,
        data.barcode,
        data.qr_code,
        data.status || 'in_stock',
        data.location,
        data.notes,
        data.scanned_by
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT i.*, b.batch_number, b.expiry_date, b.is_expired,
          p.name as product_name, p.gtin,
          u.username as scanned_by_user
        FROM inventory_items i
        JOIN batches b ON i.batch_id = b.id
        JOIN products p ON b.product_id = p.id
        LEFT JOIN users u ON i.scanned_by = u.id
        WHERE i.id = ?`;
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAll(options = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT i.*, b.batch_number, b.expiry_date, b.is_expired, b.priority_level,
          p.name as product_name, p.gtin
        FROM inventory_items i
        JOIN batches b ON i.batch_id = b.id
        JOIN products p ON b.product_id = p.id
        WHERE 1=1`;
      
      const params = [];

      if (options.status) {
        sql += ' AND i.status = ?';
        params.push(options.status);
      }

      if (options.batch_id) {
        sql += ' AND i.batch_id = ?';
        params.push(options.batch_id);
      }

      sql += ' ORDER BY b.expiry_date ASC, b.priority_level DESC';

      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static updateStatus(id, status, userId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE inventory_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      db.run(sql, [status, id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static findByBarcode(barcode) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT i.*, b.batch_number, b.expiry_date, b.is_expired,
          p.name as product_name, p.gtin
        FROM inventory_items i
        JOIN batches b ON i.batch_id = b.id
        JOIN products p ON b.product_id = p.id
        WHERE i.barcode = ?`;
      db.get(sql, [barcode], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = InventoryItem;
