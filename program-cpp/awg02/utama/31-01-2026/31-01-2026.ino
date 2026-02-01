#include <WiFi.h>
#include <PubSubClient.h>

/* ===== WIFI ===== */
const char* ssid = "awg02";
const char* password = "awg12345678";

IPAddress local_IP(192, 168, 0, 51);
IPAddress gateway(192, 168, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

/* ===== MQTT ===== */
const char* mqtt_server = "192.168.0.101";
WiFiClient espClient;
PubSubClient client(espClient);

/* ===== PIN ===== */
const int relayFan   = 13;
const int relayKomp  = 12;
const int relayValve = 14;
const int relayPompa = 27;

const int sensorAtas  = 35;
const int sensorBawah = 34;

/* ===== FAN TIMER ===== */
#define FAN_INTERVAL 60000UL   // 1 menit
#define FAN_ON_TIME  10000UL   // 10 detik

unsigned long lastFanCycle = 0;
unsigned long fanOnStart   = 0;
bool fanRunning = false;

/* ===== VARIABLE ===== */
int waterlevel = 0;

/* request dari MQTT */
bool reqKomp = false;
bool reqValve = false;

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

  pinMode(sensorAtas, INPUT);
  pinMode(sensorBawah, INPUT);

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
}

/* ===== MQTT RECONNECT ===== */
void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting MQTT...");
    if (client.connect("ESP32_WATER")) {
      Serial.println("OK");
      client.subscribe("relay/1/status");
      client.subscribe("relay/2/status");
    } else {
      Serial.println("FAIL");
      delay(2000);
    }
  }
}

/* ===== WATER LEVEL ===== */
void bacaWaterLevel() {
  int val = bacaADC(sensorAtas);

  if (val <= 200) {            // full terendam
    waterlevel = 100;
  }
  else if (val <= 2000) {      // sekitar 70%
    waterlevel = 70;
  }
  else if (val <= 3200) {      // sekitar 20%
    waterlevel = 20;
  }
  else {                       // di atas 3200
    waterlevel = 0;
  }

  Serial.print("[SENSOR] Atas ADC=");
  Serial.print(val);
  Serial.print(" -> ");
  Serial.print(waterlevel);
  Serial.println("%");
}


/* ===== FAN CONTROL ===== */
void kontrolFan() {
  if (!statKomp) {
    // Kompresor mati → fan mati total
    digitalWrite(relayFan, LOW);
    fanRunning = false;
    lastFanCycle = millis();
    return;
  }

  unsigned long now = millis();

  if (!fanRunning && (now - lastFanCycle >= FAN_INTERVAL)) {
    fanRunning = true;
    fanOnStart = now;
    digitalWrite(relayFan, HIGH);
    Serial.println("[FAN] ON (cycle)");
  }

  if (fanRunning && (now - fanOnStart >= FAN_ON_TIME)) {
    fanRunning = false;
    lastFanCycle = now;
    digitalWrite(relayFan, LOW);
    Serial.println("[FAN] OFF");
  }
}

/* ===== LOOP ===== */
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  kontrolFan(); // jalan terus (non-blocking)

  if (millis() - lastCheck > 1000) {
    lastCheck = millis();

    bacaWaterLevel();
    int waterBawah = bacaADC(sensorBawah);

    /* ===== KOMPRESOR ===== */
    if (waterlevel == 100) {
      statKomp = false;
      reqKomp  = false;
      Serial.println("[LOGIC] Tangki penuh -> Kompresor DITOLAK");
    } else {
      statKomp = reqKomp;
    }

    /* ===== VALVE ===== */
    statValve = reqValve;

    /* ===== POMPA ===== */
    statPompa = (waterBawah <= 2500);

Serial.println("water bawah"  + String(waterBawah) + " status pompa bawah " + String(statPompa));

    digitalWrite(relayKomp, statKomp);
    digitalWrite(relayPompa, statPompa);
    digitalWrite(relayValve, statValve ? 1 : 0);

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

    Serial.println("--------------------------------------");
  }
}
