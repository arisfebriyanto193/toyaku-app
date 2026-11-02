-- Database Initialization Script for Toyaku MQTT Recorder

CREATE DATABASE IF NOT EXISTS toyaku_db;
USE toyaku_db;

-- Tabel untuk merekam data log dari MQTT
CREATE TABLE IF NOT EXISTS mqtt_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  topic VARCHAR(255) NOT NULL,
  payload LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_topic (topic),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk menyimpan setting perekaman agar persisten di database
CREATE TABLE IF NOT EXISTS recorder_settings (
  id INT PRIMARY KEY DEFAULT 1,
  is_recording TINYINT(1) DEFAULT 1,
  interval_seconds INT DEFAULT 5,
  target_topics TEXT DEFAULT '["#"]',
  record_all_raw TINYINT(1) DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inisialisasi row setting default jika belum ada
INSERT IGNORE INTO recorder_settings (id, is_recording, interval_seconds, target_topics, record_all_raw)
VALUES (1, 1, 5, '["#"]', 1);
