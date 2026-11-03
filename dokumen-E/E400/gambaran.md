# Gambaran Lengkap Isi Dokumen E-400 Tugas Akhir: TOYAKU
**Sistem Atmospheric Water Generator (AWG) Berbasis Internet of Things (IoT), Panel Surya, dan Analitik Prediktif**  
**Program Studi:** S1 Teknik Elektro, Fakultas Teknik, Universitas Dian Nuswantoro (UDINUS) Semarang  
**Dosen Pembimbing:** Prof. Ir. Heru Agus Santoso, Ph.D., IPM., ASEAN Eng.  
**Tim Capstone Design (4 Mahasiswa):**
1. **Aris Febriyanto** (NIM: E11.2023.01194) – *Firmware & Embedded IoT (ESP32 Master & Kontrol)*
2. **Ana Triliania Fajrin** (NIM: E11.2023.01211) – *Web Dashboard, MQTT Data Logger & AI Machine Learning*
3. **Dwi Devangga** (NIM: E11.2023.01218) – *Sistem Kelistrikan, PCB Toyaku, Panel Surya & Sensor V-I*
4. **Dzikru Nur Khayat** (NIM: E11.2023.01226) – *Sistem Mekanik, Termal, Evaporator Fan, Airflow & Rangka*

---

## 1. Analisis Komparasi: Template Prodi vs Dokumen Referensi vs Toyaku

Untuk menyusun Dokumen E-400 yang presisi dan sesuai standar kurikulum Capstone Design Teknik Elektro UDINUS, kita mengacu pada dua dokumen kunci:

### A. Template Resmi Prodi (`E400-ELE UDINUS 2022.docx`)
- **Tujuan Dokumen E-400**: Merupakan laporan **Implementasi dan Pengujian Sistem**. Dokumen ini bukan lagi mendiskusikan konsep atau rancangan teoritis (seperti E-100 hingga E-300), melainkan membuktikan bahwa sistem fisik telah **terwujud nyata (Hasil)** dan telah **diuji kinerjanya secara kuantitatif (Pengujian)**.
- **Struktur Wajib**:
  1. Halaman Judul & Pemeriksaan (Tabel Resmi UDINUS)
  2. Revisi Dokumen & Daftar Singkatan
  3. **1. Pengantar** (Ringkasan Dokumen & Fungsi Dokumen)
  4. **2. Implementasi** (Didekomposisi per Sub-sistem, masing-masing memiliki sub-bab `Hasil` dan `Pengujian`)
  5. **3. Kesimpulan** (Pernyataan kuantitatif keberhasilan setiap subsistem)
  6. Referensi (Format IEEE) & Lampiran.
- **Aturan Notasi**:
  - Semua gambar diawali dengan angka empat (`Gambar 4.1`, `Gambar 4.2`, dst.) dengan judul di bawah gambar.
  - Semua tabel diawali dengan angka empat (`Tabel 4.1`, `Tabel 4.2`, dst.) dengan judul di atas tabel.
  - Setiap gambar dan tabel wajib diacu (dirujuk) dalam paragraf penjelasan.

### B. Dokumen Referensi Rekan (`ELLEE 400 lengkap.pdf` - Proyek Filtrasi Asap)
Pada proyek rekan (Filter Asap Pembakaran Sampah), mereka membedah Bab 2 Implementasi menjadi 5 subsistem:
1. *2.1 Sistem Filtrasi Asap* (Fisik/Mekanik: wet scrubber, filter non-woven) $\rightarrow$ Pengujian konsentrasi PM2.5 & PM10 sebelum vs sesudah filter, efektivitas (%).
2. *2.2 Sistem Kelistrikan dan Daya* (PLN, MCB, PSU, step-down, SSR) $\rightarrow$ Pengujian tegangan & arus ke beban.
3. *2.3 Sistem Kontrol Sprayer* (ESP32, driver BTS7960 pompa, sensor Winsen) $\rightarrow$ Pengujian respon PWM 3 level (50%, 75%, 100%).
4. *2.4 Sistem Pemantauan Kualitas Udara* (Sensor MQ-7, BME680, turbiditas) $\rightarrow$ Tabel komparasi akurasi sensor terhadap alat ukur standar (*Air Quality Detector*), perhitungan error (%).
5. *2.5 Sistem Monitoring* (Website & Database PostgreSQL) $\rightarrow$ Pengujian tampilan dashboard & verifikasi penyimpanan baris data.

