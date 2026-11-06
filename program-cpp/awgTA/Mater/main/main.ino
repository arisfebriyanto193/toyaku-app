#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ============================================================
//  AWG (Atmospheric Water Generator) - Program Utama
//  Board: ESP32 (Dual-Core FreeRTOS + Mutex)
// ============================================================
//
//  ARSITEKTUR DUAL-CORE:
//    Core 1 (Task Sensor & Kontrol) - baca sensor, logika kontrol relay
//    Core 0 (Task Network)          - WiFi, MQTT subscribe/publish
//    Mutex melindungi variabel yang diakses kedua task
//
//  RELAY MAPPING (Aktif HIGH):
//    R1 = Pompa Bawah   (GPIO 13) - transfer air tangki bawah → atas
//    R2 = Kompresor     (GPIO 14) - unit pendingin / kondensasi
//    R3 = Pompa Out     (GPIO 12) - keluarkan air dari tangki atas
//    R4 = Blower        (GPIO 27) - tiup udara ke evaporator
//
//  FAN PWM (GPIO 2) - kipas sirkulasi, PWM 25 kHz
//
//  SENSOR:
//    Water Level Atas   (GPIO 32) - ADC tangki atas
//    Water Level Bawah  (GPIO 33) - ADC tangki bawah
//    Suhu Evaporator    (GPIO 34) - ADC suhu (belum dikalibrasi)
//
//  DATA ADC WATER LEVEL:
//    lev0 = ~3247 (kosong / 0%)
//    lev1 = ~2480 (~30%)
//    lev2 = ~1470 (~70%)
//    lev3 = ~0    (penuh / 100%)
//
// ============================================================

// ===== KONFIGURASI WIFI =====
const char* ssid     = "awg";
const char* password = "awg12345678";

