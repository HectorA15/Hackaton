const db = require('../db/connection');

class User {
  static create(username, hashedPassword, role) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
      db.run(sql, [username, hashedPassword, role], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static findByUsername(username) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE username = ?';
      db.get(sql, [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, username, role, created_at FROM users WHERE id = ?';
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, username, role, created_at FROM users';
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = User;