### C. Pemetaan ke dalam Proyek TOYAKU
Berdasarkan dokumen Sempro (`E100`, `E200`, `E300`), skematik PCB (`pcb/SCH_awg-master`), dan aplikasi web IoT (`toyaku-app`), Toyaku adalah perangkat **Atmospheric Water Generator (AWG)** terintegrasi untuk Rumah Rakyat Kantor Gubernur Jawa Tengah. 

Maka pada Dokumen E-400 Toyaku, Bab 2 (Implementasi & Pengujian) didekomposisi menjadi **5 Subsistem Utama** yang mencerminkan pembagian tugas 4 anggota:
- **2.1 Subsistem Refrigerasi, Mekanik & Pemanen Air** *(Zikru & Devangga)*
- **2.2 Subsistem Kelistrikan, Catu Daya Surya & Baterai** *(Devangga & Aris)*
- **2.3 Subsistem Kendali Otomasi & Firmware ESP32 Master** *(Aris)*
- **2.4 Subsistem Monitoring Web Dashboard & Perekaman Data MQTT** *(Ana & Aris)*
- **2.5 Subsistem Analitik Prediktif & Machine Learning Prediksi Air** *(Ana)*

---

## 2. Struktur Rinci Halaman Dokumen E-400 TOYAKU

Berikut adalah gambaran rinci apa saja yang harus ditulis di setiap bagian Dokumen E-400 Toyaku:

```
HALAMAN SAMPUL / IDENTITAS DOKUMEN (Tabel Standar UDINUS)
DAFTAR ISI E-400
DAFTAR GAMBAR E-400
DAFTAR TABEL E-400
REVISI DOKUMEN
DAFTAR SINGKATAN
1. PENGANTAR
   1.1 Ringkasan Dokumen
   1.2 Fungsi Dokumen
2. IMPLEMENTASI & PENGUJIAN
   2.1 Subsistem Refrigerasi, Mekanik & Pemanen Air (Evaporator & Fan)
       2.1.1 Hasil
       2.1.2 Pengujian
             2.1.2.1 Pengujian Debit Aliran Udara Fan & Penurunan Suhu Kisi Evaporator
             2.1.2.2 Pengujian Laju Kondensasi & Volume Air Hasil Panen
             2.1.2.3 Pengujian Kualitas Fisik & Filtrasi Air Bersih (pH, TDS)
   2.2 Subsistem Kelistrikan, Catu Daya Surya & Baterai
       2.2.1 Hasil
       2.2.2 Pengujian
             2.2.2.1 Pengujian Distribusi Tegangan Bus Regulasi (12V, 5V, 3.3V)
             2.2.2.2 Pengujian Karakteristik Panel Surya & Pengisian Baterai Aki
             2.2.2.3 Pengujian Akurasi Sensor Pembacaan Tegangan (V) & Arus (I)
             2.2.2.4 Pengujian Proteksi Sekering & Siklus Beban Mandiri 24 Jam
   2.3 Subsistem Kendali Otomasi & Firmware ESP32 Master
       2.3.1 Hasil
       2.3.2 Pengujian
             2.3.2.1 Pengujian Akurasi Sensor Suhu & Kelembaban Udara (DHT22/SHT31)
             2.3.2.2 Pengujian Sensor Ketinggian Air (Water Level) & Proteksi Overflow
             2.3.2.3 Pengujian Kendali PWM Fan Evaporator & Switching Relay Pendingin
             2.3.2.4 Pengujian Kestabilan Firmware (FreeRTOS Watchdog & Auto-Reconnect)
   2.4 Subsistem Monitoring Web Dashboard & Perekaman Data MQTT
       2.4.1 Hasil
       2.4.2 Pengujian
             2.4.2.1 Pengujian Fungsionalitas Antarmuka Web Dashboard & Tombol Kendali
             2.4.2.2 Pengujian Keandalan Perekaman Data MQTT ke Database (Zero Loss)
             2.4.2.3 Pengujian Fitur Ekspor Log Data CSV & Query Riwayat
   2.5 Subsistem Analitik Prediktif & Machine Learning Prediksi Air
       2.5.1 Hasil
       2.5.2 Pengujian
             2.5.2.1 Pengujian Evaluasi Kinerja Model AI (Metrik MAE, RMSE, R²)
             2.5.2.2 Pengujian Validasi Prediksi AI vs Produksi Air Riil di Lapangan
3. KESIMPULAN
REFERENSI (Format IEEE)
LAMPIRAN
```

---

## 3. Rincian Konten Per Bab & Sub-Bab

