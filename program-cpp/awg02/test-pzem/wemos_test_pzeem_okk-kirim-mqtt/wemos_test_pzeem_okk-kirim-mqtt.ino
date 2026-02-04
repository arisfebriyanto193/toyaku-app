#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <PZEM004Tv30.h>
#include <SoftwareSerial.h>

// ================= WIFI & MQTT =================
#define WIFI_SSID     "awg02"
#define WIFI_PASSWORD "awg12345678"

#define MQTT_SERVER   "192.168.0.101"
#define MQTT_PORT     1883
#define MQTT_CLIENTID "wemos-pzem-01"

// ================= PZEM =================
SoftwareSerial pzemSerial(D6, D5); // RX, TX
PZEM004Tv30 pzem(pzemSerial);

// ================= MQTT =================
WiFiClient espClient;
PubSubClient client(espClient);

// ================= FUNCTION =================
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (uint8_t i = 0; i < length; i++) msg += (char)payload[i];

  if (String(topic) == "pzem004t/energy/reset" && msg == "reset") {
    pzem.resetEnergy();
    Serial.println("Energy RESET via MQTT");
  }
}

void connectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting MQTT...");
    if (client.connect(MQTT_CLIENTID)) {
      Serial.println("Connected");
      client.subscribe("pzem004t/energy/reset");
    } else {
      Serial.print("Failed, rc=");
      Serial.print(client.state());
      delay(2000);
    }
  }
}

void publishValue(const char* topic, float value) {
  if (!isnan(value)) {
    char payload[16];
    dtostrf(value, 1, 2, payload);
    client.publish(topic, payload, true);
  }
}

// ================= SETUP =================
void setup() {
  Serial.begin(9600);
  pzemSerial.begin(9600);

  connectWiFi();
  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(mqttCallback);
}

// ================= LOOP =================
void loop() {
  if (!client.connected()) connectMQTT();
  client.loop();

  publishValue("pzem004t/voltage",   pzem.voltage());
  publishValue("pzem004t/current",   pzem.current());
  publishValue("pzem004t/power",     pzem.power());
  publishValue("pzem004t/energy",    pzem.energy());
  publishValue("pzem004t/pf",        pzem.pf());
  publishValue("pzem004t/frequency", pzem.frequency());

  delay(2000);
}
