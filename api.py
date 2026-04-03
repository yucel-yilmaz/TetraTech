from fastapi import FastAPI, Query, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
import shutil
import json
import math
from functools import lru_cache
import requests
from weather import get_weather_data
from space_weather import get_space_weather_data # Doğru isim: get_space_weather_data
from map_data import get_topo_data
# .
from notam_service import get_notam_and_flights # Doğru isim: get_notam_and_flights
from spaceport_manager import SpaceportManager # Sınıf olarak çekelim
from neural_decision_engine import neural_engine # Bizim yeni AI Botu!
import uvicorn
import datetime

# HERMES AI modül yolunu ekle
HERMES_DIR = os.path.join(os.path.dirname(__file__), "Uydu Dusus Hesaplayıcı")
if HERMES_DIR not in sys.path:
    sys.path.insert(0, HERMES_DIR)

from hermes_db.physics_engine import RocketPhysicsEngine

HERMES_KB_PATH = os.path.join(HERMES_DIR, "hermes_db", "knowledge_base.json")
HERMES_PHYSICS = RocketPhysicsEngine()
HERMES_NAME_ALIASES = {
    "Ares-1B": "Ares 1 (B)",
    "Ares 1B": "Ares 1 (B)",
    "Ares1B": "Ares 1 (B)",
}
HERMES_EXTRA_ROCKETS = {
    "Falcon Heavy": {
        "flights": 11,
        "confidence": "MEDIUM",
        "propellant_type": "LOX/RP-1",
        "stages": [
            {
                "name": "Side Boosters",
                "stage_num": 1,
                "thrust_kn": 15214,
                "propellant_mass_kg": 791400,
                "empty_mass_kg": 52000,
                "burn_time_s": 154,
                "diameter_m": 3.7,
                "material": "Structural Tubing",
                "disposal": "RECOVERY"
            },
            {
                "name": "Core Stage",
                "stage_num": 2,
                "thrust_kn": 7607,
                "propellant_mass_kg": 395700,
                "empty_mass_kg": 25600,
                "burn_time_s": 187,
                "diameter_m": 3.7,
                "material": "Structural Tubing",
                "disposal": "RECOVERY"
            },
            {
                "name": "Upper Stage",
                "stage_num": 3,
                "thrust_kn": 981,
                "propellant_mass_kg": 107500,
                "empty_mass_kg": 4500,
                "burn_time_s": 397,
                "diameter_m": 3.7,
                "material": "Propellant Tanks (Aluminum - thin wall)",
                "disposal": "CONTROLLED_DEORBIT"
            }
        ]
    }
}
HERMES_CONFIDENCE_MAP = {
    "HIGH": "YUKSEK",
    "MEDIUM": "ORTA",
    "LOW": "DUSUK",
    "THEORETICAL": "TEORIK"
}


@lru_cache(maxsize=1)
def load_hermes_knowledge():
    with open(HERMES_KB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def canonicalize_rocket_name(value):
    return "".join(ch.lower() for ch in str(value or "") if ch.isalnum())


def resolve_hermes_rocket(rocket_model):
    knowledge = load_hermes_knowledge()
    rockets = knowledge.get("rockets", {})
    lookup_name = HERMES_NAME_ALIASES.get(rocket_model, rocket_model)

    if lookup_name in rockets:
        return lookup_name, rockets[lookup_name]
    if rocket_model in HERMES_EXTRA_ROCKETS:
        return rocket_model, HERMES_EXTRA_ROCKETS[rocket_model]

    canonical = canonicalize_rocket_name(rocket_model)
    for candidate_name, candidate_data in rockets.items():
        if canonicalize_rocket_name(candidate_name) == canonical:
            return candidate_name, candidate_data

    for alias_name, mapped_name in HERMES_NAME_ALIASES.items():
        if canonicalize_rocket_name(alias_name) == canonical and mapped_name in rockets:
            return mapped_name, rockets[mapped_name]

    return None, None


def hermes_destination_point(lat, lon, bearing_deg, distance_km):
    if not distance_km:
        return lat, lon

    earth_radius_km = 6371.0
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    angular_distance = distance_km / earth_radius_km

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2)
    )

    normalized_lon = ((math.degrees(lon2) + 540.0) % 360.0) - 180.0
    return math.degrees(lat2), normalized_lon


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


