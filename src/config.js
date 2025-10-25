require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  dbPath: process.env.DB_PATH || './data/inventory.db',
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  nodeEnv: process.env.NODE_ENV || 'development',
  apiTimeout: 5000,
  maxFileSize: 5 * 1024 * 1024, // 5MB
};
