#include <Arduino.h>

// R1 POMPA_BAWAH
// R2 KOMPRESOR
// R3 POMPA_OUT
// R4 BLOWER

/*
data adc water level

lev0 (3247) 
lev1(2480) 
lev2 (1470)  
lev3 (0)
*/

// ===== DEFINISI PIN SENSOR ANALOG =====
const int PIN_WATER_LEVEL_ATAS  = 32; // ADC1_CH4 (Mendukung internal pull-up)
const int PIN_WATER_LEVEL_BAWAH = 33; // ADC1_CH5 (Mendukung internal pull-up)
const int PIN_SUHU_EVA          = 34; // ADC1_CH6 (Input only, tanpa internal pull-up)

// ===== DEFINISI PIN RELAY (AKTIF HIGH) =====
const int PIN_RELAY_1 = 13; // GPIO 13
const int PIN_RELAY_2 = 14; // GPIO 14
const int PIN_RELAY_3 = 12; // GPIO 12
const int PIN_RELAY_4 = 27; // GPIO 27
const int NUM_RELAY   = 4;
const int PIN_RELAY[NUM_RELAY] = {PIN_RELAY_1, PIN_RELAY_2, PIN_RELAY_3, PIN_RELAY_4};
bool statusRelay[NUM_RELAY] = {false, false, false, false};

// ===== DEFINISI PIN & KONFIGURASI PWM KIPAS =====
const int PIN_KIPAS_PWM = 2; // GPIO 2 (D2 di board ESP32)

// Konfigurasi PWM
const int PWM_FREQ       = 25000; // 25 kHz (frekuensi standar kipas DC / 4-pin PWM)
const int PWM_CHANNEL    = 0;     // Channel 0 (untuk ESP32 Core < 3.0)
const int PWM_RESOLUTION = 8;     // Resolusi 8-bit (nilai 0 - 255)

// Variabel status kecepatan kipas (0 - 255)
int kecepatanKipasPWM = 0;

// Fungsi untuk mengatur relay ON/OFF (aktif HIGH)
void setRelay(int relayIdx, bool state) {
  if (relayIdx < 0 || relayIdx >= NUM_RELAY) return;
  statusRelay[relayIdx] = state;
  digitalWrite(PIN_RELAY[relayIdx], state ? HIGH : LOW);
  Serial.print(F(">>> Relay "));
  Serial.print(relayIdx + 1);
  Serial.print(F(" (GPIO "));
  Serial.print(PIN_RELAY[relayIdx]);
  Serial.print(F("): "));
  Serial.println(state ? F("ON") : F("OFF"));
}

// Fungsi untuk mengatur kecepatan kipas (0 - 255)
void setKecepatanKipas(int duty) {
  duty = constrain(duty, 0, 255);
  kecepatanKipasPWM = duty;

  // Kompatibilitas untuk ESP32 Core v2.x dan v3.x
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  ledcWrite(PIN_KIPAS_PWM, duty);
#else
  ledcWrite(PWM_CHANNEL, duty);
#endif

  int persen = map(duty, 0, 255, 0, 100);
  Serial.print(F(">>> Kipas diset ke: "));
  Serial.print(persen);
  Serial.print(F("% (PWM Raw: "));
  Serial.print(duty);
  Serial.println(F("/255)"));
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Inisialisasi pull-up untuk sensor level air
  pinMode(PIN_WATER_LEVEL_ATAS, INPUT_PULLUP);
  pinMode(PIN_WATER_LEVEL_BAWAH, INPUT_PULLUP);

  // Resolusi ADC 12-bit (0 - 4095) & attenuasi 11dB (0 - 3.3V)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Konfigurasi PWM ESP32
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  ledcAttach(PIN_KIPAS_PWM, PWM_FREQ, PWM_RESOLUTION);
#else
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(PIN_KIPAS_PWM, PWM_CHANNEL);
#endif

  // Inisialisasi pin relay sebagai OUTPUT & matikan semua (aktif HIGH, awal LOW = OFF)
  for (int i = 0; i < NUM_RELAY; i++) {
    pinMode(PIN_RELAY[i], OUTPUT);
    digitalWrite(PIN_RELAY[i], LOW);
  }

  // Matikan kipas saat awal menyala
  setKecepatanKipas(0);

  Serial.println(F("========================================================"));
  Serial.println(F(" ESP32 Debug: Sensor ADC, PWM Kipas & Relay Test        "));
  Serial.println(F("========================================================"));
  Serial.println(F("Perintah Serial Monitor:"));
  Serial.println(F("  0-100   : Atur kecepatan kipas (0% - 100%)"));
  Serial.println(F("  R1ON    : Relay 1 (GPIO 13) ON"));
  Serial.println(F("  R1OFF   : Relay 1 (GPIO 13) OFF"));
  Serial.println(F("  R2ON    : Relay 2 (GPIO 14) ON"));
  Serial.println(F("  R2OFF   : Relay 2 (GPIO 14) OFF"));
  Serial.println(F("  R3ON    : Relay 3 (GPIO 12) ON"));
  Serial.println(F("  R3OFF   : Relay 3 (GPIO 12) OFF"));
  Serial.println(F("  R4ON    : Relay 4 (GPIO 27) ON"));
  Serial.println(F("  R4OFF   : Relay 4 (GPIO 27) OFF"));
  Serial.println(F("  ALLON   : Semua relay ON"));
  Serial.println(F("  ALLOFF  : Semua relay OFF"));
  Serial.println(F("--------------------------------------------------------"));
}

