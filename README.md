<p align="center">
  <img src="assets/Banner.png" alt="TetraTech Banner" width="100%">
</p>
# TetraTech

TetraTech, roket firlatma planlama, saha uygunluk analizi, cevresel risk degerlendirmesi, canli gorev simulasyonu ve enkaz dusus tahmini akislarini tek bir platformda birlestiren entegre bir gorev kontrol sistemidir.

Proje; firlatma oncesi karar destegi, operasyon sahasi secimi, hava ve uzay havasi kontrolu, fizik tabanli simulasyon ve gorev sonrasi raporlama ihtiyaclarini tek merkezden yonetmek icin tasarlanmistir. Sistem; frontend kontrol paneli, FastAPI tabanli ana servis, roket fizik motoru ve HERMES enkaz tahmin modulu gibi birden fazla alt bilesenden olusur.

## Hizli Gezinme

- [Proje Genel Bakis](#proje-genel-bakis)
- [Hazir AI Degil, Proje Icindeki Yerel Motorlar](#hazir-ai-degil-proje-icindeki-yerel-motorlar)
- [Neler Sunar](#neler-sunar)
- [Uygulama Akisi](#uygulama-akisi)
- [Sistem Bilesenleri](#sistem-bilesenleri)
- [Moduller Detayli Ne Yapiyor](#moduller-detayli-ne-yapiyor)
- [Kullanim ve Kurulum](#kullanim-ve-kurulum)
- [Yerelde Calistirma](#yerelde-calistirma)
- [Yazilim ve Teknik Detaylar](#yazilim-ve-teknik-detaylar)

## Vitrin Ozeti

TetraTech, klasik bir dashboard mantigindan daha fazlasini sunar. Bu platformun ciktisi sadece grafik ya da tablo degil; operasyonel karar, sahaya uygunluk yorumu, simulasyon davranisi, dusus tahmini ve raporlanabilir sonuc paketidir.

One cikan katmanlar:

- Saha secimi ve topografik uygunluk analizi
- Hava durumu, uzay havasi ve hava sahasi risklerinin birlikte degerlendirilmesi
- Gorev oncesi Tetra karar motoru ile uygunluk puanlamasi
- Canli roket simulasyonu ve telemetri gorsellestirmesi
- HERMES ile kademe veya parca dusus tahmini
- PDF gorev raporu ve sonuc ozeti

## Ekran Goruntuleri

Asagidaki alanlar README vitrini icin ayrilmistir. Dilersen daha sonra gercek ekran goruntuleri ile dogrudan degistirilebilir.

| Alan | Aciklama |
| --- | --- |
| Gorev Kontrol Paneli | Ana operasyon ekrani, gorev akisi ve karar panelleri |
| Bolge ve Yuzey Haritasi | Secilen koordinatin saha uygunluk ve risk analizi |
| Canli Simulasyon | Roket ucus davranisi, telemetri ve fiziksel akis |
| HERMES Enkaz Analizi | Kademe veya parca dusus tahmini ve etki alani |
| Nihai PDF Raporu | Kurumsal sonuc ciktisi ve gorev ozeti |

## Proje Genel Bakis

TetraTech sadece bir arayuz degil; analiz, simulasyon, karar uretme ve raporlama katmanlarini tek bir operasyon hattinda birlestiren butunlesik bir platformdur.

Bu proje temelde su ihtiyaclara cevap verir:

- Secilen nokta roket firlatma icin ne kadar uygun?
- Hava, uzay havasi ve yuzey kosullari gorevi nasil etkiler?
- Secilen roket bu kosullarda ne kadar guvenli ve verimli?
- Olasu kademe veya parca dusus bolgeleri nerede olusur?
- Tum bu veriler tek bir profesyonel rapora nasil donusturulur?

Bu nedenle TetraTech, tek bir ekran gostermeyi degil; gercek bir karar destek sistemi gibi davranmayi hedefler.

## Projenin Amaci

Bu proje; uzay ve havacilik odakli bir gorev planlama panelinin, saha analiz motorunun ve simulasyon katmanlarinin tek cati altinda nasil birlestirilebilecegini gosteren kapsamli bir sistemdir. Sadece bir arayuz degil; karar destek, simulasyon, risk analizi ve raporlama platformudur.

## Hazir AI Degil, Proje Icindeki Yerel Motorlar

Bu projede kullanilan zeka ve karar katmanlari, hazir bir sohbet modeli veya harici bir yapay zeka servisi ile yonetilmez. Sistem; proje icinde yazilmis yerel karar motorlari, NumPy tabanli ozel modeller ve fizik-kural tabanli analizler ile calisir.

Ozellikle vurgulamak gerekir ki:

- ChatGPT, Ollama veya benzeri hazir yapay zeka servisleri runtime sirasinda bu sistemi yonetmez.
- Karar mantigi disaridan alinmis bir black-box modele degil, dogrudan proje koduna dayanir.
- Puanlama, risk analizi, trajektori yorumlama ve uzay havasi degerlendirmesi proje icinde gelistirilen motorlarla yapilir.
- NumPy tabanli sinir aglari, tahmin akislari ve hibrit karar mantigi ekip tarafindan sifirdan yazilmistir.

Bu kapsamda one cikan yerli bilesenler sunlardir:

- `neural_decision_engine.py`: Gorev kararini, riskleri ve uygunluk skorunu ureten ozel motor
- `Gunes Firtanasi Sistemleri/core/neural_network.py`: NumPy ile sifirdan yazilmis derin sinir agi altyapisi
- `Uydu Dusus Hesaplayici/hermes_db/trajectory_ai.py`: HERMES tarafindaki yerel trajektori tahmin modeli
- `map_data.py`: Hazir AI yerine cografi sinyaller ve operasyonel kurallarla calisan saha uygunluk motoru
- `weather.py`, `space_weather.py`, `notam_service.py`: Karar katmanini besleyen veri isleme ve yorumlama katmanlari

Kisacasi projedeki "zeka" kismi hazir servis kullanimi degil; dogrudan bu repo icinde gelistirilmis algoritmalarin ve modellerin sonucudur.

## Neler Sunar?

- Firlatma sahasi secimi ve bolge uygunluk analizi
- Atmosferik hava durumu, uzay havasi ve hava sahasi etkilerinin birlikte degerlendirilmesi
- Gorev oncesi karar motoru ile GO, BEKLEME veya IPTAL karari uretilmesi
- Roket performansina dayali canli simulasyon ve telemetri gostergeleri
- HERMES modulu ile kademe veya parca dusus bolgelerinin tahmini
- PDF ciktilari ile kurumsal gorev ozeti ve sonuc raporlama
- Yerel gelistirme, Electron paketleme ve Docker/Coolify dagitimi destegi

## Uygulama Akisi

TetraTech, kullaniciyi parca parca ilerleyen bir operasyon akisi icinde yonlendirir. Genel olarak sistem su mantikla calisir:

1. Roket veya arac modeli secilir.
2. Firlatma ussu ya da hedef koordinat belirlenir.
3. Hava durumu, topo veri, uzay havasi ve hava sahasi bilgileri toplanir.
4. Karar motoru, secilen kosullara gore gorevin uygunlugunu puanlar.
5. Canli simulasyon ve performans katmanlari gosterilir.
6. HERMES ile muhtemel dusus bolgeleri hesaplanir.
7. Sonuc PDF olarak raporlanir.

Bu yapi sayesinde sistem, tek bir ekrandan hem planlama hem de operasyonel analiz deneyimi sunar.

## Sistem Bilesenleri

### 1. Gorev Kontrol Paneli
`frontend/` klasoru altinda yer alan React + Vite tabanli kullanici arayuzudur. Harita, gorev akisi, karar panelleri, simulasyon ekranlari ve rapor alanlari bu katmanda bulunur. Proje ayni zamanda Electron ile masaustu uygulamasi olarak paketlenebilir.

### 2. Ana API Katmani
Kok dizindeki `api.py`, sistemin merkez servisidir. FastAPI ile calisir ve farkli analiz modullerini ortak bir API altinda toplar.

Baslica gorevleri:
- `/api/weather` ile hava verisi saglamak
- `/api/topo` ile bolge ve yuzey analizi yapmak
- `/api/space` ile uzay havasi verisi saglamak
- `/api/airspace` ile hava sahasi durumu uretmek
- `/api/simulate` ile gorev simulasyonu karari vermek
- `/api/hermes/predict` ile enkaz dusus tahmini yapmak
- `/api/spaceports` ile tanimli uzay uslerini saglamak

### 3. Roket Simulasyon Motoru
`Roket Simulasyon Araci/roketsim-main/` altindaki servis, roketin ucus davranisini ve ilgili telemetriyi ureten fizik motorudur. Bu katman `server.py` uzerinden calisir ve frontend ile API tarafina veri saglar.

### 4. HERMES Enkaz Tahmin Modulu
`Uydu Dusus Hesaplayici/` altindaki HERMES modulu, roket veya arac kademelerinin ayrilma sonrasindaki muhtemel dusus alanlarini hesaplamak icin kullanilir. Sistem; fizik motoru, bilgi tabani ve tahmin akisini bir arada barindirir.

### 5. Gunes Firtinasi ve Uzay Havasi Bilesenleri
`Gunes Firtanasi Sistemleri/` ve `space_weather.py` taraflari, gorevin uzay havasi etkilerini modellemek icin kullanilir. Boylece karar motoru sadece yer seviyesindeki verilerle degil, yuksek atmosfer ve jeomanyetik risklerle de calisabilir.

## Moduller Detayli Ne Yapiyor?

### `api.py`
Tum ana endpointleri toplayan merkez servistir. Hava, topo, uzay havasi, hava sahasi, simulasyon ve HERMES tahmin akislarini tek noktadan yonetir.

### `weather.py`
Atmosferik hava verisini toplar. Gerektiginde fallback mekanizmasi ile sistemi cevrimdisi kosullarda da calisabilir tutar.

### `map_data.py`
Bolge ve yuzey haritasi analizini yapar. Arazi, yerlesim, su, yakin altyapi, risk capi ve saha uygunlugu gibi sinyallerden operasyonel bir puan uretir.

### `notam_service.py`
Hava sahasi ve NOTAM benzeri risk katmanlariyla ilgili veri akislarini yonetir. Gerektiginde sistemin karar motoruna destek olacak sadelestirilmis risk yorumlari uretir.

### `space_weather.py`
Gunes aktivitesi, jeomanyetik risk ve uzay havasi etkilerini gorev kararina tasir.

### `neural_decision_engine.py`
Gorev simulasyonundaki karar mantigini, skorlamayi ve sonuc etiketlerini ureten ana karar motorudur. Hava, topo, uzay havasi ve roket parametrelerini birlestirerek nihai uygunluk karari verir.

### `decision_engine.py`
Projenin daha hafif veya onceki karar akislarinda kullanilan yardimci karar katmanidir.

### `spaceport_manager.py`
Bilinen firlatma usleri ve uzay limanlariyla ilgili yardimci yonetim katmanidir.

### `Uydu Dusus Hesaplayici/`
HERMES tarafinin cekirdek klasorudur. Fizik motoru, bilgi tabani, etki hesaplari ve trajektori modelleri burada yer alir.

### `Roket Simulasyon Araci/roketsim-main/`
Canli simulasyon tarafinin fizik ve arayuz bilesenlerini barindirir. Roketin ucus gorunumu, telemetri ve simulasyon kontrolleri bu katmanda uretilir.

### `Gunes Firtanasi Sistemleri/`
Uzay havasi icin daha deneysel ya da modelleme odakli alt sistemi barindirir. Burada sifirdan yazilmis sinir agi ve egitim bilesenleri bulunur.

## Kullanim ve Kurulum

### Gereksinimler

- Node.js 18 veya uzeri
- Python 3.9 veya uzeri
- Git

### 1. Projeyi klonlayin

```bash
git clone https://github.com/VstormX16/TetraTech.git
cd TetraTech
```

### 2. Python bagimliliklarini kurun

Kok dizinde:

```bash
pip install -r requirements.txt
```

Not:
Bazi alt moduller kendi icinde ek kutuphaneler barindirabilir. Ana servis icin temel bagimliliklar `requirements.txt` icindedir.

### 3. Frontend bagimliliklarini kurun

```bash
cd frontend
npm install
cd ..
```

## Yerelde Calistirma

Tam sistemi gelistirme ortaminda ayaga kaldirmak icin 3 ayri terminal kullanin.

### Terminal 1 - Ana API servisi

Kok dizinde calistirin:

```bash
python api.py
```

Kontrol:
- API: `http://127.0.0.1:8010`
- Saglik kontrolu: `http://127.0.0.1:8010/api/health`

### Terminal 2 - Fizik ve simulasyon servisi

```bash
cd "Roket Simulasyon Araci/roketsim-main"
python server.py
```

Kontrol:
- Simulasyon servisi: `http://127.0.0.1:5000`

### Terminal 3 - Frontend gelistirme sunucusu

```bash
cd frontend
npm run dev
```

Kontrol:
- Arayuz: `http://127.0.0.1:5173`

### Hizli ozet

1. Kok dizinde `pip install -r requirements.txt`
2. `frontend` icinde `npm install`
3. Ayri terminallerde sirasiyla `python api.py`, `python server.py`, `npm run dev`
4. Tarayicida `http://127.0.0.1:5173` adresini acin

## Dizin Yapisi

```text
TetraTech/
|- api.py
|- weather.py
|- map_data.py
|- notam_service.py
|- space_weather.py
|- neural_decision_engine.py
|- decision_engine.py
|- frontend/
|- Roket Simulasyon Araci/
|- Uydu Dusus Hesaplayici/
|- Gunes Firtanasi Sistemleri/
|- docker/
|- docker-compose.coolify.yml
|- README.coolify.md
```

## API Ornekleri

### Hava verisi

```text
GET /api/weather?lat=40.18&lon=29.07
```

### Topografik analiz

```text
GET /api/topo?lat=28.5729&lon=-80.6490
```

### Gorev simulasyonu

```text
GET /api/simulate?rocket=Falcon%209&lat=28.5729&lon=-80.6490
```

### HERMES dusus tahmini

```text
GET /api/hermes/predict?rocket_model=Falcon%209&lat=28.5729&lon=-80.6490&azimuth=90
```

## Docker ve Coolify

Coolify veya benzeri ortamlarda dagitim icin gerekli dosyalar repo icinde hazirdir.

- `docker-compose.coolify.yml`
- `docker/api.Dockerfile`
- `docker/frontend.Dockerfile`
- `docker/sim.Dockerfile`
- `README.coolify.md`

Coolify ile deploy etmek istiyorsan detayli notlar icin `README.coolify.md` dosyasina bakabilirsin.

## Yazilim ve Teknik Detaylar

### Kullanilan temel teknolojiler

- Frontend: React 19, Vite, Leaflet, Three.js, MUI, jsPDF, Zustand
- Backend: FastAPI, Uvicorn, Requests, NumPy
- Simulasyon: Python tabanli fizik servisi + React tabanli canli gorsellestirme
- Paketleme: Electron
- Dagitim: Docker Compose, Coolify

### Teknik calisma modeli

- Ana API servisi `8010` portunda calisir.
- Simulasyon servisi `5000` portunda calisir.
- Frontend gelistirme sunucusu `5173` portunda calisir.
- Frontend, API ve simulasyon katmani ayrik servislerdir ancak ortak gorev akisinda birlikte calisir.
- Bazi veri katmanlari internet baglantisi olmadiginda fallback moduna gecebilir.

### Repo icindeki ozel teknik bilesenler

- `tetra_neural_weights.npz`: Gorev karar motorunun agirlik dosyasi
- `frontend/electron/main.cjs`: Electron masaustu giris noktasi
- `docker-compose.coolify.yml`: Uretim benzeri dagitim tanimi
- `frontend/public/models/`: Kullanilan 3D model varliklari
- `Uydu Dusus Hesaplayici/hermes_db/`: HERMES fizik, bilgi tabani ve tahmin katmani

### Gelistirme notlari

- Frontend ile backend ayrik ama birlikte calisan bir mimariye sahiptir.
- Build ciktlari ve paketlenmis dosyalar repoda yer alabilir; dagitimdan once `.gitignore` ve paket boyutu kontrol edilmelidir.
- Electron paketi icin `frontend/electron/main.cjs` kullanilir.
- Gerektiginde cevrimdisi dayanimi korumak icin fallback veri akislari kullanilir.

## Lisans

Aksi belirtilmedikce tum haklari proje sahibine aittir.

