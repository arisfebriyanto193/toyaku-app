#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

/* ============================================================
 *  AWG (Atmospheric Water Generator) - Panel Tombol & Sensor Lingkungan
 *  Board: Wemos D1 Mini (ESP8266)
 *  
 *  INTEGRASI TOPIK MQTT DENGAN ESP32 MASTER (main.ino):
 *    - BTN1 (D5) -> Kompresor / Produksi : "awg/cmd/kompresor"  & "relay/1/status"
 *    - BTN2 (D7) -> Pompa Out (Air Kran) : "awg/cmd/pompa_out"   & "relay/2/status"
 *    - BTN3 (D6) -> Mode Kuras Tangki    : "awg/cmd/kuras"       & "kuras/status"
 *    - DHT11 (D2) -> Suhu & Kelembaban   : "awg/sensor/temp", "awg/sensor/humidity"
 *    - MQ-2 (A0)  -> Kualitas Udara (Gas): "awg/sensor/air"
 * ============================================================ */

/* ================= WIFI ================= */
const char* ssid     = "awg02";
const char* password = "awg12345678";

/* ======== STATIC IP SETTING ======== */
IPAddress local_IP(192, 168, 0, 30);
IPAddress gateway(192, 168, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

/* ================= MQTT BROKER ================= */
const char* mqtt_server   = "192.168.0.101";
const int   mqtt_port     = 1883;
const char* mqtt_clientID = "Wemos_AWG_Tombol";

/* ================= TOPIK MQTT ================= */
// -- Perintah Kontrol ke ESP32 Master (main.ino) --
const char* TOPIC_CMD_KOMPRESOR  = "awg/cmd/kompresor";
const char* TOPIC_CMD_POMPA_OUT  = "awg/cmd/pompa_out";
const char* TOPIC_CMD_KURAS      = "awg/cmd/kuras";

// -- Topik Legacy (Kompatibilitas Sistem & Web) --
const char* TOPIC_LEGACY_RELAY1  = "relay/1/status";
const char* TOPIC_LEGACY_RELAY2  = "relay/2/status";
const char* TOPIC_LEGACY_KURAS   = "kuras/status";

// -- Topik Sensor Lingkungan DHT & MQ-2 --
const char* TOPIC_PUB_TEMP       = "awg/sensor/temp";
const char* TOPIC_PUB_HUM        = "awg/sensor/humidity";
const char* TOPIC_PUB_AIR        = "awg/sensor/air";

const char* TOPIC_LEGACY_TEMP    = "sensor/temp";
const char* TOPIC_LEGACY_HUM     = "sensor/humidity";
const char* TOPIC_LEGACY_AIR     = "sensor/air";

/* ================= DEFINISI PIN ================= */
#define BTN1     D5  // Kompresor (R2 di master ESP32)
#define BTN2     D7  // Pompa Out (R3 di master ESP32)
#define BTN3     D6  // Mode Kuras (R1 di master ESP32)

#define DHTPIN   D2  // Sensor Suhu & Kelembaban DHT11
#define DHTTYPE  DHT11
#define MQ02_PIN A0  // Sensor Gas MQ-02

WiFiClient espClient;
PubSubClient client(espClient);
DHT dht(DHTPIN, DHTTYPE);

// Status nilai terakhir tombol
int lastVal1 = -1;
int lastVal2 = -1;
int lastVal3 = -1;

// Debouncing tombol
unsigned long lastDebounceTime1 = 0;
unsigned long lastDebounceTime2 = 0;
unsigned long lastDebounceTime3 = 0;
const unsigned long DEBOUNCE_DELAY = 50; // ms

// Timer pengiriman sensor
unsigned long lastSensorMillis = 0;
const long sensorInterval = 5000; // Tiap 5 detik

// Timer reconnect MQTT non-blocking
unsigned long lastReconnectAttempt = 0;
const unsigned long RECONNECT_INTERVAL = 3000; // ms

/* ================= SETUP WIFI ================= */
void setup_wifi() {
  Serial.print(F("[WIFI] Menghubungkan ke "));
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.config(local_IP, gateway, subnet, dns);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Terhubung! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println(F("\n[WIFI] Belum terhubung. Percobaan ulang berjalan di background."));
  }
}

/* ================= MQTT RECONNECT (NON-BLOCKING) ================= */
bool reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.print(F("[MQTT] Menghubungkan ke broker..."));
  if (client.connect(mqtt_clientID)) {
    Serial.println(F(" OK!"));
    return true;
  } else {
    Serial.printf(" GAGAL (rc=%d). Coba lagi nanti.\n", client.state());
    return false;
  }
}