### BAGIAN PEMBUKA
- **Halaman Judul**:
  - Judul Dokumen: *IMPLEMENTASI DAN PENGUJIAN SISTEM ATMOSPHERIC WATER GENERATOR (AWG) BERBASIS INTERNET OF THINGS (IOT), PANEL SURYA, DAN ANALITIK PREDIKTIF (TOYAKU)*
  - Jenis Dokumen: *E-400 / IMPLEMENTASI*
  - Tanggal Penerbitan: *November 2026*
  - Unit Penerbit: *Program Studi Teknik Elektro – Universitas Dian Nuswantoro*
  - Tim Penyusun: Aris Febriyanto, Ana Triliania Fajrin, Dwi Devangga, Dzikru Nur Khayat.
  - Pemeriksa: Dosen Pembimbing Prof. Ir. Heru Agus Santoso, Ph.D., IPM., ASEAN Eng.
- **Revisi Dokumen**: Tabel riwayat perbaikan naskah berdasarkan asistensi dengan Dosen Pembimbing.
- **Daftar Singkatan**: AWG, IoT, PV, SCC, MPPT, PWM, RH, ESP32, MQTT, VCC, GND, ADC, TDS, MAE, RMSE, $R^2$.

---

### BAB 1: PENGANTAR
- **1.1 Ringkasan Dokumen**:
  Menjelaskan bahwa dokumen E-400 ini menyajikan hasil realisasi fisik dan pengujian komprehensif dari prototipe sistem Toyaku. Sistem ini dirancang untuk memanen air bersih dari kelembaban atmosfer menggunakan siklus refrigerasi kompresi uap yang dioptimalkan dengan kipas evaporator terarah, disuplai secara mandiri oleh panel surya fotovoltaik dan baterai aki 12V, dipantau secara real-time melalui dashboard web berbasis MQTT, serta dilengkapi algoritma machine learning untuk memprediksi volume air yang dihasilkan berdasarkan kondisi suhu dan kelembaban lingkungan di Rumah Rakyat Kantor Gubernur Jawa Tengah.
- **1.2 Fungsi Dokumen**:
  Berfungsi sebagai laporan pertanggungjawaban kemajuan proyek Tugas Akhir (Laporan Kemajuan), membuktikan bahwa rancangan teknis pada dokumen E-300 telah diwujudkan dalam bentuk fisik, diuji kinerjanya sesuai parameter keberhasilan, dan siap menuju tahap evaluasi akhir (E-500).

---

### BAB 2: IMPLEMENTASI DAN PENGUJIAN

#### 2.1 Subsistem Refrigerasi, Mekanik & Pemanen Air (Evaporator & Fan)
*Penanggung Jawab: Dzikru Nur Khayat & Dwi Devangga*

- **2.1.1 Hasil**:
  - Deskripsi dan foto fisik modul kompresor, kondensor, dan kisi pendingin evaporator berfin aluminium.
  - Foto hasil pemasangan **High-Static Fan 12V tambahan pada kisi evaporator** lengkap dengan adapter bracket (3D print/plat) dan ducting pengarah aliran udara lembap.
  - Foto jalur talang penampung kondensat food-grade, selang silikon, tangki penampung air higienis berkapasitas 5–10 liter, serta tahapan penyaringan air (filter sedimen & karbon aktif).
  - Foto dimensi fisik keseluruhan rangka alat Toyaku (tinggi $\pm 123$ cm, lebar $\pm 63$ cm) yang memisahkan ruang basah dan ruang kering kelistrikan.
- **2.1.2 Pengujian**:
  - **2.1.2.1 Pengujian Debit Aliran Udara Fan & Suhu Evaporator**:
    - Metode: Mengukur kecepatan aliran udara ($m/s$) menggunakan anemometer dan suhu kisi evaporator ($^\circ C$) menggunakan termokopel/sensor digital saat kipas berputar pada kecepatan 50%, 75%, dan 100%.
    - Tabel 4.1: *Hasil Pengukuran Suhu Kisi Evaporator dan Titik Embun pada Berbagai Kecepatan Fan*.
    - Analisis: Membuktikan bahwa penambahan fan evaporator mampu mempercepat laju pertukaran kalor tanpa menyebabkan uap air terpental sebelum mengembun.
  - **2.1.2.2 Pengujian Laju Kondensasi & Volume Air Hasil Panen**:
    - Metode: Menjalankan alat selama rentang waktu 1 jam, 3 jam, dan 6 jam pada kondisi kelembaban udara berbeda (pagi hari RH 85%, siang terik RH 55%, sore hari RH 70%).
    - Tabel 4.2: *Laju Produksi Air Kondensasi (ml/jam) terhadap Kelembaban Relatif (RH)*.
    - Rumus perhitungan debit air: $Q = \frac{V_{air}}{\Delta t}$ (ml/jam).
  - **2.1.2.3 Pengujian Kualitas Fisik & Filtrasi Air Bersih**:
    - Metode: Mengukur parameter air hasil kondensasi sebelum dan sesudah melewati filter karbon aktif menggunakan TDS Meter (Total Dissolved Solids) dan pH Meter digital.
    - Tabel 4.3: *Perbandingan Parameter Fisik Air Hasil Kondensasi Sebelum dan Sesudah Filtrasi* (Target: TDS $< 50$ ppm, pH netral 6.8 – 7.5).

