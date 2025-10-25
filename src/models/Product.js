const db = require('../db/connection');

class Product {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO products (gtin, name, description, manufacturer, category) VALUES (?, ?, ?, ?, ?)';
      db.run(sql, [data.gtin, data.name, data.description, data.manufacturer, data.category], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static findByGtin(gtin) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM products WHERE gtin = ?';
      db.get(sql, [gtin], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM products WHERE id = ?';
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAll(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM products ORDER BY name LIMIT ? OFFSET ?';
      db.all(sql, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static update(id, data) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE products SET name = ?, description = ?, manufacturer = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      db.run(sql, [data.name, data.description, data.manufacturer, data.category, id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }
}

module.exports = Product;
