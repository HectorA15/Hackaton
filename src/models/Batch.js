const db = require('../db/connection');

class Batch {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO batches 
        (product_id, batch_number, manufacturing_date, expiry_date, quantity, priority_level) 
        VALUES (?, ?, ?, ?, ?, ?)`;
      db.run(sql, [
        data.product_id, 
        data.batch_number, 
        data.manufacturing_date, 
        data.expiry_date, 
        data.quantity || 0,
        data.priority_level || 0
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT b.*, p.name as product_name, p.gtin 
        FROM batches b 
        JOIN products p ON b.product_id = p.id 
        WHERE b.id = ?`;
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAll(options = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT b.*, p.name as product_name, p.gtin,
          COUNT(i.id) as item_count
        FROM batches b 
        JOIN products p ON b.product_id = p.id 
        LEFT JOIN inventory_items i ON b.id = i.batch_id AND i.status = 'in_stock'
        WHERE 1=1`;
      
      const params = [];
      
      if (options.expired !== undefined) {
        sql += ' AND b.is_expired = ?';
        params.push(options.expired ? 1 : 0);
      }

      sql += ' GROUP BY b.id ORDER BY b.expiry_date ASC';

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

  static updateExpiredStatus() {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE batches SET is_expired = 1 WHERE expiry_date < date('now') AND is_expired = 0`;
      db.run(sql, [], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static updateQuantity(id, quantity) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE batches SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      db.run(sql, [quantity, id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static calculatePriority(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE batches 
        SET priority_level = CASE
          WHEN julianday(expiry_date) - julianday('now') < 7 THEN 3
          WHEN julianday(expiry_date) - julianday('now') < 30 THEN 2
          WHEN julianday(expiry_date) - julianday('now') < 90 THEN 1
          ELSE 0
        END,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      db.run(sql, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }
}

module.exports = Batch;