---

#### 2.2 Subsistem Kelistrikan, Catu Daya Surya & Baterai
*Penanggung Jawab: Dwi Devangga & Aris Febriyanto*

- **2.2.1 Hasil**:
  - Gambar 4.x: *Diagram Blok Sistem Kelistrikan dan Catu Daya Mandiri Toyaku* (Panel Surya 350 Wp $\rightarrow$ Sensor V-I 1 $\rightarrow$ SCC MPPT $\rightarrow$ Baterai Aki 12V $\rightarrow$ Inverter / DC-DC Converter $\rightarrow$ PCB Toyaku & Aktuator).
  - Foto fisik **PCB Toyaku (Board awg-master)** yang telah selesai disolder: komponen regulator tegangan (5V dan 3.3V), terminal screw blok, MOSFET switching fan, header socket ESP32, dan jalur pengaman sekering (fuse DC 15A).
  - Foto fisik modul **sensor pembacaan Tegangan (V) dan Arus (I)** (modul INA219 berbasis I2C atau ACS712 + Voltage Divider) yang terpasang pada jalur output panel surya dan jalur baterai.
  - Foto penataan perkabelan (wiring harness), grounding, dan tombol darurat (*emergency stop switch*).
- **2.2.2 Pengujian**:
  - **2.2.2.1 Pengujian Distribusi Tegangan Bus Regulasi**:
    - Metode: Mengukur output tegangan pada terminal PCB dalam kondisi standby dan saat beban penuh (kompresor aktif + fan 100%).
    - Tabel 4.4: *Pengujian Stabilitas Tegangan Jalur DC PCB Toyaku* (Jalur 12V Fan, Jalur 5V ESP32/Relay, Jalur 3.3V Sensor).
    - Analisis: Memastikan deviasi tegangan $< 5\%$ sehingga ESP32 tidak mengalami brown-out.
  - **2.2.2.2 Pengujian Karakteristik Panel Surya & Pengisian Baterai**:
    - Metode: Mencatat tegangan open-circuit ($V_{oc}$), tegangan kerja ($V_{mp}$), arus ($I_{sc}$ dan $I_{mp}$), serta daya charging ($P_{solar}$) pada kondisi cuaca terik matahari langsung vs cuaca berawan.
    - Tabel 4.5: *Karakteristik Keluaran Panel Surya 350 Wp Sepanjang Hari (08.00 - 16.00 WIB)*.
  - **2.2.2.3 Pengujian Akurasi Sensor Pembacaan V dan I Panel Surya**:
    - Metode: Membandingkan pembacaan sensor INA219 di ESP32 dengan alat ukur standar kalibrasi (Multimeter Digital Sanwa / Clamp Meter Fluke).
    - Tabel 4.6: *Tabel Kalibrasi dan Persentase Error Sensor Tegangan dan Arus Panel Surya*.
    - Rumus persentase kesalahan (Error %):
      $$\text{Error (\%)} = \left| \frac{V_{\text{sensor}} - V_{\text{multimeter}}}{V_{\text{multimeter}}} \right| \times 100\%$$
    - Analisis: Membuktikan rata-rata persentase error pembacaan sensor V & I berada dalam batas toleransi aman ($< 2.5\%$).
  - **2.2.2.4 Pengujian Ketahanan Baterai Aki pada Operasi Mandiri**:
    - Metode: Menguji berapa jam sistem mampu menjalankan blower pendingin saat suplai dari panel surya terhenti (simulasi malam hari / mendung panjang).
    - Tabel 4.7: *Penurunan Tegangan Baterai (Discharging Curve) terhadap Waktu Operasi Beban*.

---