@lru_cache(maxsize=128)
def fetch_launch_elevation(lat_key, lon_key):
    try:
        response = requests.get(
            "https://api.open-meteo.com/v1/elevation",
            params={"latitude": lat_key, "longitude": lon_key},
            timeout=1.2
        )
        if response.status_code == 200:
            payload = response.json()
            elevation = payload.get("elevation")
            if isinstance(elevation, list) and elevation:
                return safe_float(elevation[0], 0.0)
            return safe_float(elevation, 0.0)
    except Exception:
        return 0.0
    return 0.0


def hermes_environment_factors(lat, lon):
    weather = get_weather_data(lat=lat, lon=lon)
    launch_alt = max(0.0, fetch_launch_elevation(round(lat, 4), round(lon, 4)))

    wind_speed = safe_float(weather.get("wind"), 0.0)
    humidity = max(15.0, min(95.0, safe_float(weather.get("humidity"), 50.0)))
    pressure = safe_float(weather.get("pressure"), 1013.0)
    temperature = safe_float(weather.get("temp"), 15.0)

    return {
        "wind_speed": wind_speed,
        "humidity": humidity,
        "launch_alt": launch_alt,
        "pressure": pressure,
        "temperature": temperature,
        "weather": weather,
        "source": "LIVE_WEATHER" if "ATMOSFERIK YEDEK MODU" not in str(weather.get("desc", "")) else "ATMOS_FALLBACK"
    }


def estimate_stage_range_km(stage, stage_index, environment):
    thrust_kn = safe_float(stage.get("thrust_kn"), 0.0)
    burn_time_s = safe_float(stage.get("burn_time_s"), 0.0)
    propellant_mass = safe_float(stage.get("propellant_mass_kg"), 0.0)
    empty_mass = safe_float(stage.get("empty_mass_kg"), 0.0)
    diameter_m = max(1.0, safe_float(stage.get("diameter_m"), 1.0))
    total_mass = max(propellant_mass + empty_mass, 1.0)
    wind_speed = abs(environment.get("wind_speed", 0.0))
    humidity = environment.get("humidity", 50.0)
    launch_alt = environment.get("launch_alt", 0.0)
    disposal = stage.get("disposal", "GROUND_IMPACT")

    twr = (thrust_kn * 1000.0) / max(total_mass * 9.81, 1.0)
    effective_impulse = (thrust_kn * max(burn_time_s, 1.0)) / max(total_mass, 1.0)
    density_factor = max(0.72, min(1.18, 1.0 - ((humidity - 50.0) / 500.0) - (wind_speed / 180.0) + (launch_alt / 50000.0)))
    base_range = max(35.0, (effective_impulse * 18.0 * density_factor) + (twr * 42.0) + (diameter_m * 8.0) + (stage_index * 55.0))

    if disposal == "RECOVERY":
        return base_range * 0.85
    if disposal == "OCEAN_IMPACT":
        return base_range * 1.55
    if disposal == "GROUND_IMPACT":
        return base_range * 1.35
    if disposal == "CONTROLLED_DEORBIT":
        return base_range * 7.0
    if disposal == "UNCONTROLLED_REENTRY":
        return base_range * 12.0
    return base_range


def normalize_downrange_km(stage, stage_index, raw_downrange_km, environment):
    disposal = stage.get("disposal", "GROUND_IMPACT")
    estimated_range = estimate_stage_range_km(stage, stage_index, environment)
    raw_value = safe_float(raw_downrange_km, 0.0)
    if disposal in ("CONTROLLED_DEORBIT", "UNCONTROLLED_REENTRY"):
        corrected_raw = raw_value * 5.0
    else:
        corrected_raw = raw_value * 2.5

    bounds = {
        "RECOVERY": (35.0, 850.0),
        "OCEAN_IMPACT": (80.0, 2200.0),
        "GROUND_IMPACT": (70.0, 2800.0),
        "CONTROLLED_DEORBIT": (1800.0, 18000.0),
        "UNCONTROLLED_REENTRY": (4000.0, 32000.0),
    }
    min_range, max_range = bounds.get(disposal, (60.0, 5000.0))

    if corrected_raw <= 0 or corrected_raw < (min_range * 0.35):
        candidate = estimated_range
    elif corrected_raw > (max_range * 1.8):
        candidate = (corrected_raw * 0.6) + (estimated_range * 0.4)
    else:
        candidate = (corrected_raw * 0.72) + (estimated_range * 0.28)

    return max(min_range, min(max_range, candidate))


