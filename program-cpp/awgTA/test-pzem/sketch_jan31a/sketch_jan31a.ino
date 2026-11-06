#include <PZEM004Tv30.h>

/* ===== PZEM UART ===== */
#define PZEM_RX 17
#define PZEM_TX 16

// BUAT OBJEK PZEM (INI PENTING)
PZEM004Tv30 pzem(Serial2, PZEM_RX, PZEM_TX);

void setup() {
  Serial.begin(115200);
  Serial.println("=== PZEM004T TEST START ===");

  // INIT UART2 ESP32
  Serial2.begin(9600, SERIAL_8N1, PZEM_RX, PZEM_TX);
}

void loop() {
  float voltage   = pzem.voltage();
  float current   = pzem.current();
  float power     = pzem.power();
  float energy    = pzem.energy();
  float frequency = pzem.frequency();
  float pf        = pzem.pf();

  if (isnan(voltage)) {
    Serial.println("PZEM NOT DETECTED");
  } else {
    Serial.print("Voltage   : "); Serial.print(voltage);   Serial.println(" V");
    Serial.print("Current   : "); Serial.print(current);   Serial.println(" A");
    Serial.print("Power     : "); Serial.print(power);     Serial.println(" W");
    Serial.print("Energy    : "); Serial.print(energy);    Serial.println(" kWh");
    Serial.print("Frequency : "); Serial.print(frequency); Serial.println(" Hz");
    Serial.print("PF        : "); Serial.println(pf);
    Serial.println("----------------------------");
  }

  delay(1000);
}