#### 2.3 Subsistem Kendali Otomasi & Firmware ESP32 Master
*Penanggung Jawab: Aris Febriyanto*

- **2.3.1 Hasil**:
  - Foto modul mikrokontroler **ESP32 Master** yang tertancap pada socket PCB, terhubung dengan bus I2C sensor, output PWM fan, relay selenoid valve dispenser, dan modul relay pendingin.
  - Diagram alir (flowchart) kerja firmware ESP32 yang menjalankan FreeRTOS dual-task: Task 1 (akuisisi sensor, kalibrasi filter moving average, kalkulasi dew point) dan Task 2 (komunikasi WiFi, publish MQTT telemetri, subscribe perintah kendali).
  - Implementasi logika kendali hibrida:
    - *Auto Cut-Off*: Pendingin mati otomatis ketika sensor level mendeteksi tangki air telah terisi 100% guna mencegah luapan.
    - *Under-Voltage Protection*: Memutus beban fan jika tegangan baterai aki drop di bawah 11.5V.
    - *Valve Dispenser*: Bekerja independen merespons penekanan tombol fisik di boks maupun tombol virtual di dashboard web.
- **2.3.2 Pengujian**:
  - **2.3.2.1 Pengujian Sensor Suhu & Kelembaban Relatif (DHT22/SHT31)**:
    - Metode: Membandingkan pembacaan sensor suhu dan RH pada intake alat terhadap alat ukur standar pembanding (*Digital Thermo-Hygrometer* terkalibrasi).
    - Tabel 4.8: *Hasil Pengujian Sensor Suhu dan Kelembaban Relatif Udara*.
    - Analisis: Rata-rata error suhu $< 0.5^\circ C$ dan error RH $< 3\%$.
  - **2.3.2.2 Pengujian Sensor Level Air & Proteksi Overflow Tangki**:
    - Metode: Mengisi tangki air bertahap dari 0%, 25%, 50%, 75%, hingga 100% dan mengamati respon mikrokontroler serta modul relay pemutus kompresor.
    - Tabel 4.9: *Uji Respon Sensor Water Level terhadap Status Relay Pendingin*.
  - **2.3.2.3 Pengujian Sinyal Kendali PWM Fan Evaporator**:
    - Metode: Menguji linearitas duty cycle PWM (0–255) yang dihasilkan ESP32 terhadap kecepatan putaran fan (RPM) menggunakan tachometer digital.
    - Tabel 4.10: *Pengujian Pengaturan Kecepatan Fan Evaporator Berbasis Duty Cycle PWM*.
  - **2.3.2.4 Pengujian Kestabilan Firmware (Watchdog Timer & Reconnect Test)**:
    - Metode: Melakukan uji pemutusan sinyal WiFi dan broker MQTT secara sengaja, lalu mengukur waktu yang dibutuhkan ESP32 untuk melakukan *auto-reconnect* tanpa terjadi crash/freeze.

---

#### 2.4 Subsistem Monitoring Web Dashboard & Perekaman Data MQTT
*Penanggung Jawab: Ana Triliania Fajrin & Aris Febriyanto*

- **2.4.1 Hasil**:
  - Gambar 4.x: *Tampilan Antarmuka Web Dashboard Toyaku (`toyaku-app/fo`)* yang menampilkan widget kartu realtime: Suhu Lingkungan, Kelembaban Udara (RH), Daya Masuk Panel Surya (Watt), Tegangan (V), Arus (I), Estimasi Level Tangki (%), serta grafik pergerakan sensor interaktif.
  - Gambar 4.x: *Tampilan Halaman Perekaman Data Telemetri (`toyaku-app/fo/app/recorder`)* dengan tombol kontrol Play/Pause, konfigurasi interval rekaman (5 detik, 60 detik), dan tabel histori data.
  - Gambar 4.x: *Struktur Penyimpanan Database MySQL/PostgreSQL (`toyaku_db`)* yang menyimpan tabel `mqtt_logs` dan `recorder_settings`.
