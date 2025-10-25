const db = require('../db/connection');

class AuditLog {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO audit_logs 
        (user_id, action, entity_type, entity_id, changes, ip_address) 
        VALUES (?, ?, ?, ?, ?, ?)`;
      db.run(sql, [
        data.user_id,
        data.action,
        data.entity_type,
        data.entity_id,
        JSON.stringify(data.changes),
        data.ip_address
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static getAll(options = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT a.*, u.username 
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1`;
      
      const params = [];

      if (options.user_id) {
        sql += ' AND a.user_id = ?';
        params.push(options.user_id);
      }

      if (options.entity_type) {
        sql += ' AND a.entity_type = ?';
        params.push(options.entity_type);
      }

      if (options.entity_id) {
        sql += ' AND a.entity_id = ?';
        params.push(options.entity_id);
      }

      sql += ' ORDER BY a.created_at DESC';

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
}

module.exports = AuditLog;
