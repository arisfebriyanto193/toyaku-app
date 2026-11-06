#include <PZEM004Tv30.h>
#include <SoftwareSerial.h>

// RX, TX
SoftwareSerial pzemSerial(D6, D5);
PZEM004Tv30 pzem(pzemSerial);

void setup() {
  Serial.begin(9600);
  pzemSerial.begin(9600);

  Serial.println("PZEM-004T + Wemos D1 Mini");
}

void loop() {
  float voltage = pzem.voltage();
  float current = pzem.current();
  float power   = pzem.power();
  float energy  = pzem.energy();
  float freq    = pzem.frequency();
  float pf      = pzem.pf();

  if (!isnan(voltage)) {
    Serial.print("Tegangan: ");
    Serial.print(voltage);
    Serial.println(" V");
  }

  if (!isnan(current)) {
    Serial.print("Arus: ");
    Serial.print(current);
    Serial.println(" A");
  }

  if (!isnan(power)) {
    Serial.print("Daya: ");
    Serial.print(power);
    Serial.println(" W");
  }

  if (!isnan(energy)) {
    Serial.print("Energi: ");
    Serial.print(energy);
    Serial.println(" Wh");
  }

  if (!isnan(freq)) {
    Serial.print("Frekuensi: ");
    Serial.print(freq);
    Serial.println(" Hz");
  }

  if (!isnan(pf)) {
    Serial.print("Power Factor: ");
    Serial.println(pf);
  }

  Serial.println("---------------------------");
  delay(2000);
}