def compute_impact_radius_km(stage, downrange_km, crossrange_km):
    disposal = stage.get("disposal", "GROUND_IMPACT")
    mass_kg = max(1.0, safe_float(stage.get("empty_mass_kg"), 0.0))
    diameter_m = max(1.0, safe_float(stage.get("diameter_m"), 1.0))
    base = (diameter_m * 0.9) + (math.sqrt(mass_kg) / 110.0) + (abs(crossrange_km) / 20.0)

    if disposal == "RECOVERY":
        return max(2.0, min(18.0, base))
    if disposal == "OCEAN_IMPACT":
        return max(4.0, min(26.0, base * 1.2))
    if disposal == "CONTROLLED_DEORBIT":
        return max(18.0, min(120.0, base * 2.8))
    if disposal == "UNCONTROLLED_REENTRY":
        return max(80.0, min(900.0, base * 7.5))
    return max(5.0, min(40.0, base * 1.5))


def hermes_method_label(environment):
    return f"BALLISTIC_PHYSICS + {environment.get('source', 'ATMOS_MODEL')}"


def hermes_crossrange_offset(stage, stage_index, downrange_km, wind_speed, humidity, lat, lon):
    disposal = stage.get("disposal", "GROUND_IMPACT")
    stage_size = max(float(stage.get("diameter_m", 1.0) or 1.0), 1.0)
    base_offset = (abs(wind_speed) * 2.1) + (stage_size * 2.0) + ((stage_index + 1) * 8.0) + (humidity / 26.0)

    if disposal == "UNCONTROLLED_REENTRY":
        base_offset *= 2.2
    elif disposal == "GROUND_IMPACT":
        base_offset *= 1.35
    elif disposal == "CONTROLLED_DEORBIT":
        base_offset *= 0.85
    elif disposal == "RECOVERY":
        base_offset *= 0.7
    elif disposal == "OCEAN_IMPACT":
        base_offset *= 0.9

    offset_limit = max(8.0, min(140.0, downrange_km * 0.26))
    direction_seed = math.sin(math.radians((lat * 11.0) + (lon * 4.0) + (stage_index * 57.0) + humidity))
    direction = -1.0 if direction_seed < 0 else 1.0
    if stage_index % 2 == 1:
        direction *= -1.0
    return direction * min(base_offset, offset_limit)


def hermes_risk_level(stage, downrange_km, mass_kg):
    disposal = stage.get("disposal", "GROUND_IMPACT")
    if disposal == "UNCONTROLLED_REENTRY":
        return "KRITIK"
    if disposal == "GROUND_IMPACT" or mass_kg >= 80000:
        return "YUKSEK"
    if disposal in ("CONTROLLED_DEORBIT", "RECOVERY"):
        return "ORTA" if downrange_km < 180 else "DUSUK"
    if disposal == "OCEAN_IMPACT":
        return "DUSUK"
    return "ORTA"


def hermes_confidence_label(raw_confidence):
    normalized = str(raw_confidence or "").strip().upper()
    return HERMES_CONFIDENCE_MAP.get(normalized, raw_confidence or "ORTA")

app = FastAPI(title="TetraTech Mission Control API [NEURAL-AI ENHANCED]")