IPAddress local_IP(192, 168, 0, 51);
IPAddress gateway_ip(192, 168, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns_ip(8, 8, 8, 8);

// ===== KONFIGURASI MQTT =====
const char* mqtt_server   = "192.168.0.101";
const int   mqtt_port     = 1883;
const char* mqtt_clientID = "ESP32_AWG_MATER";

WiFiClient   espClient;
PubSubClient mqtt(espClient);

// ===== MQTT TOPICS =====
// -- Publish (ESP32 → Broker) --
const char* TOPIC_PUB_WATER_ATAS      = "awg/sensor/water_atas";
const char* TOPIC_PUB_WATER_BAWAH     = "awg/sensor/water_bawah";
const char* TOPIC_PUB_SUHU_EVA        = "awg/sensor/suhu_eva";
const char* TOPIC_PUB_KIPAS           = "awg/status/kipas";
const char* TOPIC_PUB_KOMPRESOR       = "awg/status/kompresor";
const char* TOPIC_PUB_BLOWER          = "awg/status/blower";
const char* TOPIC_PUB_POMPA_BAWAH     = "awg/status/pompa_bawah";
const char* TOPIC_PUB_POMPA_OUT       = "awg/status/pompa_out";
const char* TOPIC_PUB_MODE            = "awg/status/mode";
const char* TOPIC_PUB_KURAS           = "awg/status/kuras";
const char* TOPIC_PUB_AUTO_RESTART    = "awg/status/auto_restart";

// -- Subscribe (Broker → ESP32) --
const char* TOPIC_SUB_KOMPRESOR       = "awg/cmd/kompresor";
const char* TOPIC_SUB_BLOWER          = "awg/cmd/blower";
const char* TOPIC_SUB_POMPA_OUT       = "awg/cmd/pompa_out";
const char* TOPIC_SUB_KIPAS           = "awg/cmd/kipas";
const char* TOPIC_SUB_KURAS           = "awg/cmd/kuras";
const char* TOPIC_SUB_AUTO_RESTART    = "awg/cmd/auto_restart";   // "ON" / "OFF"

// -- Subscribe Alias Legacy (Kompatibilitas modul tombol / web lama) --
const char* TOPIC_LEGACY_SUB_KOMP     = "relay/1/status";
const char* TOPIC_LEGACY_SUB_POUT     = "relay/2/status";
const char* TOPIC_LEGACY_SUB_KURAS    = "kuras/status";

// ===== DEFINISI PIN SENSOR ANALOG =====
const int PIN_WATER_LEVEL_ATAS  = 32; // ADC1_CH4
const int PIN_WATER_LEVEL_BAWAH = 33; // ADC1_CH5
const int PIN_SUHU_EVA          = 34; // ADC1_CH6 (Input only)

// ===== DEFINISI PIN RELAY (AKTIF HIGH) =====
const int PIN_POMPA_BAWAH = 13; // R1
const int PIN_KOMPRESOR   = 14; // R2
const int PIN_POMPA_OUT   = 12; // R3
const int PIN_BLOWER      = 27; // R4

// ===== DEFINISI PIN & KONFIGURASI PWM KIPAS =====
const int PIN_KIPAS_PWM  = 2;
const int PWM_FREQ       = 25000;
const int PWM_CHANNEL    = 0;
const int PWM_RESOLUTION = 8;

// ===== THRESHOLD ADC WATER LEVEL =====
const int THRESH_LEV0_LEV1 = 2860;
const int THRESH_LEV1_LEV2 = 1975;
const int THRESH_LEV2_LEV3 = 735;

// ===== FreeRTOS MUTEX =====
// Mutex untuk melindungi shared variables yang diakses oleh kedua task
SemaphoreHandle_t xMutexState = NULL;

// ===== FreeRTOS TASK HANDLES =====
TaskHandle_t taskSensorHandle  = NULL;
TaskHandle_t taskNetworkHandle = NULL;

// ===== VARIABEL STATE (DILINDUNGI MUTEX) =====
// Status relay aktual
volatile bool statKompresor  = false;
volatile bool statBlower     = false;
volatile bool statPompaBawah = false;
volatile bool statPompaOut   = false;
volatile int  kecepatanKipas = 0;

// Request dari MQTT (ditulis oleh task network, dibaca oleh task sensor)
volatile bool reqKompresor = false;
volatile bool reqPompaOut  = false;
volatile bool modeKuras    = false;

// Auto-restart: otomatis nyalakan produksi saat tangki atas turun ke ≤30%
// User bisa matikan via MQTT (awg/cmd/kompresor OFF atau awg/cmd/auto_restart OFF)
volatile bool autoRestart   = true;  // Default aktif saat boot

// Data sensor (ditulis oleh task sensor, dibaca oleh task network)
volatile int levelAtas  = 0;
volatile int levelBawah = 0;
volatile int rawSuhuEva = 0;

// Last published values (hanya diakses task network, tidak perlu mutex)
int  lastLevelAtas      = -1;
int  lastLevelBawah     = -1;
int  lastRawSuhuEva     = -1;
bool lastStatKompresor  = false;
bool lastStatBlower     = false;
bool lastStatPompaBawah = false;
bool lastStatPompaOut   = false;
int  lastKecepatanKipas = -1;
String lastMode         = "";
bool lastModeKuras      = false;
bool lastAutoRestart    = true;

// ============================================================
//  FUNGSI UTILITAS (dipanggil dari task sensor, Core 1)
// ============================================================

// Baca ADC rata-rata 10x untuk stabilitas
int bacaADC(int pin) {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(pin);
    vTaskDelay(pdMS_TO_TICKS(2)); // Gunakan vTaskDelay agar tidak block task lain
  }
  return (int)(sum / 10);
}

// Konversi raw ADC ke level persen (0, 30, 70, 100)
int adcKeLevel(int rawADC) {
  if (rawADC <= THRESH_LEV2_LEV3) return 100;
  if (rawADC <= THRESH_LEV1_LEV2) return 70;
  if (rawADC <= THRESH_LEV0_LEV1) return 30;
  return 0;
}

// Set kecepatan kipas PWM (0-255) — dipanggil dengan mutex SUDAH dipegang
void setKipas_nolock(int duty) {
  duty = constrain(duty, 0, 255);
  kecepatanKipas = duty;

#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  ledcWrite(PIN_KIPAS_PWM, duty);
#else
  ledcWrite(PWM_CHANNEL, duty);
#endif

  int persen = map(duty, 0, 255, 0, 100);
  Serial.printf("[KIPAS] Set ke %d%% (PWM: %d/255)\n", persen, duty);
}

// Set relay individual — dipanggil dengan mutex SUDAH dipegang
void setKompresor_nolock(bool state) {
  statKompresor = state;
  digitalWrite(PIN_KOMPRESOR, state ? HIGH : LOW);
  Serial.printf("[RELAY] Kompresor: %s\n", state ? "ON" : "OFF");
}

void setBlower_nolock(bool state) {
  statBlower = state;
  digitalWrite(PIN_BLOWER, state ? HIGH : LOW);
  Serial.printf("[RELAY] Blower: %s\n", state ? "ON" : "OFF");
}

