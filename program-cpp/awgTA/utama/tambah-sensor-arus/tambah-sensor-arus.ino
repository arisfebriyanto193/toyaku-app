#include <WiFi.h>
#include <PubSubClient.h>
#include <PZEM004Tv30.h>

/* ===== WIFI ===== */
const char* ssid = "awg02";
const char* password = "awg12345678";

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

#define PZEM_RX 16
#define PZEM_TX 17

PZEM004Tv30 pzem(Serial2, PZEM_RX, PZEM_TX);


/* ===== FAN TIMER ===== */
#define FAN_INTERVAL 60000UL
#define FAN_ON_TIME  10000UL

unsigned long lastFanCycle = 0;
unsigned long fanOnStart   = 0;
bool fanRunning = false;

/* ===== VARIABLE ===== */
int waterlevel = 0;
bool reqKomp = false;
bool reqValve = false;

bool statKomp  = false;
bool statValve = false;
bool statPompa = false;

/* ===== LAST STATUS ===== */
bool lastKomp  = false;
bool lastValve = false;
bool lastPompa = false;
int  lastWater = -1;

/* ===== TIMER ===== */
unsigned long lastCheck = 0;
unsigned long lastPZEM  = 0;

/* ===== ADC STABIL ===== */
int bacaADC(int pin) {
  int sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(pin);
    delay(5);
  }
  return sum / 10;
}

/* ===== MQTT CALLBACK ===== */
void callback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (uint8_t i = 0; i < length; i++) msg += (char)payload[i];

  Serial.print("[MQTT] ");
  Serial.print(topic);
  Serial.print(" => ");
  Serial.println(msg);

  if (String(topic) == "relay/1/status") reqKomp = (msg == "ON");
  if (String(topic) == "relay/2/status") reqValve = (msg == "ON");
}

/* ===== MQTT CONNECT ===== */
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

  if (val <= 200)       waterlevel = 100;
  else if (val <= 2000) waterlevel = 70;
  else if (val <= 3200) waterlevel = 20;
  else                  waterlevel = 0;

  Serial.print("[WATER] ADC=");
  Serial.print(val);
  Serial.print(" -> ");
  Serial.print(waterlevel);
  Serial.println("%");
}

/* ===== FAN CONTROL ===== */
void kontrolFan() {
  if (!statKomp) {
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
    Serial.println("[FAN] ON");
  }

  if (fanRunning && (now - fanOnStart >= FAN_ON_TIME)) {
    fanRunning = false;
    lastFanCycle = now;
    digitalWrite(relayFan, LOW);
    Serial.println("[FAN] OFF");
  }
}

/* ===== PZEM READ & MQTT ===== */
void bacaPZEM() {
  float voltage   = pzem.voltage();
  float current   = pzem.current();
  float power     = pzem.power();
  float energy    = pzem.energy();
  float frequency = pzem.frequency();
  float pf        = pzem.pf();

  if (!isnan(voltage)) {
    client.publish("pzem004t/voltage", String(voltage, 1).c_str(), true);
    Serial.print("[PZEM] V = "); Serial.println(voltage);
  }
  if (!isnan(current)) {
    client.publish("pzem004t/current", String(current, 2).c_str(), true);
  }
  if (!isnan(power)) {
    client.publish("pzem004t/power", String(power, 1).c_str(), true);
  }
  if (!isnan(energy)) {
    client.publish("pzem004t/energy", String(energy, 2).c_str(), true);
  }
  if (!isnan(pf)) {
    client.publish("pzem004t/pf", String(pf, 2).c_str(), true);
  }
  if (!isnan(frequency)) {
    client.publish("pzem004t/frequency", String(frequency, 1).c_str(), true);
  }
}

/* ===== SETUP ===== */
void setup() {
  Serial.begin(115200);

  pinMode(relayFan, OUTPUT);
  pinMode(relayKomp, OUTPUT);
  pinMode(relayValve, OUTPUT);
  pinMode(relayPompa, OUTPUT);

  digitalWrite(relayValve, HIGH);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

Serial2.begin(9600, SERIAL_8N1, PZEM_RX, PZEM_TX);


  Serial.println("System ready");
}

/* ===== LOOP ===== */
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  kontrolFan();

  if (millis() - lastCheck > 1000) {
    lastCheck = millis();

    bacaWaterLevel();
    int waterBawah = bacaADC(sensorBawah);

    if (waterlevel == 100) {
      statKomp = false;
      reqKomp  = false;
    } else {
      statKomp = reqKomp;
    }

    statValve = reqValve;
    statPompa = (waterBawah <= 2800);

    digitalWrite(relayKomp, statKomp);
    digitalWrite(relayPompa, statPompa);
    digitalWrite(relayValve, statValve ? 1 : 0);

    if (waterlevel != lastWater) {
      client.publish("sensor/water", String(waterlevel).c_str(), true);
      lastWater = waterlevel;
    }

    if (statKomp != lastKomp) {
      client.publish("relay/1/status", statKomp ? "ON" : "OFF", true);
      lastKomp = statKomp;
    }
  }

  /* ===== PZEM tiap 2 detik ===== */
  if (millis() - lastPZEM > 2000) {
    lastPZEM = millis();
    bacaPZEM();
  }
}