- **2.4.2 Pengujian**:
  - **2.4.2.1 Pengujian Fungsionalitas Antarmuka Web & Kendali Valve**:
    - Metode: Melakukan penekanan tombol virtual "Keluarkan Air (Valve ON)" di web dan mengamati respon terbukanya katup selenoid pada prototipe alat.
    - Tabel 4.11: *Hasil Pengujian Fungsional Fitur Kontrol dan Monitoring pada Web Dashboard*.
  - **2.4.2.2 Pengujian Integritas Perekaman Data MQTT ke Database (Zero Data Loss)**:
    - Metode: Menjalankan perekaman kontinu selama 12 jam nonstop dengan interval pengiriman 5 detik (total ekspektasi: 8.640 baris data). Memeriksa jumlah baris tersimpan dan konsistensi timestamp.
    - Tabel 4.12: *Hasil Pengujian Keandalan Perekaman Data MQTT Database*.
    - Analisis: Tingkat keberhasilan perekaman mencapai 100% (zero packet loss).
  - **2.4.2.3 Pengujian Fitur Ekspor Data ke Format CSV**:
    - Metode: Menjalankan ekspor data log ribuan baris ke file `.csv` dan membukanya di Microsoft Excel/LibreOffice Calc untuk verifikasi kelengkapan kolom (`topic`, `payload`, `created_at`).

---

#### 2.5 Subsistem Analitik Prediktif & Machine Learning Prediksi Air
*Penanggung Jawab: Ana Triliania Fajrin*

- **2.5.1 Hasil**:
  - Diagram alir pipeline Machine Learning: *Dataset Log MQTT $\rightarrow$ Data Preprocessing (Pembersihan Outlier & Normalisasi) $\rightarrow$ Feature Engineering ($T_{amb}, RH, T_{evap}, P_{solar}$) $\rightarrow$ Pelatihan Model Regresi $\rightarrow$ Model Serialized (`.pkl`) $\rightarrow$ Backend REST API `/api/predict-water-yield`*.
  - Gambar 4.x: *Widget Visualisasi Prediksi Produksi Air pada Web Dashboard* yang menampilkan estimasi air yang akan dihasilkan (misal: "Prediksi 1 Jam ke Depan: 145 ml").
- **2.5.2 Pengujian**:
  - **2.5.2.1 Evaluasi Kinerja Model AI (Metrik MAE, RMSE, dan $R^2$)**:
    - Metode: Membandingkan kinerja beberapa algoritma (Regresi Linier Berganda, Random Forest Regressor, Support Vector Regression) menggunakan data pengujian (test set 20%).
    - Tabel 4.13: *Perbandingan Performa Algoritma Machine Learning Prediksi Produksi Air Toyaku*.
    - Menampilkan metrik:
      - Mean Absolute Error (MAE) dalam satuan ml.
      - Root Mean Squared Error (RMSE) dalam satuan ml.
      - Koefisien Determinasi ($R^2$) (Target: $R^2 > 0.85$).
  - **2.5.2.2 Pengujian Komparasi Nilai Prediksi AI vs Produksi Air Riil di Lapangan**:
    - Metode: Mengamati nilai yang diprediksi model AI setiap jam dibandingkan dengan air aktual yang tertampung di tabung ukur selama pengujian lapangan terbuka.
    - Gambar 4.x: *Grafik Kurva Perbandingan Nilai Prediksi AI vs Produksi Air Aktual Sepanjang Hari*.
    - Analisis: Model mampu mengikuti tren fluktuasi produksi air akibat kenaikan kelembaban udara di pagi hari dan penurunan kelembaban di siang terik dengan deviasi rata-rata $< 10\%$.

---

### BAB 3: KESIMPULAN
Menyajikan kesimpulan kuantitatif yang solid berdasarkan data empiris pengujian, contoh poin kesimpulan:
1. **Subsistem Mekanik & Evaporator**: Penambahan fan pendingin pada kisi evaporator berhasil meningkatkan stabilitas aliran udara tanpa melepaskan uap air, menghasilkan laju kondensasi rata-rata sebesar **XX ml/jam** pada kondisi RH rata-rata $75\%$, serta air yang dihasilkan memiliki nilai TDS sebesar **XX ppm** dan pH **X.X** yang memenuhi standar fisik air bersih.
2. **Subsistem Kelistrikan & Solar PV**: Sistem catu daya hibrida berbasis panel surya 350 Wp dan baterai aki 12V mampu menyuplai seluruh beban alat secara stabil dengan deviasi tegangan bus $< 3\%$. Sensor pembacaan tegangan dan arus (INA219) memiliki akurasi tinggi dengan rata-rata error pembacaan sebesar **X.XX%** dibandingkan multimeter standar.
3. **Subsistem Kendali ESP32 Master**: Firmware ESP32 terbukti andal dalam membaca sensor lingkungan, mengatur kontrol adaptif PWM fan evaporator, dan mengeksekusi proteksi *auto cut-off* saat tangki air 100% maupun *under-voltage* aki tanpa mengalami kegagalan sistem.
4. **Subsistem Monitoring Web & MQTT**: Dashboard web Toyaku berhasil menampilkan telemetri data sensor secara real-time dan menyimpan data ke dalam database secara otomatis dengan tingkat keberhasilan perekaman mencapai **100% (zero loss)** selama pengujian kontinu.
5. **Subsistem AI Prediksi Air**: Model Machine Learning berbasis *Random Forest Regressor* mampu memprediksi volume perolehan air kondensasi dengan koefisien determinasi $R^2$ sebesar **0.XX** dan nilai rata-rata error (MAE) sebesar **XX ml**, menunjukkan korelasi yang kuat antara parameter cuaca dengan laju produksi air.