void setPompaBawah_nolock(bool state) {
  statPompaBawah = state;
  digitalWrite(PIN_POMPA_BAWAH, state ? HIGH : LOW);
  Serial.printf("[RELAY] Pompa Bawah: %s\n", state ? "ON" : "OFF");
}

void setPompaOut_nolock(bool state) {
  statPompaOut = state;
  digitalWrite(PIN_POMPA_OUT, state ? HIGH : LOW);
  Serial.printf("[RELAY] Pompa Out: %s\n", state ? "ON" : "OFF");
}

// Versi thread-safe: ambil mutex, set relay, lepas mutex
void setPompaOut_safe(bool state) {
  if (xSemaphoreTake(xMutexState, pdMS_TO_TICKS(100)) == pdTRUE) {
    setPompaOut_nolock(state);
    xSemaphoreGive(xMutexState);
  }
}

void setKipas_safe(int duty) {
  if (xSemaphoreTake(xMutexState, pdMS_TO_TICKS(100)) == pdTRUE) {
    setKipas_nolock(duty);
    xSemaphoreGive(xMutexState);
  }
}

// Dapatkan string mode saat ini (panggil dengan mutex dipegang)
String getMode_nolock() {
  if (modeKuras) return "KURAS";
  if (statKompresor || statBlower) return "PRODUKSI";
  return "IDLE";
}

// ============================================================
//  LOGIKA KONTROL UTAMA AWG
//  Dipanggil dari task sensor (Core 1) dengan mutex SUDAH dipegang
// ============================================================
void kontrolAWG_nolock() {
  // -------------------------------------------------------
  //  MODE KURAS
  // -------------------------------------------------------
  if (modeKuras) {
    if (statKompresor) setKompresor_nolock(false);
    if (statBlower)    setBlower_nolock(false);
    if (kecepatanKipas > 0) setKipas_nolock(0);

    if (levelAtas >= 100) {
      setPompaBawah_nolock(false);
      modeKuras = false;
      Serial.println("[KURAS] Tangki atas PENUH -> Mode kuras selesai.");
      // Publish kuras OFF akan dilakukan di task network
    } else {
      if (!statPompaBawah) setPompaBawah_nolock(true);
    }
    return;
  }

  // -------------------------------------------------------
  //  MODE NORMAL / PRODUKSI
  // -------------------------------------------------------
  if (levelAtas >= 100) {
    // Tangki atas penuh → matikan produksi (tapi JANGAN matikan autoRestart)
    if (statKompresor) {
      setKompresor_nolock(false);
      reqKompresor = false;
      Serial.println("[AWG] Tangki atas PENUH -> Produksi STOP.");
    }
    if (statBlower) setBlower_nolock(false);
    if (kecepatanKipas > 0) setKipas_nolock(0);
  } else {
    // --- Auto-Restart: jika level turun ke ≤30% dan autoRestart aktif ---
    if (autoRestart && !reqKompresor && levelAtas <= 30) {
      reqKompresor = true;
      Serial.println("[AWG] Tangki atas <= 30% -> AUTO-RESTART Produksi!");
    }

    if (reqKompresor) {
      if (!statKompresor) setKompresor_nolock(true);
      if (!statBlower)    setBlower_nolock(true);
      if (kecepatanKipas != 255) setKipas_nolock(255);
    } else {
      if (statKompresor) setKompresor_nolock(false);
      if (statBlower)    setBlower_nolock(false);
      if (kecepatanKipas > 0) setKipas_nolock(0);
    }
  }

  // === LOGIKA POMPA BAWAH ===
  if (statKompresor && statBlower) {
    if (levelBawah >= 70 && !statPompaBawah) {
      setPompaBawah_nolock(true);
      Serial.println("[AWG] Tangki bawah >= lev2 -> Pompa bawah ON.");
    }
    if (levelBawah <= 0 && statPompaBawah) {
      setPompaBawah_nolock(false);
      Serial.println("[AWG] Tangki bawah lev0 -> Pompa bawah OFF.");
    }
  } else {
    if (statPompaBawah) {
      setPompaBawah_nolock(false);
      Serial.println("[AWG] Produksi OFF -> Pompa bawah OFF.");
    }
  }
}