# 🌍 TETRA GLOBE INTELLIGENCE - DAHİLİ COĞRAFİ KATMAN (KRAL İSTEDİ)
class GlobeIntelligence:
    @staticmethod
    def is_on_land(lat, lon):
        # BASİT AMA %100 DETERMINISTIK KARA KÜTLESİ MATRİSİ (Sıfır API)
        continents = [
            {"name": "Eurasia/MiddleEast", "lat": (1.0, 78.0), "lon": (-10.0, 190.0)},
            {"name": "Africa", "lat": (-35.0, 38.0), "lon": (-20.0, 52.0)},
            {"name": "NorthAmerica", "lat": (7.0, 85.0), "lon": (-170.0, -50.0)},
            {"name": "SouthAmerica", "lat": (-56.0, 15.0), "lon": (-85.0, -32.0)},
            {"name": "Australia", "lat": (-50.0, -10.0), "lon": (110.0, 158.0)},
            {"name": "Turkey/Anatolia", "lat": (35.0, 43.0), "lon": (25.0, 45.0)},
            {"name": "MiddleEast_Specific", "lat": (12.0, 40.0), "lon": (34.0, 60.0)}
        ]
        # Eğer bu kutulardan birinin içindeyse KARADIR kral!
        for c in continents:
            if c['lat'][0] <= lat <= c['lat'][1] and c['lon'][0] <= lon <= c['lon'][1]:
                return True
        return False


# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "Tetra Assistant Online", "engine": "V1.0 (LOCAL)", "timestamp": str(datetime.datetime.now())}

@app.get("/api/weather")
def get_weather(lat: str = "40.18", lon: str = "29.07", city: str = None):
    try:
        return get_weather_data(lat, lon, city)
    except Exception as e:
        return {"city": "HATA", "desc": str(e)}

@app.get("/api/topo")
def get_topo(lat: float = 40.18, lon: float = 29.07):
    try:
        topo = get_topo_data(lat, lon)
        
        # RESMİ ÜS DİNAMİK YAKINLIK ANALİZİ
        import math
        def get_dist(lat1, lon1, lat2, lon2):
            R = 6371.0 # km
            dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        official_ports = SpaceportManager().spaceports
        for op in official_ports:
            dist_km = get_dist(lat, lon, op['lat'], op['lon'])
            
            # 35km'lik bir etki alanı (Radius)
            if dist_km <= 35:
                # Dinamik Bonus Hesapla: Mesafe 0'a yaklaştıkça bonus 50 puana kadar çıkar
                # (1 - (dist / limit)) * max_bonus
                proximity_factor = 1.0 - (dist_km / 35.0)
                bonus = int(55 * proximity_factor)
                
                current_score = int(topo.get("score", 0))
                # En yakın noktada skor %100 olur, uzaklaştıkça doğal topo verisiyle birleşir
                final_score = min(100, current_score + bonus)
                if dist_km < 5: final_score = max(final_score, 98) # Dibindeyse %98'den aşağı düşmez
                
                topo["score"] = str(final_score)
                topo["suitability"] = f"STRATEJIK: {op['name']} resmi saha etkisi ({dist_km:.1f} km)"
                topo["civ_risk"] = "DUSUK RISK: Resmi perimetre ve tampon bolge icinde"
                topo["airspace_risk"] = "KONTROLLU: Oncelikli operasyon koridoru"
                topo["launch_grade"] = "A"
                topo["launch_recommendation"] = "ONAY"
                topo["confidence"] = "YUKSEK"
                topo["primary_constraints"] = ["Resmi launch sahasi yakinligi tespit edildi"]
                break
                
        return topo
    except Exception as e:
        return {"error": str(e), "suitability": "HATA"}

