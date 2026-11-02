const { getPool } = require('./db');

const currentSettings = {
  isRecording: process.env.AUTO_START_RECORDING !== 'false',
  intervalSeconds: parseInt(process.env.DEFAULT_INTERVAL_SECONDS, 10) || 5,
  targetTopics: (process.env.DEFAULT_TOPICS || '#')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean),
  recordAllRaw: true
};

async function loadSettingsFromDb() {
  const pool = getPool();
  if (!pool) return currentSettings;

  try {
    const [rows] = await pool.query('SELECT * FROM recorder_settings WHERE id = 1 LIMIT 1');
    if (rows && rows.length > 0) {
      const row = rows[0];
      currentSettings.isRecording = Boolean(row.is_recording);
      currentSettings.intervalSeconds = row.interval_seconds;
      currentSettings.recordAllRaw = Boolean(row.record_all_raw);
      if (row.target_topics) {
        try {
          const parsed = JSON.parse(row.target_topics);
          if (Array.isArray(parsed)) currentSettings.targetTopics = parsed;
        } catch {
          currentSettings.targetTopics = row.target_topics.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      console.log('[Settings] Loaded configuration from database:', currentSettings);
    }
  } catch (err) {
    console.warn('[Settings] Gagal memuat setting dari DB, memakai default:', err.message);
  }
  return currentSettings;
}

async function updateSettings(newSettings) {
  if (typeof newSettings.isRecording === 'boolean') {
    currentSettings.isRecording = newSettings.isRecording;
  }
  if (typeof newSettings.intervalSeconds === 'number' && newSettings.intervalSeconds >= 0) {
    currentSettings.intervalSeconds = newSettings.intervalSeconds;
  }
  if (Array.isArray(newSettings.targetTopics)) {
    currentSettings.targetTopics = newSettings.targetTopics.map(t => String(t).trim()).filter(Boolean);
    if (currentSettings.targetTopics.length === 0) {
      currentSettings.targetTopics = ['#'];
    }
  }
  if (typeof newSettings.recordAllRaw === 'boolean') {
    currentSettings.recordAllRaw = newSettings.recordAllRaw;
  }

  // Simpan ke database jika pool tersedia
  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO recorder_settings (id, is_recording, interval_seconds, target_topics, record_all_raw)
         VALUES (1, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           is_recording = VALUES(is_recording),
           interval_seconds = VALUES(interval_seconds),
           target_topics = VALUES(target_topics),
           record_all_raw = VALUES(record_all_raw)`,
        [
          currentSettings.isRecording ? 1 : 0,
          currentSettings.intervalSeconds,
          JSON.stringify(currentSettings.targetTopics),
          currentSettings.recordAllRaw ? 1 : 0
        ]
      );
    } catch (err) {
      console.error('[Settings] Gagal update setting ke DB:', err.message);
    }
  }

  return currentSettings;
}

function getSettings() {
  return { ...currentSettings };
}

module.exports = {
  getSettings,
  updateSettings,
  loadSettingsFromDb
};