// ============================================================
//  MQTT CALLBACK (dipanggil dari task network, Core 0)
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();
  msg.toUpperCase();

  Serial.printf("[MQTT RX] %s => %s\n", topic, msg.c_str());

  String topicStr = String(topic);

  // -- Perintah Kompresor --
  // ON  = nyalakan produksi + aktifkan auto-restart
  // OFF = matikan produksi + matikan auto-restart (berhenti total)
  if (topicStr == TOPIC_SUB_KOMPRESOR || topicStr == TOPIC_LEGACY_SUB_KOMP) {
    if (xSemaphoreTake(xMutexState, pdMS_TO_TICKS(100)) == pdTRUE) {
      reqKompresor = (msg == "ON");
      if (msg == "ON") {
        autoRestart = true;
        Serial.println("[CMD] Kompresor ON + Auto-restart AKTIF");
      } else {
        autoRestart = false;
        Serial.println("[CMD] Kompresor OFF + Auto-restart MATI (produksi berhenti total)");
      }
      xSemaphoreGive(xMutexState);
    }
  }

  // -- Perintah Auto-Restart (kontrol independen) --
  if (topicStr == TOPIC_SUB_AUTO_RESTART) {
    if (xSemaphoreTake(xMutexState, pdMS_TO_TICKS(100)) == pdTRUE) {
      autoRestart = (msg == "ON");
      Serial.printf("[CMD] Auto-restart: %s\n", autoRestart ? "AKTIF" : "MATI");
      xSemaphoreGive(xMutexState);
    }
  }

  // -- Perintah Pompa Out --
  if (topicStr == TOPIC_SUB_POMPA_OUT || topicStr == TOPIC_LEGACY_SUB_POUT) {
    bool req = (msg == "ON");
    setPompaOut_safe(req);
    Serial.printf("[CMD] Pompa Out: %s\n", req ? "ON" : "OFF");
  }

  // -- Perintah Kipas --
  if (topicStr == TOPIC_SUB_KIPAS) {
    int val = msg.toInt();
    val = constrain(val, 0, 100);
    int duty = map(val, 0, 100, 0, 255);
    setKipas_safe(duty);
    Serial.printf("[CMD] Kipas diset ke %d%%\n", val);
  }

  // -- Perintah Mode Kuras --
  if (topicStr == TOPIC_SUB_KURAS || topicStr == TOPIC_LEGACY_SUB_KURAS) {
    if (msg.length() == 0) return; // Abaikan pesan kosong saat broker clear retained

    // Proteksi saat booting: jika pesan "ON" diterima dalam 8 detik pertama boot,
    // ini adalah pesan retained usang di broker dari sesi sebelumnya.
    // Kita abaikan dan langsung paksa broker menyimpan kuras OFF.
    if (msg == "ON" && millis() < 8000) {
      Serial.println(F("[BOOT PROTECT] Mengabaikan perintah kuras ON lama dari broker (stale retained)."));
      mqtt.publish(TOPIC_PUB_KURAS, "OFF", true);
      mqtt.publish("kuras/status", "OFF", true);
      mqtt.publish(TOPIC_SUB_KURAS, "", true);
      return;
    }

    if (xSemaphoreTake(xMutexState, pdMS_TO_TICKS(100)) == pdTRUE) {
      modeKuras = (msg == "ON");
      Serial.printf("[CMD] Mode Kuras: %s\n", modeKuras ? "AKTIF" : "NONAKTIF");
      if (modeKuras) {
        reqKompresor = false;
        setKompresor_nolock(false);
        setBlower_nolock(false);
        setKipas_nolock(0);
      }
      xSemaphoreGive(xMutexState);
    }
  }
}

// ============================================================
//  MQTT RECONNECT (non-blocking, 1 attempt)
// ============================================================
bool mqttReconnect() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[MQTT] WiFi belum terhubung, skip reconnect.");
    return false;
  }

  Serial.print("[MQTT] Menghubungkan...");
  if (mqtt.connect(mqtt_clientID)) {
    Serial.println(" OK!");

    // --- Inisialisasi awal saat terkoneksi ---
    // Pastikan status kuras OFF dipublish ke broker (retain: true)
    mqtt.publish(TOPIC_PUB_KURAS, "OFF", true);
    mqtt.publish("kuras/status", "OFF", true);
    // Bersihkan retained message command lama di broker agar tidak trigger kuras saat boot
    mqtt.publish(TOPIC_SUB_KURAS, "", true);

    mqtt.subscribe(TOPIC_SUB_KOMPRESOR);
    mqtt.subscribe(TOPIC_LEGACY_SUB_KOMP);
    mqtt.subscribe(TOPIC_SUB_BLOWER);
    mqtt.subscribe(TOPIC_SUB_POMPA_OUT);
    mqtt.subscribe(TOPIC_LEGACY_SUB_POUT);
    mqtt.subscribe(TOPIC_SUB_KIPAS);
    mqtt.subscribe(TOPIC_SUB_KURAS);
    mqtt.subscribe(TOPIC_LEGACY_SUB_KURAS);
    mqtt.subscribe(TOPIC_SUB_AUTO_RESTART);

    Serial.println("[MQTT] Subscribed ke semua topic command (modern & legacy).");
    return true;
  } else {
    Serial.printf(" GAGAL (rc=%d). Coba lagi nanti...\n", mqtt.state());
    return false;
  }
}

