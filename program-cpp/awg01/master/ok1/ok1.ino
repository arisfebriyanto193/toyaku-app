#include <WiFi.h>
#include <PubSubClient.h>

/* ===== WIFI ===== */
const char* ssid = "Toyaku2025";
const char* password = "Toyaku2025";

IPAddress local_IP(192, 168, 0, 2);
IPAddress gateway(192, 168, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

/* ===== MQTT ===== */
const char* mqtt_server = "192.168.0.100";
WiFiClient espClient;
PubSubClient client(espClient);

/* ===== PIN ===== */
const int relayFan   = 13;
const int relayKomp  = 12;
const int relayValve = 27;
const int relayPompa = 14;

const int sensorAtas  = 32;
const int sensorBawah = 34;

/* ===== FAN TIMER ===== */
#define FAN_INTERVAL 60000UL
#define FAN_ON_TIME  10000UL

unsigned long lastFanCycle = 0;
unsigned long fanOnStart   = 0;
bool fanRunning = false;

/* ===== VARIABLE ===== */
int waterlevel = 0;

/* request dari MQTT */
bool reqKomp  = false;
bool reqValve = false;
bool modeKuras = false;

/* status relay real */
bool statKomp  = false;
bool statValve = false;
bool statPompa = false;

/* last status */
bool lastKomp  = false;
bool lastValve = false;
bool lastPompa = false;
int  lastWater = -1;

unsigned long lastCheck = 0;

/* ===== ADC STABIL ===== */
int bacaADC(int pin) {
  int sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(pin);
    delay(5);
  }
  return sum / 10;
}

/* ===== SETUP ===== */
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 WATER SYSTEM START ===");

  pinMode(relayFan, OUTPUT);
  pinMode(relayKomp, OUTPUT);
  pinMode(relayValve, OUTPUT);
  pinMode(relayPompa, OUTPUT);

  pinMode(sensorAtas, INPUT_PULLUP);
  pinMode(sensorBawah, INPUT_PULLUP);

  digitalWrite(relayFan, LOW);
  digitalWrite(relayKomp, LOW);
  digitalWrite(relayPompa, LOW);
  digitalWrite(relayValve, LOW);

  WiFi.config(local_IP, gateway, subnet, dns);
  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

/* ===== MQTT CALLBACK ===== */
void callback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (uint8_t i = 0; i < length; i++) msg += (char)payload[i];

  Serial.print("[MQTT] ");
  Serial.print(topic);
  Serial.print(" => ");
  Serial.println(msg);

  if (String(topic) == "relay/1/status") {
    reqKomp = (msg == "ON");
  }

  if (String(topic) == "relay/2/status") {
    reqValve = (msg == "ON");
  }

  if (String(topic) == "kuras/status") {
    modeKuras = (msg == "ON");
    Serial.println(modeKuras ? "[MODE] KURAS AKTIF" : "[MODE] NORMAL");
  }
}

/* ===== MQTT RECONNECT ===== */
void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting MQTT...");
    if (client.connect("ESP32_WATER")) {
      Serial.println("OK");
      client.subscribe("relay/1/status");
      client.subscribe("relay/2/status");
      client.subscribe("kuras/status");
    } else {
      Serial.println("FAIL");
      delay(2000);
    }
  }
}

/* ===== WATER LEVEL ===== */
void bacaWaterLevel() {
  int val = bacaADC(sensorAtas);

  if (val <= 200)      waterlevel = 100;
  else if (val <= 2000) waterlevel = 70;
  else if (val <= 3200) waterlevel = 20;
  else                  waterlevel = 0;

  Serial.printf("[SENSOR] Atas ADC=%d -> %d%%\n", val, waterlevel);
}

/* ===== FAN CONTROL ===== */

/* ===== LOOP ===== */
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

 

  if (millis() - lastCheck > 1000) {
    lastCheck = millis();

    bacaWaterLevel();
    int waterBawah = analogRead(sensorBawah);

    /* ===== KOMPRESOR ===== */
    if (waterlevel == 100) {
      statKomp = false;
      reqKomp  = false;
    } else {
      statKomp = reqKomp;
    }

    /* ===== VALVE ===== */
    statValve = reqValve;

    /* ===== POMPA ===== */
    if (modeKuras) {
      // MODE KURAS
      if (waterlevel == 100) {
        statPompa = false;
        modeKuras = false; // otomatis balik normal
        Serial.println("[KURAS] Tangki atas penuh -> STOP");
        client.publish("kuras/status", "OFF", true);
      } else {
        statPompa = true;
      }
    } else {
      // MODE NORMAL
      statPompa = (waterBawah <= 2500);
    }

    Serial.println("Water bawah: " + String(waterBawah));

    digitalWrite(relayKomp, statKomp);
       digitalWrite(relayFan, statKomp);
    digitalWrite(relayPompa, statPompa);
    digitalWrite(relayValve, statValve);

    /* ===== MQTT PUBLISH ===== */
    if (waterlevel != lastWater) {
      client.publish("sensor/water", String(waterlevel).c_str(), true);
      lastWater = waterlevel;
    }

    if (statKomp != lastKomp) {
      client.publish("relay/1/status", statKomp ? "ON" : "OFF", true);
      lastKomp = statKomp;
    }

    if (statValve != lastValve) {
      client.publish("relay/2/status", statValve ? "ON" : "OFF", true);
      lastValve = statValve;
    }

    if (statPompa != lastPompa) {
      client.publish("status/pompa", statPompa ? "ON" : "OFF", true);
      lastPompa = statPompa;
    }

    Serial.println("----------------------------------");
  }
}