void loop() {
  // 1. Cek input Serial Monitor untuk kontrol kipas & relay
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    input.toUpperCase();

    // --- Perintah Relay ---
    if (input == "R1ON")       { setRelay(0, true);  }
    else if (input == "R1OFF") { setRelay(0, false); }
    else if (input == "R2ON")  { setRelay(1, true);  }
    else if (input == "R2OFF") { setRelay(1, false); }
    else if (input == "R3ON")  { setRelay(2, true);  }
    else if (input == "R3OFF") { setRelay(2, false); }
    else if (input == "R4ON")  { setRelay(3, true);  }
    else if (input == "R4OFF") { setRelay(3, false); }
    else if (input == "ALLON") {
      for (int i = 0; i < NUM_RELAY; i++) setRelay(i, true);
    }
    else if (input == "ALLOFF") {
      for (int i = 0; i < NUM_RELAY; i++) setRelay(i, false);
    }
    // --- Perintah Kipas (angka 0-100) ---
    else {
      int inputVal = input.toInt();
      // toInt() mengembalikan 0 jika bukan angka, cek apakah memang "0"
      if (input == "0" || (inputVal > 0 && inputVal <= 100)) {
        int duty = map(inputVal, 0, 100, 0, 255);
        setKecepatanKipas(duty);
      } else {
        Serial.println(F("Input tidak valid! Ketik 0-100 (kipas) atau R1ON/R1OFF dst (relay)."));
      }
    }
  }

  // 2. Baca nilai mentah sensor analog
  int rawWaterAtas  = analogRead(PIN_WATER_LEVEL_ATAS);
  int rawWaterBawah = analogRead(PIN_WATER_LEVEL_BAWAH);
  int rawSuhuEva    = analogRead(PIN_SUHU_EVA);

  // 3. Tampilkan data ke Serial Monitor
  Serial.print(F("Atas (GPIO 32): "));
  Serial.print(rawWaterAtas);
  Serial.print(F("\t | Bawah (GPIO 33): "));
  Serial.print(rawWaterBawah);
  Serial.print(F("\t | Suhu Eva (GPIO 34): "));
  Serial.print(rawSuhuEva);
  Serial.print(F("\t | Kipas (D2): "));
  Serial.print(map(kecepatanKipasPWM, 0, 255, 0, 100));
  Serial.print(F("%"));

  // 4. Tampilkan status relay
  Serial.print(F("\t | Relay: "));
  for (int i = 0; i < NUM_RELAY; i++) {
    Serial.print(F("R"));
    Serial.print(i + 1);
    Serial.print(F("="));
    Serial.print(statusRelay[i] ? F("ON") : F("OFF"));
    if (i < NUM_RELAY - 1) Serial.print(F(" "));
  }
  Serial.println();

  delay(500);
}