// ============================================================
//  MQTT PUBLISH (dipanggil dari task network, Core 0)
//  Mengambil snapshot state dengan mutex, lalu publish tanpa mutex
// ============================================================
void publishSemuaStatus(bool paksa) {
  if (!mqtt.connected()) return;

  // --- Ambil snapshot state dengan mutex ---
  bool _statKompresor, _statBlower, _statPompaBawah, _statPompaOut;
  int  _levelAtas, _levelBawah, _rawSuhuEva, _kecepatanKipas;
  bool _modeKuras, _autoRestart;

  if (xSemaphoreTake(xMutexState, pdMS_TO_TICKS(100)) == pdTRUE) {
    _statKompresor  = statKompresor;
    _statBlower     = statBlower;
    _statPompaBawah = statPompaBawah;
    _statPompaOut   = statPompaOut;
    _levelAtas      = levelAtas;
    _levelBawah     = levelBawah;
    _rawSuhuEva     = rawSuhuEva;
    _kecepatanKipas = kecepatanKipas;
    _modeKuras      = modeKuras;
    _autoRestart    = autoRestart;
    xSemaphoreGive(xMutexState);
  } else {
    return; // Gagal ambil mutex, skip publish kali ini
  }

  // --- Publish dengan data snapshot (tidak perlu mutex) ---
  if (paksa || _levelAtas != lastLevelAtas) {
    mqtt.publish(TOPIC_PUB_WATER_ATAS, String(_levelAtas).c_str(), true);
    lastLevelAtas = _levelAtas;
  }

  if (paksa || _levelBawah != lastLevelBawah) {
    mqtt.publish(TOPIC_PUB_WATER_BAWAH, String(_levelBawah).c_str(), true);
    lastLevelBawah = _levelBawah;
  }

  if (paksa || abs(_rawSuhuEva - lastRawSuhuEva) > 10) {
    mqtt.publish(TOPIC_PUB_SUHU_EVA, String(_rawSuhuEva).c_str(), true);
    lastRawSuhuEva = _rawSuhuEva;
  }

  if (paksa || _statKompresor != lastStatKompresor) {
    mqtt.publish(TOPIC_PUB_KOMPRESOR, _statKompresor ? "ON" : "OFF", true);
    mqtt.publish("relay/1/status", _statKompresor ? "ON" : "OFF", true);
    lastStatKompresor = _statKompresor;
  }

  if (paksa || _statBlower != lastStatBlower) {
    mqtt.publish(TOPIC_PUB_BLOWER, _statBlower ? "ON" : "OFF", true);
    lastStatBlower = _statBlower;
  }

  if (paksa || _statPompaBawah != lastStatPompaBawah) {
    mqtt.publish(TOPIC_PUB_POMPA_BAWAH, _statPompaBawah ? "ON" : "OFF", true);
    lastStatPompaBawah = _statPompaBawah;
  }

  if (paksa || _statPompaOut != lastStatPompaOut) {
    mqtt.publish(TOPIC_PUB_POMPA_OUT, _statPompaOut ? "ON" : "OFF", true);
    mqtt.publish("relay/2/status", _statPompaOut ? "ON" : "OFF", true);
    lastStatPompaOut = _statPompaOut;
  }

  int persenKipas = map(_kecepatanKipas, 0, 255, 0, 100);
  if (paksa || persenKipas != lastKecepatanKipas) {
    mqtt.publish(TOPIC_PUB_KIPAS, String(persenKipas).c_str(), true);
    lastKecepatanKipas = persenKipas;
  }

  String mode;
  if (_modeKuras) mode = "KURAS";
  else if (_statKompresor || _statBlower) mode = "PRODUKSI";
  else mode = "IDLE";

  if (paksa || mode != lastMode) {
    mqtt.publish(TOPIC_PUB_MODE, mode.c_str(), true);
    lastMode = mode;
  }

  if (paksa || _modeKuras != lastModeKuras) {
    mqtt.publish(TOPIC_PUB_KURAS, _modeKuras ? "ON" : "OFF", true);
    mqtt.publish("kuras/status", _modeKuras ? "ON" : "OFF", true);
    lastModeKuras = _modeKuras;
  }

  if (paksa || _autoRestart != lastAutoRestart) {
    mqtt.publish(TOPIC_PUB_AUTO_RESTART, _autoRestart ? "ON" : "OFF", true);
    lastAutoRestart = _autoRestart;
  }
}

