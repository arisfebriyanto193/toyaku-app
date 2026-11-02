const express = require('express');
const router = express.Router();
const { getPool, getDbStatus } = require('../config/db');
const { getSettings, updateSettings } = require('../config/settings');
const { getMqttStatus } = require('../services/mqttRecorder');

/**
 * GET /api/status
 * Mengambil ringkasan kesehatan sistem (DB, MQTT, Recorder, dan Jumlah Data)
 */
router.get('/status', async (req, res) => {
  const dbStatus = getDbStatus();
  const mqttStatus = getMqttStatus();
  const settings = getSettings();

  let totalLogsInDb = 0;
  const pool = getPool();
  if (pool) {
    try {
      const [countResult] = await pool.query('SELECT COUNT(*) as count FROM mqtt_logs');
      totalLogsInDb = countResult[0]?.count || 0;
    } catch (err) {
      // Abaikan jika error saat query count
    }
  }

  res.json({
    success: true,
    data: {
      db: dbStatus,
      mqtt: mqttStatus,
      recorder: {
        ...settings,
        totalLogsInDb
      }
    }
  });
});

/**
 * GET /api/config
 * Mengambil konfigurasi perekaman saat ini
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: getSettings()
  });
});

/**
 * POST /api/config
 * Memperbarui interval dan target topik dari frontend
 * Body: { intervalSeconds?: number, targetTopics?: string[], isRecording?: boolean, recordAllRaw?: boolean }
 */
router.post('/config', async (req, res) => {
  try {
    const { intervalSeconds, targetTopics, isRecording, recordAllRaw } = req.body;

    const updated = await updateSettings({
      intervalSeconds: typeof intervalSeconds === 'number' ? intervalSeconds : undefined,
      targetTopics: Array.isArray(targetTopics) ? targetTopics : undefined,
      isRecording: typeof isRecording === 'boolean' ? isRecording : undefined,
      recordAllRaw: typeof recordAllRaw === 'boolean' ? recordAllRaw : undefined
    });

    res.json({
      success: true,
      message: 'Konfigurasi rekaman berhasil diperbarui',
      data: updated
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui konfigurasi: ' + err.message
    });
  }
});

/**
 * POST /api/recording/toggle
 * Shortcut untuk start/stop rekaman
 */
router.post('/recording/toggle', async (req, res) => {
  try {
    const current = getSettings();
    const updated = await updateSettings({ isRecording: !current.isRecording });

    res.json({
      success: true,
      message: updated.isRecording ? 'Perekaman diaktifkan' : 'Perekaman dijeda (paused)',
      data: updated
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengubah status rekaman: ' + err.message
    });
  }
});

/**
 * GET /api/topics
 * Mendapatkan daftar semua topik unik (dari database dan dari memori MQTT live)
 */
router.get('/topics', async (req, res) => {
  const pool = getPool();
  const dbTopics = [];

  if (pool) {
    try {
      const [rows] = await pool.query('SELECT DISTINCT topic FROM mqtt_logs ORDER BY topic ASC LIMIT 200');
      rows.forEach(r => dbTopics.push(r.topic));
    } catch (err) {
      console.warn('[API] Gagal mengambil list topic dari DB:', err.message);
    }
  }

  const mqttStatus = getMqttStatus();
  const liveTopics = mqttStatus.discoveredTopics.map(t => t.topic);

  // Gabungkan dan deduplikasi
  const allUniqueTopics = Array.from(new Set([...liveTopics, ...dbTopics])).sort();

  res.json({
    success: true,
    data: {
      topics: allUniqueTopics,
      liveCount: liveTopics.length,
      savedCount: dbTopics.length
    }
  });
});

/**
 * GET /api/logs
 * Mengambil histori data rekaman dari tabel mqtt_logs
 * Query params: page=1, limit=50, topic=sensor/water, startDate=..., endDate=...
 */
router.get('/logs', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({
      success: false,
      message: 'Database belum terhubung'
    });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const topicFilter = req.query.topic;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const search = req.query.search;

    const whereClauses = [];
    const queryParams = [];

    if (topicFilter && topicFilter !== 'all') {
      whereClauses.push('topic = ?');
      queryParams.push(topicFilter);
    }

    if (startDate) {
      whereClauses.push('created_at >= ?');
      queryParams.push(new Date(startDate));
    }

    if (endDate) {
      whereClauses.push('created_at <= ?');
      queryParams.push(new Date(endDate));
    }

    if (search) {
      whereClauses.push('(topic LIKE ? OR payload LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Hitung total records
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM mqtt_logs ${whereSql}`,
      queryParams
    );
    const totalRecords = countRows[0]?.total || 0;

    // Ambil data dengan paginasi
    const [logs] = await pool.query(
      `SELECT id, topic, payload, created_at FROM mqtt_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit) || 1
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data logs: ' + err.message
    });
  }
});

/**
 * DELETE /api/logs
 * Menghapus logs rekaman (bisa spesifik topic atau all)
 */
router.delete('/logs', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ success: false, message: 'Database belum terhubung' });
  }

  try {
    const { topic } = req.query;
    if (topic && topic !== 'all') {
      await pool.query('DELETE FROM mqtt_logs WHERE topic = ?', [topic]);
      res.json({ success: true, message: `Berhasil menghapus seluruh log untuk topic "${topic}"` });
    } else {
      await pool.query('TRUNCATE TABLE mqtt_logs');
      res.json({ success: true, message: 'Berhasil mengosongkan seluruh tabel log data' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus log: ' + err.message });
  }
});

/**
 * GET /api/export
 * Ekspor data ke CSV untuk kemudahan analisa Tugas Akhir
 */
router.get('/export', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ success: false, message: 'Database belum terhubung' });
  }

  try {
    const { topic, limit = 5000 } = req.query;
    let query = 'SELECT id, topic, payload, created_at FROM mqtt_logs';
    const params = [];

    if (topic && topic !== 'all') {
      query += ' WHERE topic = ?';
      params.push(topic);
    }

    query += ' ORDER BY id ASC LIMIT ?';
    params.push(Math.min(20000, parseInt(limit, 10) || 5000));

    const [rows] = await pool.query(query, params);

    // Buat header CSV
    let csv = 'id,topic,payload,created_at\n';
    rows.forEach(r => {
      // Escape payload jika ada kutip atau koma
      const cleanPayload = `"${String(r.payload).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      const dateStr = new Date(r.created_at).toISOString();
      csv += `${r.id},"${r.topic}",${cleanPayload},${dateStr}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=toyaku_mqtt_logs_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengekspor CSV: ' + err.message });
  }
});

module.exports = router;
