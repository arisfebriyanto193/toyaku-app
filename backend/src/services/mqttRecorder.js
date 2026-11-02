const mqtt = require('mqtt');
const { getPool } = require('../config/db');
const { getSettings } = require('../config/settings');

let mqttClient = null;
let isConnected = false;
let lastError = null;

// Lacak topik yang ditemukan di MQTT broker beserta waktu terakhir dilihat
const discoveredTopics = new Map(); // topic => { lastSeen: Date, samplePayload: string }

// Lacak waktu simpan terakhir per topic untuk throttling interval
const lastSavedPerTopic = new Map(); // topic => timestamp (ms)

// Statistik
const stats = {
  messagesReceived: 0,
  messagesSaved: 0,
  startTime: new Date()
};

/**
 * Cek apakah topic cocok dengan pola wildcard MQTT (seperti '#', 'sensor/+', 'pzem004t/#')
 */
function matchMqttTopic(pattern, topic) {
  if (pattern === '#' || pattern === topic) return true;

  const patternParts = pattern.split('/');
  const topicParts = topic.split('/');

  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    if (p === '#') return true;
    if (p === '+') {
      if (i >= topicParts.length) return false;
      continue;
    }
    if (p !== topicParts[i]) return false;
  }

  return patternParts.length === topicParts.length;
}

/**
 * Cek apakah suatu topic diizinkan untuk direkam berdasarkan konfigurasi
 */
function shouldRecordTopic(topic, settings) {
  if (!settings.isRecording) return false;
  if (settings.recordAllRaw) return true;

  // Cek apakah cocok dengan daftar targetTopics
  return settings.targetTopics.some(pattern => matchMqttTopic(pattern, topic));
}

/**
 * Simpan data MQTT ke tabel MySQL mqtt_logs
 */
async function saveToDatabase(topic, payload) {
  const pool = getPool();
  if (!pool) return false;

  try {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    await pool.query(
      'INSERT INTO mqtt_logs (topic, payload) VALUES (?, ?)',
      [topic, payloadStr]
    );
    stats.messagesSaved++;
    return true;
  } catch (err) {
    console.error(`[Recorder Error] Gagal simpan ke DB (${topic}):`, err.message);
    return false;
  }
}

/**
 * Inisialisasi koneksi MQTT
 */
function initMqttRecorder() {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
  const clientId = (process.env.MQTT_CLIENT_ID || 'toyaku_backend_recorder') + '_' + Math.random().toString(16).substring(2, 8);

  const options = {
    clientId,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000
  };

  if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
  if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;

  console.log(`[MQTT] Menghubungkan ke broker: ${brokerUrl} (Client ID: ${clientId})...`);
  mqttClient = mqtt.connect(brokerUrl, options);

  mqttClient.on('connect', () => {
    isConnected = true;
    lastError = null;
    console.log(`[MQTT] Terhubung sukses ke broker: ${brokerUrl}`);

    // Selalu subscribe ke '#' agar backend bisa menangkap semua raw data & menemukan seluruh topic
    mqttClient.subscribe('#', (err) => {
      if (err) {
        console.error('[MQTT] Gagal subscribe ke topic "#":', err.message);
      } else {
        console.log('[MQTT] Berhasil subscribe ke wildcard topic "#" (Semua data dipantau)');
      }
    });
  });

  mqttClient.on('message', async (topic, message) => {
    stats.messagesReceived++;
    const payloadStr = message.toString();
    const now = Date.now();

    // Catat topik yang terdeteksi
    discoveredTopics.set(topic, {
      lastSeen: new Date(),
      samplePayload: payloadStr.length > 100 ? payloadStr.substring(0, 97) + '...' : payloadStr
    });

    const settings = getSettings();
    if (!shouldRecordTopic(topic, settings)) {
      return;
    }

    const intervalMs = (settings.intervalSeconds || 0) * 1000;
    const lastSaved = lastSavedPerTopic.get(topic) || 0;

    // Jika interval 0: simpan setiap pesan real-time
    // Jika interval > 0: simpan hanya jika jeda waktu sejak penyimpanan terakhir >= interval
    if (intervalMs <= 0 || (now - lastSaved) >= intervalMs) {
      lastSavedPerTopic.set(topic, now);
      await saveToDatabase(topic, payloadStr);
    }
  });

  mqttClient.on('error', (err) => {
    isConnected = false;
    lastError = err.message;
    console.error('[MQTT Error]:', err.message);
  });

  mqttClient.on('close', () => {
    isConnected = false;
  });

  mqttClient.on('offline', () => {
    isConnected = false;
    console.warn('[MQTT] Broker offline, mencoba reconnect otomatis...');
  });

  return mqttClient;
}

function getMqttStatus() {
  const topicsList = Array.from(discoveredTopics.entries()).map(([name, meta]) => ({
    topic: name,
    lastSeen: meta.lastSeen,
    samplePayload: meta.samplePayload
  }));

  return {
    connected: isConnected,
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883',
    lastError,
    stats: {
      ...stats,
      uptimeSeconds: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
      discoveredTopicsCount: discoveredTopics.size
    },
    discoveredTopics: topicsList
  };
}

module.exports = {
  initMqttRecorder,
  getMqttStatus,
  saveToDatabase
};
