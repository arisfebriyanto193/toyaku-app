const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'toyaku_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isDbConnected = false;
let dbError = null;

async function initDatabase() {
  try {
    // 1. Coba hubungkan ke MySQL server untuk memastikan database ada
    const tempConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    await tempConn.end();

    // 2. Buat connection pool untuk aplikasi
    pool = mysql.createPool(dbConfig);

    // 3. Pastikan tabel mqtt_logs dan recorder_settings tersedia
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mqtt_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        topic VARCHAR(255) NOT NULL,
        payload LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_topic (topic),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recorder_settings (
        id INT PRIMARY KEY DEFAULT 1,
        is_recording TINYINT(1) DEFAULT 1,
        interval_seconds INT DEFAULT 5,
        target_topics TEXT,
        record_all_raw TINYINT(1) DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Inisialisasi default settings jika belum ada
    await pool.query(`
      INSERT IGNORE INTO recorder_settings (id, is_recording, interval_seconds, target_topics, record_all_raw)
      VALUES (1, 1, 5, '["#"]', 1);
    `);

    isDbConnected = true;
    dbError = null;
    console.log(`[DB] Berhasil terhubung ke MySQL database: ${dbConfig.database}`);
    return true;
  } catch (err) {
    isDbConnected = false;
    dbError = err.message;
    console.error(`[DB Error] Gagal menghubungkan ke MySQL (${dbConfig.host}:${dbConfig.port}):`, err.message);
    return false;
  }
}

function getPool() {
  return pool;
}

function getDbStatus() {
  return {
    connected: isDbConnected,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    error: dbError
  };
}

module.exports = {
  initDatabase,
  getPool,
  getDbStatus
};
