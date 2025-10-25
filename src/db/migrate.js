const db = require('./connection');

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table with RBAC
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'worker')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Products table
      db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          gtin TEXT UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          manufacturer TEXT,
          category TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Batches table
      db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          batch_number TEXT NOT NULL,
          manufacturing_date DATE,
          expiry_date DATE NOT NULL,
          quantity INTEGER DEFAULT 0,
          is_expired INTEGER DEFAULT 0,
          priority_level INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          UNIQUE(product_id, batch_number)
        )
      `);

      // Inventory items table
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id INTEGER NOT NULL,
          barcode TEXT,
          qr_code TEXT,
          status TEXT DEFAULT 'in_stock' CHECK(status IN ('in_stock', 'shipped', 'expired', 'damaged')),
          location TEXT,
          notes TEXT,
          scanned_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
          FOREIGN KEY (scanned_by) REFERENCES users(id)
        )
      `);

      // Label photos table
      db.run(`
        CREATE TABLE IF NOT EXISTS label_photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          inventory_item_id INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          uploaded_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
      `);

      // Audit logs table
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id INTEGER,
          changes TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Sync queue for offline support
      db.run(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          operation TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_data TEXT NOT NULL,
          sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'conflict')),
          conflict_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      // Create indexes
      db.run('CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date)');
      db.run('CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory_items(batch_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)');
    });
  });
};

const migrate = async () => {
  try {
    await createTables();
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { createTables, migrate };