/* ================= SETUP ================= */
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println(F("\n============================================================"));
  Serial.println(F("  AWG - Modul Tombol & Sensor Lingkungan (Wemos D1 Mini)"));
  Serial.println(F("  Terintegrasi dengan ESP32 Master (main.ino)"));
  Serial.println(F("============================================================"));

  pinMode(BTN1, INPUT_PULLUP);
  pinMode(BTN2, INPUT_PULLUP);
  pinMode(BTN3, INPUT_PULLUP);

  dht.begin();
  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
}

/* ================= LOOP ================= */
void loop() {
  // Reconnect WiFi & MQTT secara non-blocking
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      unsigned long now = millis();
      if (now - lastReconnectAttempt >= RECONNECT_INTERVAL) {
        lastReconnectAttempt = now;
        reconnectMQTT();
      }
    } else {
      client.loop();
    }
  }

  unsigned long currentMillis = millis();

  // ===== BACA STATUS TOMBOL (INPUT_PULLUP: LOW = 1/ON, HIGH = 0/OFF) =====
  int raw1 = (digitalRead(BTN1) == LOW) ? 1 : 0;
  int raw2 = (digitalRead(BTN2) == LOW) ? 1 : 0;
  int raw3 = (digitalRead(BTN3) == LOW) ? 1 : 0;

  // --- BTN 1: Kompresor ---
  if (raw1 != lastVal1 && (currentMillis - lastDebounceTime1 > DEBOUNCE_DELAY)) {
    lastDebounceTime1 = currentMillis;
    lastVal1 = raw1;
    const char* state = raw1 ? "ON" : "OFF";
    Serial.printf("[TOMBOL] BTN1 Kompresor -> %s\n", state);

    if (client.connected()) {
      // Kirim perintah ke ESP32 Master
      client.publish(TOPIC_CMD_KOMPRESOR, state, true);
      // Kirim juga ke topik legacy agar dashboard sinkron
      client.publish(TOPIC_LEGACY_RELAY1, state, true);
    }
  }

  // --- BTN 2: Pompa Out (Air Kran) ---
  if (raw2 != lastVal2 && (currentMillis - lastDebounceTime2 > DEBOUNCE_DELAY)) {
    lastDebounceTime2 = currentMillis;
    lastVal2 = raw2;
    const char* state = raw2 ? "ON" : "OFF";
    Serial.printf("[TOMBOL] BTN2 Pompa Out -> %s\n", state);

    if (client.connected()) {
      // Kirim perintah ke ESP32 Master
      client.publish(TOPIC_CMD_POMPA_OUT, state, true);
      // Kirim juga ke topik legacy
      client.publish(TOPIC_LEGACY_RELAY2, state, true);
    }
  }

  // --- BTN 3: Mode Kuras ---
  if (raw3 != lastVal3 && (currentMillis - lastDebounceTime3 > DEBOUNCE_DELAY)) {
    lastDebounceTime3 = currentMillis;
    lastVal3 = raw3;
    const char* state = raw3 ? "ON" : "OFF";
    Serial.printf("[TOMBOL] BTN3 Mode Kuras -> %s\n", state);

    if (client.connected()) {
      // Kirim perintah ke ESP32 Master
      client.publish(TOPIC_CMD_KURAS, state, true);
      // Kirim juga ke topik legacy
      client.publish(TOPIC_LEGACY_KURAS, state, true);
    }
  }

  // ===== BACA & PUBLISH SENSOR DHT11 & MQ-2 =====
  if (currentMillis - lastSensorMillis > sensorInterval) {
    lastSensorMillis = currentMillis;

    float h = dht.readHumidity();
    float t = dht.readTemperature();
    int gasValue = analogRead(MQ02_PIN);

    if (!isnan(t) && !isnan(h)) {
      char tempStr[8];
      char humStr[8];
      char gasStr[8];

      dtostrf(t, 1, 2, tempStr);
      dtostrf(h, 1, 2, humStr);
      itoa(gasValue, gasStr, 10);

      if (client.connected()) {
        // Publish ke namespace awg/sensor/*
        client.publish(TOPIC_PUB_TEMP, tempStr, true);
        client.publish(TOPIC_PUB_HUM, humStr, true);
        client.publish(TOPIC_PUB_AIR, gasStr, true);

        // Publish ke namespace legacy sensor/*
        client.publish(TOPIC_LEGACY_TEMP, tempStr, true);
        client.publish(TOPIC_LEGACY_HUM, humStr, true);
        client.publish(TOPIC_LEGACY_AIR, gasStr, true);
      }

      Serial.println(F("=== SENSOR LINGKUNGAN ==="));
      Serial.printf("  Suhu Udara       : %s C\n", tempStr);
      Serial.printf("  Kelembaban Udara : %s %%\n", humStr);
      Serial.printf("  Gas MQ-02 (ADC)  : %s\n", gasStr);
    } else {
      Serial.println(F("[SENSOR] Gagal membaca data dari DHT11!"));
    }
  }

  delay(20);
}