// ============================================================
//  SERIAL MONITOR DEBUG
// ============================================================
void printStatus(int _levelAtas, int _levelBawah, int _rawSuhuEva,
                 bool _statKompresor, bool _statBlower,
                 bool _statPompaBawah, bool _statPompaOut,
                 int _kecepatanKipas, bool _modeKuras) {
  int persenKipas = map(_kecepatanKipas, 0, 255, 0, 100);

  String mode;
  if (_modeKuras) mode = "KURAS";
  else if (_statKompresor || _statBlower) mode = "PRODUKSI";
  else mode = "IDLE";

  Serial.println(F("--------------------------------------------------"));
  Serial.printf("[SENSOR] Atas: %d%%  |  Bawah: %d%%  |  Suhu Eva (raw): %d\n",
                _levelAtas, _levelBawah, _rawSuhuEva);
  Serial.printf("[AKTUATOR] Kompresor:%s  Blower:%s  PompaBawah:%s  PompaOut:%s  Kipas:%d%%\n",
                _statKompresor ? "ON" : "OFF",
                _statBlower ? "ON" : "OFF",
                _statPompaBawah ? "ON" : "OFF",
                _statPompaOut ? "ON" : "OFF",
                persenKipas);
  Serial.printf("[MODE] %s  |  Kuras: %s\n", mode.c_str(), _modeKuras ? "AKTIF" : "OFF");
}

// ============================================================
//  TASK: SENSOR & KONTROL (Core 1 - prioritas tinggi)
//  Baca sensor, jalankan logika kontrol, atur relay
//  Tidak tergantung WiFi/MQTT sama sekali
// ============================================================
void taskSensorKontrol(void* pvParameters) {
  Serial.println("[TASK] Sensor & Kontrol dimulai di Core " + String(xPortGetCoreID()));

  // --- Auto-Start: Cek tangki saat boot ---
  {
    int rawAtasInit  = bacaADC(PIN_WATER_LEVEL_ATAS);
    int rawBawahInit = bacaADC(PIN_WATER_LEVEL_BAWAH);
    int rawSuhuInit  = bacaADC(PIN_SUHU_EVA);

    if (xSemaphoreTake(xMutexState, portMAX_DELAY) == pdTRUE) {
      levelAtas  = adcKeLevel(rawAtasInit);
      levelBawah = adcKeLevel(rawBawahInit);
      rawSuhuEva = rawSuhuInit;

      Serial.printf("[BOOT] Tangki atas: %d%% (ADC: %d)\n", (int)levelAtas, rawAtasInit);
      Serial.printf("[BOOT] Tangki bawah: %d%% (ADC: %d)\n", (int)levelBawah, rawBawahInit);

      autoRestart = true;  // Auto-restart aktif saat boot
      modeKuras   = false; // Pastikan mode kuras NONAKTIF saat boot

      if (levelAtas >= 100) {
        Serial.println(F("[BOOT] Tangki atas PENUH -> Tetap IDLE (auto-restart tetap aktif)."));
        reqKompresor = false;
      } else {
        Serial.println(F("[BOOT] Tangki atas BELUM penuh -> Otomatis MULAI PRODUKSI!"));
        reqKompresor = true;
        kontrolAWG_nolock();
      }
      xSemaphoreGive(xMutexState);
    }
  }

  // --- Loop utama sensor & kontrol ---
  TickType_t xLastWakeTime = xTaskGetTickCount();
  const TickType_t xPeriod = pdMS_TO_TICKS(1000); // Tiap 1 detik, tepat waktu

  for (;;) {
    vTaskDelayUntil(&xLastWakeTime, xPeriod);

    // Baca ADC (tidak perlu mutex, hanya akses hardware)
    int rawAtas  = bacaADC(PIN_WATER_LEVEL_ATAS);
    int rawBawah = bacaADC(PIN_WATER_LEVEL_BAWAH);
    int rawSuhu  = bacaADC(PIN_SUHU_EVA);

    Serial.printf("[ADC RAW] Atas:%d  Bawah:%d  Suhu:%d\n", rawAtas, rawBawah, rawSuhu);

    // Ambil mutex → update state + jalankan kontrol → lepas mutex
    if (xSemaphoreTake(xMutexState, pdMS_TO_TICKS(200)) == pdTRUE) {
      levelAtas  = adcKeLevel(rawAtas);
      levelBawah = adcKeLevel(rawBawah);
      rawSuhuEva = rawSuhu;

      // Jalankan logika kontrol
      kontrolAWG_nolock();

      // Snapshot untuk print (agar print di luar mutex)
      int _lA = levelAtas, _lB = levelBawah, _rS = rawSuhuEva, _kK = kecepatanKipas;
      bool _sK = statKompresor, _sB = statBlower, _sPB = statPompaBawah;
      bool _sPO = statPompaOut, _mK = modeKuras;

      xSemaphoreGive(xMutexState);

      // Print status (di luar mutex agar tidak block task network)
      printStatus(_lA, _lB, _rS, _sK, _sB, _sPB, _sPO, _kK, _mK);
    } else {
      Serial.println("[WARN] Sensor task: gagal ambil mutex!");
    }
  }
}