@app.get("/api/space")
def get_space(lat: float = 40.18, lon: float = 29.07):
    try:
        return get_space_weather_data(lat, lon)
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/airspace")
def get_airspace(lat: float, lon: float):
    try:
        return get_notam_and_flights(lat, lon)
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/simulate")
def simulate(
    lat: float = 40.18, 
    lon: float = 29.07, 
    rocket_name: str = None, 
    rocket_id: str = "falcon9",
    c_name: str = "Özel Araç",
    c_mass: float = 1000,
    c_tol: float = 10,
    c_eff: float = 0.8,
    time_str: str = "12:00"
):
    try:
        # 1. 📡 VERİ TOPLAMA KATMANI
        weather_base = get_weather_data(lat, lon)
        topo = get_topo_data(lat, lon)
        space = get_space_weather_data(lat, lon)
        notam = get_notam_and_flights(lat, lon)
        
        # TETRA GLOBE INTELLIGENCE (Dahili Kara Tespiti)
        is_on_land = GlobeIntelligence.is_on_land(lat, lon)
        
        # Roket Verisi Çek (Fizik motoru ile %100 uyumlu teknik veriler)
        rockets = {
            "ares": {"name": "Ares 1 (B)", "thrust": 18000, "mass": 801000, "efficiency": 0.92, "tol": 12},
            "ares1b": {"name": "Ares 1 (B)", "thrust": 18000, "mass": 801000, "efficiency": 0.92, "tol": 12},
            "shuttle": {"name": "Space Shuttle", "thrust": 35000, "mass": 2030000, "efficiency": 0.94, "tol": 14},
            "explorer": {"name": "Jupiter-C Rocket", "thrust": 500, "mass": 28000, "efficiency": 0.88, "tol": 10},
            "jupiter": {"name": "Jupiter-C Rocket", "thrust": 500, "mass": 28000, "efficiency": 0.88, "tol": 10},
            "falcon9": {"name": "Falcon 9", "thrust": 14000, "mass": 549054, "efficiency": 0.96, "tol": 15},
            "starship": {"name": "Starship", "thrust": 85000, "mass": 5000000, "efficiency": 0.92, "tol": 18},
            "falconheavy": {"name": "Falcon Heavy", "thrust": 35000, "mass": 1420788, "efficiency": 0.94, "tol": 14},
            "deltaiv": {"name": "Delta IV Heavy", "thrust": 15000, "mass": 733000, "efficiency": 0.92, "tol": 12},
            "zenit": {"name": "Zenit 3SL", "thrust": 12000, "mass": 462200, "efficiency": 0.90, "tol": 12},
            "ceres1": {"name": "Ceres 1", "thrust": 450, "mass": 30000, "efficiency": 0.88, "tol": 10},
            "cassini": {"name": "Cassini-Huygens", "thrust": 400, "mass": 2523, "efficiency": 0.95, "tol": 20},
            "agena": {"name": "Agena Target", "thrust": 71, "mass": 6000, "efficiency": 0.88, "tol": 10},
            "mir": {"name": "Mir Istasyonu", "thrust": 0.1, "mass": 129700, "efficiency": 1.0, "tol": 40}
        }
        
        # 🛡️ KRAL İSTEDİ: RESMİ ÜS DİNAMİK YAKINLIK ANALİZİ (Simulate Sync)
        import math
        def get_dist(lat1, lon1, lat2, lon2):
            R = 6371.0 # km
            dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        official_ports = SpaceportManager().spaceports
        is_official = False
        port_name = ""
        for op in official_ports:
            dist_km = get_dist(lat, lon, op['lat'], op['lon'])
            if dist_km <= 35:
                is_official = True
                port_name = op['name']
                proximity_factor = 1.0 - (dist_km / 35.0)
                bonus = int(60 * proximity_factor) # Bonus artırıldı
                
                current_score = int(topo.get("score", 0))
                final_score = min(100, current_score + bonus)
                if dist_km < 8: final_score = max(final_score, 100) # Dibindeyse %100!
                
                topo["score"] = str(final_score)
                topo["suitability"] = f"STRATEJİK: {op['name']} ({dist_km:.1f} KM)"
                topo["civ_risk"] = f"GÜVENLİ: Resmi Perimetre İçinde"
                topo["airspace_risk"] = "KONTROLLÜ: Öncelikli Operasyon Kanalları"
                break
        
        # Özel bir roket ismi veya ID mi?
        if rocket_id == "custom":
             rocket = {"name": c_name, "thrust": 10000, "mass": c_mass, "efficiency": c_eff, "tol": c_tol}
        else:
             # Önce ID'ye bak, yoksa name'e bak, o da yoksa Falcon 9
             rid = rocket_id.lower().replace(" ", "").replace("-", "") if rocket_id else ""
             rocket = rockets.get(rid)
             
             if not rocket and rocket_name:
                 # İsimle eşleştirme dene (Tüm listeyi dön)
                 clean_name = rocket_name.lower().replace(" ", "").replace("-", "")
                 for k, v in rockets.items():
                     if v['name'].lower().replace(" ", "").replace("-", "") == clean_name:
                         rocket = v
                         break
             
             if not rocket:
                 rocket = rockets["falcon9"]

        
        # 2. 🧠 TETRA ASSISTANT ANALİZ KATMANI (Sıfırdan Bot Kararı)
        # ══════════════════════════════════════════════════════════════
        # Resmi launch sahasi ile normal kara tespitini ayri ele alalim.
        land_detected = is_on_land or is_official
        ai_result = neural_engine.predict_score(
            weather_base,
            topo,
            space,
            rocket,
            time_str,
            approved_launch_site=is_official,
            land_detected=land_detected
        )
        
        if is_official:
            topo["score"] = "100"
            topo["suitability"] = f"STRATEJIK: {port_name} resmi firlatma perimetresi"
            topo["civ_risk"] = "GUVENLI: Resmi uzay ussu perimetresi icinde"
            topo["airspace_risk"] = "KONTROLLU: Oncelikli operasyon koridoru"
            topo["logistics"] = "YUKSEK: Resmi launch altyapisi mevcut"
            topo["water_safety"] = "KONTROLLU: Kiyisal operasyon sahasi onayli"
            if str(topo.get("terrain_info", "")).upper().find("HATALI VERI") >= 0 or float(topo.get("elevation", 0) or 0) <= 0:
                topo["terrain_info"] = "DENIZ SEVIYESI KIYI FIRLATMA SAHASI"
                topo["acoustic_risk"] = "KONTROLLU: Firlatma sesi ve pad zonu operasyon plani icinde"

        # NOTAM / hava sahasi kontrolu
        traffic_count = int(notam.get("count", 0) or 0)
        wait_time = int(notam.get("wait_time", 0) or 0)
        is_airspace_clear = bool(notam.get("is_airspace_clear", True))

        if traffic_count > 0 and not is_airspace_clear:
            notam_penalty = 5 if is_official else min(25, 10 + traffic_count * 4)
            ai_result['score'] = max(0, ai_result['score'] - notam_penalty)

            risk_level = "ORTA" if is_official else "YUKSEK"
            wait_text = f" Tahmini bekleme: {wait_time} dk." if wait_time > 0 else ""
            ai_result['risks'].append({
                "type": "HAVA SAHASI AKTIF",
                "level": risk_level,
                "msg": f"Bolgede {traffic_count} adet potansiyel hava sahasi konflikti tespit edildi.{wait_text}"
            })

        if ai_result['score'] < 45:
            ai_result['status'] = "IPTAL"
            ai_result['decision'] = "TETRA ASSISTANT KARARI: GOREV REDDEDILDI"
        elif ai_result['score'] < 75:
            ai_result['status'] = "BEKLEME"
            ai_result['decision'] = "TETRA ASSISTANT KARARI: GOREV BEKLEMEYE ALINDI"
        else:
            ai_result['status'] = "UYGUN"
            if is_official:
                ai_result['decision'] = "TETRA ASSISTANT ONAYI: GOREV ONAYLANDI"
            else:
                ai_result['decision'] = "TETRA ASSISTANT ONAYI: GOREV ONAYLANDI"

        # 3. FİZİKSEL HESAPLAMALAR VE RAPORLAMA
        # ══════════════════════════════════════════════════════════════
        # Güvenli Rakım ve Veri Çekme
        curr_elev = topo.get('elevation', 0)
        fuel_needed = int((rocket["mass"] * 0.18) / (1.0 + (curr_elev/8000) * rocket["efficiency"]))
        carbon = int(fuel_needed * 3.12)
        
        # Analiz Özet Yazısı Prepare (Sıfır Hata Payı)
        r_name = rocket.get("name", "Bilinmeyen Araç")
        analysis = f"MISSION ID: TETRA-{r_name.upper().replace(' ', '-')}-{int(datetime.datetime.now().timestamp())}\n"
        analysis += f"TETRA ASSISTANT KARARI: {ai_result['decision']}\n"
        analysis += f"GÜVEN SEVİYESİ: {ai_result['confidence']}\n"
        analysis += f"MOTOR: {ai_result['ai_engine']}\n\n"
        
        if ai_result['risks']:
            analysis += "KRİTİK ANALİZ RAPORU:\n"
            for r in ai_result['risks']:
                analysis += f"- [{r['level']}] {r['type']}: {r['msg']}\n"
        else:
            analysis += "TETRA ASSISTANT TESPİTİ: Görev rotasında kritik bir anomali saptanmadı. Tüm şartlar nominal."

        # 4. FRONTEND UYUMLULUK VE PAKETLEME
        # ══════════════════════════════════════════════════════════════
        # App.jsx'in beklediği spesifik anahtarları ekleyelim kral!
        weather_report = weather_base.copy()
        weather_report["wind_speed"] = weather_base.get("wind", "0")
        weather_report["temp"] = weather_base.get("temp", "0")
        
        return {
            "status": ai_result['status'],
            "score": ai_result['score'],
            "decision": ai_result['decision'],
            "analysis": analysis,
            "confidence": ai_result['confidence'],
            "ai_engine": ai_result['ai_engine'],
            "risks": ai_result['risks'],
            "rocket_name": r_name, # HEDEF ARAÇ Sync
            "target_time": time_str, # Zaman Sync
            "weather": weather_base,
            "weather_forecast": weather_report, # Balistik ve Rüzgar GÜCÜ Sync
            "topo": topo,
            "topo_stats": topo, # App.jsx Skor uyumu
            "space": space,
            "notam": notam,
            "rocket": rocket,
            "environmental": {
                "fuel_needed": f"{fuel_needed:,} KG",
                "carbon": f"{carbon:,} KG CO2",
                "altitude": f"{curr_elev} m"
            },
            "timestamp": str(datetime.datetime.now())
        }
    except Exception as e:
        import traceback
        return {"status": "HATA", "decision": "TETRA ASSISTANT FAILURE", "error": str(e), "trace": traceback.format_exc()}