---

### DAFTAR REFERENSI
Memuat minimal 10–15 daftar pustaka ilmiah (jurnal internasional/nasional bereputasi) mengenai *Atmospheric Water Generator*, pendingin kompresi uap, panel surya & MPPT, protokol IoT MQTT, dan *machine learning predictive analytics*, ditulis menggunakan format **IEEE Style** (dihasilkan melalui Mendeley atau Zotero).

---

### LAMPIRAN
- **Lampiran 1**: Foto dokumentasi pengujian alat di lapangan (Rumah Rakyat Kantor Gubernur Jawa Tengah / area outdoor).
- **Lampiran 2**: Gambar skematik rangkaian kelistrikan lengkap dan layout PCB Toyaku (*awg-master*).
- **Lampiran 3**: Potongan source code utama firmware ESP32 Master (algoritma I2C, PWM, FreeRTOS task, dan MQTT).
- **Lampiran 4**: Potongan source code backend data recorder & REST API inferensi AI.
- **Lampiran 5**: Lembar data mentah (*raw data sheet*) hasil pengukuran sensor, tegangan surya, dan volume air.

---

## 4. Matriks Daftar Gambar & Tabel E-400 TOYAKU yang Harus Disiapkan

Untuk mempermudah tim dalam membagi tugas pengambilan data dan tangkapan layar (screenshot), berikut daftar nomor gambar dan tabel yang wajib ada:

### Daftar Gambar (Format Gambar 4.x)
- **Gambar 4.1**: Diagram Blok Sistem Atmospheric Water Generator (Toyaku) Terintegrasi
- **Gambar 4.2**: Ruang Pendingin Evaporator dan Fan Tambahan 12V yang Terpasang
- **Gambar 4.3**: Talang Air Kondensat, Jalur Selang Food-Grade dan Tabung Filter Karbon Aktif
- **Gambar 4.4**: Diagram Blok Sistem Kelistrikan dan Catu Daya Panel Surya
- **Gambar 4.5**: Modul PCB Toyaku (*awg-master*) Hasil Solderan Lengkap Komponen
- **Gambar 4.6**: Modul Sensor Pembacaan Tegangan (V) dan Arus (I) Terpasang pada Jalur DC Solar
- **Gambar 4.7**: Pengujian Modul ESP32 Master dan Rangkaian Pengendali Aktuator
- **Gambar 4.8**: Grafik Respon Sinyal PWM terhadap Kecepatan Putaran Fan Evaporator
- **Gambar 4.9**: Tampilan Antarmuka Web Dashboard Utama Toyaku (`toyaku-app/fo`)
- **Gambar 4.10**: Halaman Perekaman Data Telemetri dan Kontrol Interval Rekam
- **Gambar 4.11**: Struktur Tabel Penyimpanan Database MySQL/PostgreSQL
- **Gambar 4.12**: Diagram Alir (Pipeline) Pelatihan dan Inferensi Model Machine Learning Prediksi Air
- **Gambar 4.13**: Widget Prediksi Produksi Air Realtime pada Tampilan Web Dashboard
- **Gambar 4.14**: Grafik Scatter Plot Hubungan Nilai Prediksi AI vs Aktual Produksi Air Lapangan
- **Gambar 4.15**: Foto Prototipe Fisik Keseluruhan Alat Toyaku Saat Pengujian Lapangan Terbuka

