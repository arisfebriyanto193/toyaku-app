#include <ESP8266WiFi.h>
#include <PubSubClient.h>

/* ================= WIFI ================= */
const char* ssid     = "awg02";
const char* password = "awg12345678";

/* ======== STATIC IP SETTING ======== */
IPAddress local_IP(192, 168, 0, 50);
IPAddress gateway(192, 168, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

/* ================= MQTT ================= */
const char* mqtt_server = "192.168.0.101"; // IP broker MQTT
const int mqtt_port = 1883;

/* ================= TOPIC ================= */
const char* topic1 = "relay/1/status";
const char* topic2 = "relay/2/status";
const char* topic3 = "relay/3/status";

/* ================= PIN ================= */
// Sesuaikan dengan wiringsensor/humidity
#define BTN1 D5 ///kompresor
#define BTN2 D7 //out
#define BTN3 D6 //

WiFiClient espClient;
PubSubClient client(espClient);

int lastVal1 = -1;
int lastVal2 = -1;
int lastVal3 = -1;


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
      // connected

      Serial.println("mqtt ok");
    } else {
      delay(2000);
    }
  }
}

/* ================= SETUP ================= */
void setup() {
  pinMode(BTN1, INPUT_PULLUP);
  pinMode(BTN2, INPUT_PULLUP);
  pinMode(BTN3, INPUT_PULLUP);
Serial.begin(115200);
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

  // ===== BTN 1 =====
  if (val1 != lastVal1) {
    if (val1 == 1) {
      client.publish(topic1, "ON");
    } else {
      client.publish(topic1, "OFF");
    }
    lastVal1 = val1;
    Serial.println("BTN1 -> " + String(val1 == 1 ? "ON" : "OFF"));
  }

  // ===== BTN 2 =====
  if (val2 != lastVal2) {
    if (val2 == 1) {
      client.publish(topic2, "ON");
    } else {
      client.publish(topic2, "OFF");
    }
    lastVal2 = val2;
    Serial.println("BTN2 -> " + String(val2 == 1 ? "ON" : "OFF"));
  }

  // ===== BTN 3 =====
  if (val3 != lastVal3) {
    if (val3 == 1) {
      client.publish(topic3, "ON");
    } else {
      client.publish(topic3, "OFF");
    }
    lastVal3 = val3; 
    Serial.println("BTN3 -> " + String(val3 == 1 ? "ON" : "OFF"));
  }

  delay(50);
}
