const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase, getDbStatus } = require('./config/db');
const { loadSettingsFromDb, getSettings } = require('./config/settings');
const { initMqttRecorder, getMqttStatus } = require('./services/mqttRecorder');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging sederhana
app.use((req, res, next) => {
  if (!req.url.startsWith('/api/status')) {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// Mount API routes
app.use('/api', apiRouter);

// Halaman antarmuka mini terintegrasi untuk test & preview langsung
app.get('/', (req, res) => {
  const settings = getSettings();
  const dbStatus = getDbStatus();
  const mqttStatus = getMqttStatus();

  res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Toyaku MQTT Data Recorder - Backend API</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
      --primary: #38bdf8;
      --success: #22c55e;
      --danger: #ef4444;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      line-height: 1.5;
    }
    .container { max-width: 980px; margin: 0 auto; }
    .header { margin-bottom: 2rem; }
    .header h1 { font-size: 1.8rem; color: var(--primary); margin-bottom: 0.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-success { background: rgba(34, 197, 94, 0.2); color: var(--success); }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
    .badge-primary { background: rgba(56, 189, 248, 0.2); color: var(--primary); }
    .form-group { margin-bottom: 1rem; }
    label { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.35rem; }
    input, select {
      width: 100%;
      padding: 0.6rem 0.8rem;
      background: #0b1120;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #fff;
      font-size: 0.9rem;
    }
    button {
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      background: var(--primary);
      color: #0f172a;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    .btn-toggle {
      background: ${settings.isRecording ? 'var(--danger)' : 'var(--success)'};
      color: #fff;
    }
    .api-docs {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .endpoint {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
      font-family: monospace;
      font-size: 0.85rem;
    }
    .method {
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-weight: bold;
    }
    .method-get { background: rgba(34, 197, 94, 0.2); color: var(--success); }
    .method-post { background: rgba(56, 189, 248, 0.2); color: var(--primary); }
    .method-delete { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Toyaku MQTT Data Recorder Backend</h1>
      <p style="color: var(--muted)">Perekam data MQTT ke database MySQL dengan interval dinamis & filter topik.</p>
    </div>

    <div class="grid">
      <!-- Status Box -->
      <div class="card">
        <h3 style="margin-bottom: 1rem;">Status Sistem</h3>
        <p style="margin-bottom: 0.5rem;">
          Database MySQL: 
          <span class="badge ${dbStatus.connected ? 'badge-success' : 'badge-danger'}">
            ${dbStatus.connected ? 'Terhubung (' + dbStatus.database + ')' : 'Belum Terhubung'}
          </span>
        </p>
        <p style="margin-bottom: 0.5rem;">
          MQTT Broker: 
          <span class="badge ${mqttStatus.connected ? 'badge-success' : 'badge-danger'}">
            ${mqttStatus.connected ? 'Terhubung' : 'Terputus'}
          </span>
        </p>
        <p style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--muted);">
          Broker: <code>${mqttStatus.brokerUrl}</code>
        </p>
        <p style="margin-top: 1rem;">
          Status Rekaman: 
          <span class="badge ${settings.isRecording ? 'badge-success' : 'badge-danger'}">
            ${settings.isRecording ? 'Sedang Merekam' : 'Dijeda (Paused)'}
          </span>
        </p>
      </div>

      <!-- Quick Controls -->
      <div class="card">
        <h3 style="margin-bottom: 1rem;">Kontrol Perekaman</h3>
        <form id="configForm" onsubmit="saveConfig(event)">
          <div class="form-group">
            <label>Interval Rekam (Detik, 0 = Real-time):</label>
            <input type="number" id="intervalInput" min="0" value="${settings.intervalSeconds}">
          </div>
          <div class="form-group">
            <label>Target Topik (Pisahkan koma, '#' untuk semua):</label>
            <input type="text" id="topicsInput" value="${settings.targetTopics.join(', ')}">
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button type="submit">Simpan Konfigurasi</button>
            <button type="button" class="btn-toggle" onclick="toggleRecording()">
              ${settings.isRecording ? 'Jeda Rekaman' : 'Mulai Rekaman'}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- API List -->
    <div class="api-docs">
      <h3 style="margin-bottom: 1rem;">Endpoints REST API untuk Frontend Next.js</h3>
      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span>/api/status</span>
        <span style="color: var(--muted); margin-left: auto;">Ambil status DB, MQTT, recorder, dan jumlah log</span>
      </div>
      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span>/api/config</span>
        <span style="color: var(--muted); margin-left: auto;">Ambil konfigurasi saat ini</span>
      </div>
      <div class="endpoint">
        <span class="method method-post">POST</span>
        <span>/api/config</span>
        <span style="color: var(--muted); margin-left: auto;">Ubah interval, target topics, dan status rekaman</span>
      </div>
      <div class="endpoint">
        <span class="method method-post">POST</span>
        <span>/api/recording/toggle</span>
        <span style="color: var(--muted); margin-left: auto;">Toggle play / pause rekaman</span>
      </div>
      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span>/api/topics</span>
        <span style="color: var(--muted); margin-left: auto;">Daftar topik terdeteksi</span>
      </div>
      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span>/api/logs?page=1&limit=50&topic=...</span>
        <span style="color: var(--muted); margin-left: auto;">Ambil riwayat data rekaman (Pagination & Filter)</span>
      </div>
      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span>/api/export?topic=...</span>
        <span style="color: var(--muted); margin-left: auto;">Unduh data rekaman format CSV untuk Tugas Akhir</span>
      </div>
      <div class="endpoint">
        <span class="method method-delete">DELETE</span>
        <span>/api/logs?topic=...</span>
        <span style="color: var(--muted); margin-left: auto;">Hapus log rekaman</span>
      </div>
    </div>
  </div>

  <script>
    async function saveConfig(e) {
      e.preventDefault();
      const interval = parseInt(document.getElementById('intervalInput').value, 10);
      const rawTopics = document.getElementById('topicsInput').value;
      const topics = rawTopics.split(',').map(t => t.trim()).filter(Boolean);

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalSeconds: interval, targetTopics: topics })
      });
      const data = await res.json();
      if (data.success) {
        alert('Konfigurasi berhasil disimpan!');
        location.reload();
      } else {
        alert('Gagal: ' + data.message);
      }
    }

    async function toggleRecording() {
      const res = await fetch('/api/recording/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        location.reload();
      }
    }
  </script>
</body>
</html>
  `);
});

// Jalankan inisialisasi & server
async function startServer() {
  console.log('[System] Memulai Toyaku MQTT Recorder Backend...');

  // 1. Inisialisasi Database
  await initDatabase();

  // 2. Load setting dari Database jika ada
  await loadSettingsFromDb();

  // 3. Hubungkan ke MQTT Broker
  initMqttRecorder();

  // 4. Listen HTTP Server
  app.listen(PORT, () => {
    console.log(`[HTTP Server] Backend berjalan aktif di http://localhost:${PORT}`);
    console.log(`[HTTP Server] API siap di http://localhost:${PORT}/api`);
  });
}

startServer();
