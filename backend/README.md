# Toyaku MQTT Data Recorder Backend

Backend Node.js untuk merekam data dari MQTT ke database MySQL dengan fitur:
- Merekam raw data dari seluruh topik MQTT (`#`) atau topik spesifik yang dipilih.
- Menyimpan setiap baris data dengan kolom `topic`, `payload`, dan timestamp `created_at`.
- Interval perekaman dinamis yang dapat diatur dari Frontend (misal: 0 untuk real-time, 5 untuk rekam per 5 detik, 60 untuk rekam per 1 menit).
- Filter topik yang fleksibel (mendukung wildcard MQTT `+` dan `#`).
- Kemampuan Play / Pause (Jeda) perekaman langsung dari API / Frontend.
- Ekspor log data ke format **CSV** untuk kebutuhan analisis Tugas Akhir.
- Dilengkapi REST API lengkap dan Dashboard visual built-in pada browser (`http://localhost:5000`).

---

## 🛠️ Instalasi & Menjalankan

### 1. Masuk ke direktori backend:
```bash
cd "/home/aris/Dokumen/kuliah/7s/Tugas Akhir/toyaku-app/backend"
```

### 2. Install dependensi (jika belum):
```bash
npm install
```

### 3. Sesuaikan file `.env`:
Periksa file `.env` di folder backend:
```env
PORT=5000

# Konfigurasi Database MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=toyaku_db

# Konfigurasi MQTT Broker
MQTT_BROKER_URL=mqtt://127.0.0.1:1883
MQTT_CLIENT_ID=toyaku_backend_recorder

# Pengaturan Perekaman Awal
DEFAULT_INTERVAL_SECONDS=5
DEFAULT_TOPICS=#
AUTO_START_RECORDING=true
```

> **Catatan Database:** Backend akan secara otomatis membuat database `toyaku_db` dan tabel `mqtt_logs` jika belum ada di server MySQL Anda saat pertama kali dijalankan.

### 4. Jalankan backend:
- Mode Development (Auto reload):
  ```bash
  npm run dev
  ```
- Mode Production:
  ```bash
  npm start
  ```

Buka browser di [http://localhost:5000](http://localhost:5000) untuk melihat status server & kontrol perekaman.

---

## 📡 Daftar REST API untuk Frontend (Next.js)

Base URL: `http://localhost:5000/api`

### 1. Cek Status Sistem
- **Method:** `GET /api/status`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "db": { "connected": true, "database": "toyaku_db" },
      "mqtt": { "connected": true, "brokerUrl": "mqtt://127.0.0.1:1883" },
      "recorder": {
        "isRecording": true,
        "intervalSeconds": 5,
        "targetTopics": ["#"],
        "totalLogsInDb": 1240
      }
    }
  }
  ```

### 2. Dapatkan Konfigurasi Rekaman
- **Method:** `GET /api/config`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "isRecording": true,
      "intervalSeconds": 5,
      "targetTopics": ["sensor/temp", "sensor/water", "pzem004t/#"],
      "recordAllRaw": true
    }
  }
  ```

### 3. Ubah Interval & Topik dari Frontend
- **Method:** `POST /api/config`
- **Request Body (JSON):**
  ```json
  {
    "intervalSeconds": 10,
    "targetTopics": ["sensor/temp", "sensor/water"],
    "isRecording": true,
    "recordAllRaw": false
  }
  ```

### 4. Toggle Play / Pause Rekaman
- **Method:** `POST /api/recording/toggle`

### 5. Dapatkan Daftar Topik yang Terdeteksi
- **Method:** `GET /api/topics`
- Mengembalikan daftar topik unik yang terdeteksi dari broker MQTT dan histori database.

### 6. Ambil Riwayat Data Rekaman (Log Data)
- **Method:** `GET /api/logs`
- **Query Parameters:**
  - `page`: nomor halaman (default: `1`)
  - `limit`: jumlah data per halaman (default: `50`, max: `500`)
  - `topic`: filter topik tertentu (contoh: `sensor/temp`)
  - `startDate`: filter tanggal awal (contoh: `2026-11-01T00:00:00Z`)
  - `endDate`: filter tanggal akhir
  - `search`: cari kata kunci di topik atau isi payload

### 7. Ekspor Data ke File CSV
- **Method:** `GET /api/export?topic=all&limit=5000`
- Langsung mengunduh file `.csv` yang dapat dibuka di Microsoft Excel atau Google Sheets.

### 8. Hapus Log Rekaman
- **Method:** `DELETE /api/logs?topic=all`

---

## 💡 Contoh Integrasi di Frontend Next.js (`fo`)

Anda dapat membuat fungsi pemanggil di frontend:

```typescript
// Contoh fungsi mengubah interval di frontend:
async function updateRecordingInterval(seconds: number) {
  const res = await fetch('http://localhost:5000/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intervalSeconds: seconds })
  });
  return await res.json();
}
```