// ============================================================
//  TASK: NETWORK (Core 0 - prioritas normal)
//  WiFi reconnect, MQTT loop, publish status
// ============================================================
void taskNetwork(void* pvParameters) {
  Serial.println("[TASK] Network dimulai di Core " + String(xPortGetCoreID()));

  // Tunggu sebentar agar task sensor sudah jalan & baca sensor pertama
  vTaskDelay(pdMS_TO_TICKS(3000));

  unsigned long lastMqttReconnect = 0;
  unsigned long lastMqttPublish   = 0;
  unsigned long lastWifiRetry     = 0;

  const unsigned long RECONNECT_INTERVAL = 10000;
  const unsigned long PUBLISH_INTERVAL   = 2000;
  const unsigned long WIFI_RETRY_INTERVAL = 15000;

  // Publish status awal setelah MQTT pertama connect
  bool needInitialPublish = true;

  for (;;) {
    unsigned long now = millis();

    // --- WiFi Auto-Reconnect ---
    if (WiFi.status() != WL_CONNECTED) {
      if (now - lastWifiRetry >= WIFI_RETRY_INTERVAL) {
        lastWifiRetry = now;
        Serial.println("[WIFI] Terputus! Mencoba reconnect...");
        WiFi.disconnect();
        WiFi.begin(ssid, password);
      }
    }

    // --- MQTT Connection ---
    if (mqtt.connected()) {
      mqtt.loop();

      // Publish pertama setelah connect
      if (needInitialPublish) {
        publishSemuaStatus(true);
        needInitialPublish = false;
      }
    } else {
      if (now - lastMqttReconnect >= RECONNECT_INTERVAL) {
        lastMqttReconnect = now;
        if (mqttReconnect()) {
          needInitialPublish = true; // Akan publish di iterasi berikutnya
        }
      }
    }

    // --- Publish periodik ---
    if (mqtt.connected() && (now - lastMqttPublish >= PUBLISH_INTERVAL)) {
      lastMqttPublish = now;
      publishSemuaStatus(false);
    }

    // Yield ke task lain, jangan block Core 0 terlalu lama
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// ============================================================
//  SETUP (jalan di Core 1, lalu spawn tasks)
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println(F("\n============================================================"));
  Serial.println(F("  AWG - Atmospheric Water Generator"));
  Serial.println(F("  Program Utama v2.0 (FreeRTOS Dual-Core + Mutex)"));
  Serial.println(F("============================================================"));

  // --- Buat Mutex ---
  xMutexState = xSemaphoreCreateMutex();
  if (xMutexState == NULL) {
    Serial.println(F("[ERROR] Gagal membuat mutex! System halt."));
    while (1) { delay(1000); }
  }
  Serial.println(F("[RTOS] Mutex berhasil dibuat."));

  // --- Inisialisasi pin sensor ---
  pinMode(PIN_WATER_LEVEL_ATAS, INPUT_PULLUP);
  pinMode(PIN_WATER_LEVEL_BAWAH, INPUT_PULLUP);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // --- Inisialisasi pin relay ---
  pinMode(PIN_POMPA_BAWAH, OUTPUT);
  pinMode(PIN_KOMPRESOR, OUTPUT);
  pinMode(PIN_POMPA_OUT, OUTPUT);
  pinMode(PIN_BLOWER, OUTPUT);

  digitalWrite(PIN_POMPA_BAWAH, LOW);
  digitalWrite(PIN_KOMPRESOR, LOW);
  digitalWrite(PIN_POMPA_OUT, LOW);
  digitalWrite(PIN_BLOWER, LOW);

  // --- Inisialisasi PWM Kipas ---
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  ledcAttach(PIN_KIPAS_PWM, PWM_FREQ, PWM_RESOLUTION);
#else
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(PIN_KIPAS_PWM, PWM_CHANNEL);
#endif
  setKipas_safe(0);

  // --- WiFi (non-blocking, bisa gagal) ---
  WiFi.config(local_IP, gateway_ip, subnet, dns_ip);
  WiFi.begin(ssid, password);

  Serial.print("[WIFI] Menghubungkan");
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 20) {
    delay(500);
    Serial.print(".");
    attempt++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Terhubung! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println(F("\n[WIFI] Belum terhubung. Sistem tetap jalan, WiFi akan retry otomatis."));
  }

  // --- MQTT ---
  mqtt.setServer(mqtt_server, mqtt_port);
  mqtt.setCallback(mqttCallback);

  // --- Print info MQTT Topics ---
  Serial.println(F("============================================================"));
  Serial.println(F("MQTT Topics:"));
  Serial.println(F("  Subscribe:"));
  Serial.printf("    %-30s  => ON/OFF (produksi)\n", TOPIC_SUB_KOMPRESOR);
  Serial.printf("    %-30s  => ON/OFF (keluarkan air)\n", TOPIC_SUB_POMPA_OUT);
  Serial.printf("    %-30s  => 0-100 (kipas manual)\n", TOPIC_SUB_KIPAS);
  Serial.printf("    %-30s  => ON/OFF (mode kuras)\n", TOPIC_SUB_KURAS);
  Serial.println(F("  Publish:"));
  Serial.printf("    %-30s  => level tangki atas\n", TOPIC_PUB_WATER_ATAS);
  Serial.printf("    %-30s  => level tangki bawah\n", TOPIC_PUB_WATER_BAWAH);
  Serial.printf("    %-30s  => raw ADC suhu\n", TOPIC_PUB_SUHU_EVA);
  Serial.printf("    %-30s  => status kompresor\n", TOPIC_PUB_KOMPRESOR);
  Serial.printf("    %-30s  => status blower\n", TOPIC_PUB_BLOWER);
  Serial.printf("    %-30s  => status pompa bawah\n", TOPIC_PUB_POMPA_BAWAH);
  Serial.printf("    %-30s  => status pompa out\n", TOPIC_PUB_POMPA_OUT);
  Serial.printf("    %-30s  => kecepatan kipas (%%)\n", TOPIC_PUB_KIPAS);
  Serial.printf("    %-30s  => mode (IDLE/PRODUKSI/KURAS)\n", TOPIC_PUB_MODE);
  Serial.printf("    %-30s  => status kuras\n", TOPIC_PUB_KURAS);
  Serial.println(F("============================================================"));

  // --- Buat FreeRTOS Tasks ---
  // Task Sensor & Kontrol: Core 1, prioritas 2 (lebih tinggi = lebih penting)
  // Stack 4096 bytes cukup untuk ADC + kontrol relay
  xTaskCreatePinnedToCore(
    taskSensorKontrol,   // Fungsi task
    "SensorKontrol",     // Nama task
    4096,                // Stack size (bytes)
    NULL,                // Parameter
    2,                   // Prioritas (2 = tinggi, kontrol real-time)
    &taskSensorHandle,   // Handle
    1                    // Core 1 (APP_CPU)
  );

  // Task Network: Core 0, prioritas 1 (lebih rendah, WiFi/MQTT bisa delay)
  // Stack 8192 bytes untuk WiFi + MQTT + String operations
  xTaskCreatePinnedToCore(
    taskNetwork,         // Fungsi task
    "Network",           // Nama task
    8192,                // Stack size (bytes)
    NULL,                // Parameter
    1,                   // Prioritas (1 = normal, network boleh delay)
    &taskNetworkHandle,  // Handle
    0                    // Core 0 (PRO_CPU)
  );

  Serial.println(F("[RTOS] Task Sensor (Core 1) & Network (Core 0) berhasil dibuat."));
  Serial.println(F("============================================================\n"));
}

// ============================================================
//  LOOP (kosong — semua kerja dilakukan oleh FreeRTOS tasks)
// ============================================================
void loop() {
  // Tidak digunakan. Semua logika ada di taskSensorKontrol & taskNetwork.
  // loop() berjalan di Core 1 dengan prioritas 1 (di bawah task sensor).
  vTaskDelay(pdMS_TO_TICKS(1000));
}