@app.get("/api/spaceports")
def get_spaceports():
    try:
        return SpaceportManager().spaceports
    except Exception as e:
        return []

@app.get("/api/hermes/rockets")
def get_hermes_rockets():
    return {
        "rockets": [
            {"name": "Falcon 9", "flights": 180, "confidence": "YUKSEK", "propellant": "LOX/RP-1", "stages_count": 2},
            {"name": "Falcon Heavy", "flights": 5, "confidence": "ORTA", "propellant": "LOX/RP-1", "stages_count": 2},
            {"name": "Starship", "flights": 3, "confidence": "DENEYSEL", "propellant": "LOX/Methane", "stages_count": 2},
            {"name": "Ares-1B", "flights": 0, "confidence": "TEORIK", "propellant": "Solid/LOX", "stages_count": 2}
        ]
    }

@app.get("/api/hermes/predict")
def hermes_predict(rocket_model: str, lat: float, lon: float, azimuth: float):
    resolved_name, rocket = resolve_hermes_rocket(rocket_model)
    if not rocket:
        return {
            "rocket": rocket_model,
            "impact_zones": [],
            "confidence": "0%",
            "propellant": "-",
            "method": "HERMES_OFFLINE",
            "stages_manifest": [],
            "error": f"Roket modeli bulunamadi: {rocket_model}"
        }

    environment = hermes_environment_factors(lat, lon)
    wind_speed = environment["wind_speed"]
    humidity = environment["humidity"]
    launch_alt = environment["launch_alt"]
    stages = rocket.get("stages", [])
    physics_stages = [stage for stage in stages if float(stage.get("thrust_kn", 0) or 0) > 0]
    physics_impacts = HERMES_PHYSICS.compute_stage_impacts(
        physics_stages,
        wind_speed=wind_speed,
        humidity=humidity,
        launch_alt=launch_alt
    ) if physics_stages else []
    physics_lookup = {item["stage_num"]: item for item in physics_impacts}

    impact_zones = []
    for index, stage in enumerate(stages):
        stage_num = int(stage.get("stage_num", index + 1) or (index + 1))
        physics_item = physics_lookup.get(stage_num)
        raw_downrange_km = physics_item.get("total_downrange_km", 0.0) if physics_item else 0.0
        downrange_km = normalize_downrange_km(stage, index, raw_downrange_km, environment)
        disposal = stage.get("disposal", "GROUND_IMPACT")

        crossrange_km = hermes_crossrange_offset(stage, index, downrange_km, wind_speed, humidity, lat, lon)
        corridor_lat, corridor_lon = hermes_destination_point(lat, lon, azimuth, downrange_km)
        impact_lat, impact_lon = hermes_destination_point(corridor_lat, corridor_lon, azimuth + 90.0, crossrange_km)

        mass_kg = safe_float(stage.get("empty_mass_kg"), 0.0)
        impact_radius_km = compute_impact_radius_km(stage, downrange_km, crossrange_km)

        impact_zones.append({
            "stage_num": stage_num,
            "name": stage.get("name", f"Stage {stage_num}"),
            "lat": round(impact_lat, 6),
            "lon": round(impact_lon, 6),
            "downrange_km": round(downrange_km, 1),
            "crossrange_km": round(crossrange_km, 1),
            "raw_downrange_km": round(safe_float(raw_downrange_km, 0.0), 1),
            "mass_kg": int(round(mass_kg)),
            "risk_level": hermes_risk_level(stage, downrange_km, mass_kg),
            "type": disposal,
            "disposal": disposal,
            "impact_radius_km": round(impact_radius_km, 1),
            "msi": round(impact_radius_km / 10.0, 2),
            "method": hermes_method_label(environment)
        })

    return {
        "rocket": rocket_model,
        "resolved_rocket": resolved_name,
        "impact_zones": impact_zones,
        "confidence": hermes_confidence_label(rocket.get("confidence")),
        "propellant": rocket.get("propellant_type", "-"),
        "method": hermes_method_label(environment),
        "solver": "NON_AI_BALLISTIC",
        "environment": {
            "wind_speed": round(wind_speed, 1),
            "humidity": round(humidity, 1),
            "launch_alt_m": round(launch_alt, 1),
            "pressure_hpa": round(environment["pressure"], 1),
            "temperature_c": round(environment["temperature"], 1),
            "weather_desc": environment["weather"].get("desc", "-"),
            "weather_source": environment["source"]
        },
        "stages_manifest": [
            {
                "stage_num": int(stage.get("stage_num", idx + 1) or (idx + 1)),
                "name": stage.get("name", f"Stage {idx + 1}"),
                "thrust_kn": stage.get("thrust_kn", 0),
                "propellant_mass_kg": stage.get("propellant_mass_kg", 0),
                "empty_mass_kg": stage.get("empty_mass_kg", 0),
                "burn_time_s": stage.get("burn_time_s", 0),
                "diameter_m": stage.get("diameter_m", 0),
                "disposal": stage.get("disposal", "-"),
                "material": stage.get("material", "-")
            }
            for idx, stage in enumerate(stages)
        ]
    }
    # Basit bir HERMES tahmin simülasyonu
    impact_zones = []
    import math
    for i in range(1, 4):
        dist = i * 150
        angle = math.radians(azimuth)
        i_lat = lat + (dist / 111.0) * math.cos(angle)
        i_lon = lon + (dist / (111.0 * math.cos(math.radians(lat)))) * math.sin(angle)
        impact_zones.append({
            "stage_num": i,
            "lat": i_lat,
            "lon": i_lon,
            "downrange_km": dist,
            "mass_kg": random.randint(500, 5000),
            "risk_level": "DUSUK" if i > 1 else "ORTA"
        })
    
    return {
        "rocket": rocket_model,
        "impact_zones": impact_zones,
        "confidence": "94%",
        "propellant": "LOX/RP-1",
        "stages_manifest": [
            {"name": "Stage 1", "material": "Al-Li Alloy", "disposal": "Barge Landing", "burn_time_s": 160},
            {"name": "Stage 2", "material": "Stainless Steel", "disposal": "Ocean Impact", "burn_time_s": 390}
        ]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)