### Daftar Tabel (Format Tabel 4.x)
- **Tabel 4.1**: Hasil Pengukuran Suhu Kisi Evaporator dan Titik Embun pada Berbagai Kecepatan Fan
- **Tabel 4.2**: Laju Produksi Air Kondensasi (ml/jam) terhadap Kelembaban Relatif (RH)
- **Tabel 4.3**: Pengujian Parameter Kualitas Fisik Air (TDS dan pH) Sebelum dan Sesudah Filtrasi
- **Tabel 4.4**: Pengujian Distribusi Tegangan Bus Regulasi PCB Toyaku (12V, 5V, 3.3V)
- **Tabel 4.5**: Karakteristik Keluaran Daya Panel Surya 350 Wp Sepanjang Hari
- **Tabel 4.6**: Hasil Kalibrasi dan Persentase Error Sensor Tegangan dan Arus Panel Surya vs Multimeter
- **Tabel 4.7**: Pengujian Penurunan Tegangan Baterai Aki pada Operasi Beban Mandiri
- **Tabel 4.8**: Hasil Pengujian dan Kalibrasi Sensor Suhu dan Kelembaban Udara (DHT22/SHT31)
- **Tabel 4.9**: Hasil Pengujian Sensor Level Air dan Logika Proteksi Relay Otomatis Tangki
- **Tabel 4.10**: Pengujian Kecepatan Fan Evaporator Berbasis Pengaturan Nilai Duty Cycle PWM ESP32
- **Tabel 4.11**: Hasil Pengujian Fungsional Fitur Kontrol dan Monitoring pada Web Dashboard
- **Tabel 4.12**: Hasil Pengujian Keandalan Perekaman Data MQTT ke Database (Uji 12 Jam Kontinu)
- **Tabel 4.13**: Tabel Evaluasi Metrik Akurasi Model AI Prediksi Air (MAE, RMSE, dan $R^2$)

---

## 5. Checklist Pembagian Tugas Tim untuk Pengisian E-400

| Anggota Tim | Bagian yang Wajib Ditulis & Diuji | Alat Bantu / Instrumen Uji yang Disiapkan |
| :--- | :--- | :--- |
| **Aris Febriyanto** | • Subbab 2.3 (Firmware ESP32, kalibrasi DHT22/SHT31, PWM fan, relay, watchdog)<br/>• Subbab 2.2 bagian kalibrasi program sensor V-I<br/>• Lampiran kode ESP32 | • ESP32 DevKit & kabel micro-USB<br/>• Thermo-hygrometer digital pembanding<br/>• Logic analyzer / Serial monitor oscilloscope |
| **Dwi Devangga** | • Subbab 2.2 (Sistem elektrik, PCB Toyaku, panel surya, SCC, baterai, sensor V-I)<br/>• Pengujian tegangan bus, kurva solar, dan uji sekering proteksi<br/>• Lampiran skematik PCB & BOM | • Multimeter Digital (Sanwa/Fluke)<br/>• Clamp Meter / DC Wattmeter eksternal<br/>• Solder station & toolkit perkabelan |
| **Dzikru Nur Khayat** | • Subbab 2.1 (Mekanik evaporator, fan 12V, airflow ducting, talang air, tangki, filter)<br/>• Pengujian debit udara, laju embun, uji TDS dan pH air<br/>• Lampiran gambar teknik 3D CAD | • Anemometer digital (pengukur angin)<br/>• Gelas ukur / silinder ukur ml presisi<br/>• TDS meter & pH meter digital |
| **Ana Triliania Fajrin** | • Subbab 2.4 (Web dashboard, MQTT logger, database, ekspor CSV)<br/>• Subbab 2.5 (Model AI prediksi air, training dataset, evaluasi MAE/RMSE/R²)<br/>• Lampiran kode web, skema database & skrip AI | • Backend Node.js & Database GUI (TablePlus/DBeaver)<br/>• Jupyter Notebook / Python scikit-learn<br/>• Postman / REST API test client |
| **Seluruh Tim (Bersama)** | • Bab 1 (Pengantar), Bab 3 (Kesimpulan kuantitatif)<br/>• Format dokumen sesuai template `E400-ELE UDINUS 2022.docx`<br/>• Pengujian terpadu alat di lapangan outdoor | • Kamera/Smartphone untuk foto dokumentasi alat resolusi tinggi<br/>• Mendeley/Zotero untuk perapian sitasi IEEE |

---

> **Petunjuk Eksekusi Dokumen:**  
> File rancangan ini telah diselaraskan dengan template resmi [`E400-ELE UDINUS 2022.docx`](file:///home/aris/Dokumen/kuliah/7s/Tugas%20Akhir/E400-ELE%20UDINUS%202022.docx). Setiap anggota tim dapat langsung mengambil tanggung jawab subbab masing-masing sesuai matriks di atas untuk menyusun naskah Word dan mengisikan data hasil pengukuran riil dari prototipe Toyaku!
