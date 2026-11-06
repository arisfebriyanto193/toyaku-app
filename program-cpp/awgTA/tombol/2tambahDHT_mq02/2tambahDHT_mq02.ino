#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

/* ================= WIFI ================= */
const char* ssid     = "awg02";
const char* password = "awg12345678";

/* ======== STATIC IP SETTING ======== */
IPAddress local_IP(192, 168, 0, 30);
IPAddress gateway(192, 168, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

/* ================= MQTT ================= */
const char* mqtt_server = "192.168.0.101";
const int mqtt_port = 1883;

/* ================= TOPIC RELAY ================= */
const char* topic1 = "relay/1/status";
const char* topic2 = "relay/2/status";
const char* topic3 = "kuras/status";

/* ================= TOPIC SENSOR ================= */
const char* topicTemp = "sensor/temp";
const char* topicHum  = "sensor/humidity";
const char* topicGas  = "sensor/air";

/* ================= PIN ================= */
#define BTN1 D5
#define BTN2 D7
#define BTN3 D6

#define DHTPIN D2
#define DHTTYPE DHT11
#define MQ02_PIN A0

WiFiClient espClient;
PubSubClient client(espClient);
DHT dht(DHTPIN, DHTTYPE);

int lastVal1 = -1;
int lastVal2 = -1;
int lastVal3 = -1;

unsigned long lastSensorMillis = 0;
const long sensorInterval = 5000; // publish sensor tiap 5 detik

/* ================= FUNCTION ================= */
void setup_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.config(local_IP, gateway, subnet, dns);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect("WemosD1Mini")) {
      Serial.println("MQTT connected");
    } else {
      delay(2000);
    }
  }
}

/* ================= SETUP ================= */
void setup() {
  Serial.begin(115200);

  pinMode(BTN1, INPUT_PULLUP);
  pinMode(BTN2, INPUT_PULLUP);
  pinMode(BTN3, INPUT_PULLUP);

  dht.begin();
  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
}

/* ================= LOOP ================= */
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  int val1 = digitalRead(BTN1) == LOW ? 1 : 0;
  int val2 = digitalRead(BTN2) == LOW ? 1 : 0;
  int val3 = digitalRead(BTN3) == LOW ? 1 : 0;

Serial.println("bt 3 " + String(val3));
  // ===== BTN 1 =====
  if (val1 != lastVal1) {
    Serial.println("komp on/off");
    client.publish(topic1, val1 ? "ON" : "OFF");
    lastVal1 = val1;
  }

  // ===== BTN 2 =====
  if (val2 != lastVal2) {
    Serial.println("out on/off");
    client.publish(topic2, val2 ? "ON" : "OFF");
    lastVal2 = val2;
  }

  // ===== BTN 3 =====
  if (val3 != lastVal3) {
    Serial.println("kurass on/off");
    client.publish(topic3, val3 ? "ON" : "OFF");
    lastVal3 = val3;
  }

  // ===== SENSOR READ & MQTT PUBLISH =====
  unsigned long now = millis();
  if (now - lastSensorMillis > sensorInterval) {
    lastSensorMillis = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature(); // Celsius
    int gasValue = analogRead(MQ02_PIN);

    if (!isnan(t) && !isnan(h)) {
      char tempStr[8];
      char humStr[8];
      char gasStr[8];

      dtostrf(t, 1, 2, tempStr);
      dtostrf(h, 1, 2, humStr);
      itoa(gasValue, gasStr, 10);

      client.publish(topicTemp, tempStr);
      client.publish(topicHum, humStr);
      client.publish(topicGas, gasStr);

      Serial.println("=== SENSOR DATA ===");
      Serial.println("Temp : " + String(tempStr));
      Serial.println("Hum  : " + String(humStr));
      Serial.println("Gas  : " + String(gasStr));
    } else {
      Serial.println("Failed read DHT22");
    }
  }

  delay(50);
}
