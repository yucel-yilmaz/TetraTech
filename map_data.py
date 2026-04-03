import math
from functools import lru_cache

import requests
# .


ELEVATION_TIMEOUT = 1.5
OVERPASS_TIMEOUT = 4.0
USER_AGENT = "TetraTechSurfaceIntel/2.0"
DEFAULT_RISK_RADIUS_M = 16000
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
KNOWN_SURFACE_SITES = [
    {"name": "Kennedy Space Center", "lat": 28.5729, "lon": -80.6490, "terrain": "KIYI FIRLATMA SAHASI", "score": 88, "surface_class": "CONTROLLED_COAST"},
    {"name": "Cape Canaveral", "lat": 28.3922, "lon": -80.6077, "terrain": "KIYI FIRLATMA SAHASI", "score": 86, "surface_class": "CONTROLLED_COAST"},
    {"name": "Vandenberg", "lat": 34.7420, "lon": -120.5724, "terrain": "KIYI TEST VE FIRLATMA SAHASI", "score": 84, "surface_class": "CONTROLLED_COAST"},
    {"name": "Kourou", "lat": 5.2394, "lon": -52.7685, "terrain": "EKVATORAL KIYI FIRLATMA SAHASI", "score": 90, "surface_class": "CONTROLLED_COAST"},
    {"name": "Baikonur", "lat": 45.9646, "lon": 63.3052, "terrain": "IC BOLGE FIRLATMA SAHASI", "score": 82, "surface_class": "CONTROLLED_STEPPE"},
    {"name": "Sriharikota", "lat": 13.7196, "lon": 80.2304, "terrain": "KIYI FIRLATMA SAHASI", "score": 84, "surface_class": "CONTROLLED_COAST"},
]
CONTINENT_BOXES = [
    {"name": "EURASIA", "lat": (5.0, 75.0), "lon": (-10.0, 180.0)},
    {"name": "AFRICA", "lat": (-35.0, 38.0), "lon": (-20.0, 55.0)},
    {"name": "NORTH_AMERICA", "lat": (7.0, 83.0), "lon": (-170.0, -50.0)},
    {"name": "SOUTH_AMERICA", "lat": (-56.0, 15.0), "lon": (-85.0, -32.0)},
    {"name": "AUSTRALIA", "lat": (-50.0, -10.0), "lon": (110.0, 158.0)},
]


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def km_to_lat(km_value):
    return km_value / 111.32


def km_to_lon(km_value, latitude):
    return km_value / max(111.32 * math.cos(math.radians(latitude)), 0.1)


def add_hazard(hazards, feature_type, name, lat, lon, severity, limit):
    if len(hazards) >= limit:
        return
    hazards.append(
        {
            "name": name,
            "type": feature_type,
            "lat": lat,
            "lon": lon,
            "severity": severity,
        }
    )


def haversine_km(lat1, lon1, lat2, lon2):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def update_nearest_km(nearest_map, key, origin_lat, origin_lon, item_lat, item_lon):
    if item_lat is None or item_lon is None:
        return None
    distance = haversine_km(origin_lat, origin_lon, item_lat, item_lon)
    current = nearest_map.get(key)
    if current is None or distance < current:
        nearest_map[key] = distance
    return distance


def infer_land_offline(lat, lon):
    for box in CONTINENT_BOXES:
        if box["lat"][0] <= lat <= box["lat"][1] and box["lon"][0] <= lon <= box["lon"][1]:
            return True, box["name"]
    return False, "OPEN_WATER"


@lru_cache(maxsize=256)
def fetch_elevation(lat_key, lon_key):
    try:
        response = requests.get(
            "https://api.open-meteo.com/v1/elevation",
            params={"latitude": lat_key, "longitude": lon_key},
            timeout=ELEVATION_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
        )
        if response.status_code == 200:
            payload = response.json()
            elevation = payload.get("elevation")
            if isinstance(elevation, list) and elevation:
                return safe_float(elevation[0], 0.0)
            return safe_float(elevation, 0.0)
    except requests.RequestException:
        return 0.0
    except Exception:
        return 0.0
    return 0.0


@lru_cache(maxsize=128)
def fetch_surface_elements(lat_key, lon_key):
    bbox_radius_km = 10.0
    lat_delta = km_to_lat(bbox_radius_km)
    lon_delta = km_to_lon(bbox_radius_km, lat_key)
    min_lat = lat_key - lat_delta
    max_lat = lat_key + lat_delta
    min_lon = lon_key - lon_delta
    max_lon = lon_key + lon_delta

    query = f"""
    [out:json][timeout:18];
    (
      node["natural"~"peak|volcano|cliff"]({min_lat},{min_lon},{max_lat},{max_lon});
      way["natural"~"water|wetland|coastline"]({min_lat},{min_lon},{max_lat},{max_lon});
      relation["natural"~"water|wetland"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["place"~"city|town|village|suburb|neighbourhood|hamlet"]({min_lat},{min_lon},{max_lat},{max_lon});
      way["landuse"~"residential|industrial|commercial|retail|military"]({min_lat},{min_lon},{max_lat},{max_lon});
      way["aeroway"~"aerodrome|runway"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["aeroway"="aerodrome"]({min_lat},{min_lon},{max_lat},{max_lon});
      way["highway"~"motorway|trunk|primary"]({min_lat},{min_lon},{max_lat},{max_lon});
      way["railway"="rail"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["man_made"~"tower|communications_tower|mast"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["power"="plant"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out center;
    """

    headers = {"User-Agent": USER_AGENT}
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            response = requests.get(
                endpoint,
                params={"data": query},
                headers=headers,
                timeout=OVERPASS_TIMEOUT,
            )
            if response.status_code == 200:
                payload = response.json()
                return payload.get("elements", []), endpoint
        except requests.RequestException:
            continue
        except Exception:
            continue

    return [], None


def classify_density(metrics):
    weighted_density = (
        metrics["cities"] * 9
        + metrics["towns"] * 6
        + metrics["suburbs"] * 3
        + metrics["villages"] * 2
        + metrics["residential_areas"] * 2
        + metrics["roads"] * 0.6
        + metrics["railways"] * 0.8
        + metrics["industrial_areas"] * 1.5
    )

    if metrics["cities"] > 0 or weighted_density >= 12:
        return "URBAN", weighted_density
    if metrics["towns"] > 0 or metrics["suburbs"] >= 2 or weighted_density >= 7:
        return "SUBURBAN", weighted_density
    if metrics["villages"] > 0 or weighted_density >= 3:
        return "RURAL", weighted_density
    return "SPARSE", weighted_density


def build_offline_response(lat, lon, elevation):
    nearest_site = None
    nearest_distance = None
    for site in KNOWN_SURFACE_SITES:
        distance = haversine_km(lat, lon, site["lat"], site["lon"])
        if nearest_distance is None or distance < nearest_distance:
            nearest_site = site
            nearest_distance = distance

    if nearest_site and nearest_distance is not None and nearest_distance <= 140:
        return {
            "peaks": "0",
            "towers": "1",
            "residential": f"Kontrollu saha civari | en yakin site={nearest_site['name']}",
            "score": str(nearest_site["score"]),
            "terrain_info": f"{int(round(elevation))} m - {nearest_site['terrain']}",
            "elevation": int(round(elevation)),
            "acoustic_risk": "DUSUK: Resmi pad ve tampon bolge varsayildi",
            "civ_risk": "DUSUK RISK: Bilinen launch sahasi yakinligi",
            "industrial": "1",
            "airspace_risk": "ORTA: Ag yok, resmi saha koridoru varsayildi",
            "logistics": "YUKSEK: Bilinen launch altyapisi eslestirildi",
            "water_safety": "KONTROLLU: Kiyi ve recovery plani varsayildi",
            "names": [nearest_site["name"]],
            "hazards": [],
            "suitability": "STRATEJIK: Bilinen firlatma sahasi profili ile eslesti",
            "target_lat": str(lat),
            "target_lon": str(lon),
            "risk_radius_m": 12000,
            "analysis_source": "OFFLINE_SITE_MATCH",
            "surface_class": nearest_site["surface_class"],
            "launch_grade": "A",
            "launch_recommendation": "ONAY",
            "confidence": "ORTA",
            "primary_constraints": ["Ag baglantisi yok, saha profili bilinen launch merkeziyle eslestirildi"],
            "nearest_settlement_km": None,
            "nearest_airport_km": None,
            "nearest_water_km": None,
            "site_buffer_km": 18.0,
        }

    on_land, land_label = infer_land_offline(lat, lon)
    likely_coastal = on_land and abs(lat) < 58 and elevation <= 35

    if on_land:
        score = 62 if likely_coastal else 56
        terrain_info = (
            f"{int(round(elevation))} m - KIYI / DUZLUK TAHMINI"
            if likely_coastal
            else f"{int(round(elevation))} m - IC BOLGE ARAZI TAHMINI"
        )
        civ_risk = "ORTA RISK: Ag yok, yerlesim yogunlugu tahmini kullanildi"
        logistics = "ORTA: Kitasal kara erisimi varsayildi"
        water_safety = "DUSUK: Kara saha varsayimi"
        suitability = "SINIRLI: Ag baglantisi yok, kara saha on tahmini"
        surface_class = f"OFFLINE_{land_label}"
    else:
        score = 26
        terrain_info = f"{int(round(elevation))} m - ACIK SU TAHMINI"
        civ_risk = "DUSUK RISK: Yerlesim etkisi dusuk, ancak saha kara degil"
        logistics = "DUSUK: Deniz ustu lojistik gerekir"
        water_safety = "YUKSEK: Su etkisi baskin"
        suitability = "UYGUN DEGIL: Acik su koordinati tahmin edildi"
        surface_class = "OFFLINE_WATER"

    recommendation = "KONTROLLU ONAY" if on_land else "RED"
    confidence = "DUSUK"
    constraints = ["Ag baglantisi yok, offline cografi model kullanildi"]
    if not on_land:
        constraints.append("Koordinat acik su olarak siniflandi")

    return {
        "peaks": "0",
        "towers": "0",
        "residential": "Tahmini / Veri Yok",
        "score": str(score),
        "terrain_info": terrain_info,
        "elevation": int(round(elevation)),
        "acoustic_risk": "ON TAHMIN: Akustik risk sinirli veri ile olculdu",
        "civ_risk": civ_risk,
        "industrial": "0",
        "airspace_risk": "BILINMIYOR: Havaalani ve koridor verisi alinamadi",
        "logistics": logistics,
        "water_safety": water_safety,
        "names": ["Offline model kullanildi"],
        "hazards": [],
        "suitability": suitability,
        "target_lat": str(lat),
        "target_lon": str(lon),
        "risk_radius_m": DEFAULT_RISK_RADIUS_M,
        "analysis_source": "OFFLINE_SURFACE_MODEL",
        "surface_class": surface_class,
        "launch_grade": "C" if on_land else "D",
        "launch_recommendation": recommendation,
        "confidence": confidence,
        "primary_constraints": constraints,
        "nearest_settlement_km": None,
        "nearest_airport_km": None,
        "nearest_water_km": None,
        "site_buffer_km": None,
    }


def get_topo_data(lat=40.2, lon=29.0):
    lat_f = safe_float(lat, 40.2)
    lon_f = safe_float(lon, 29.0)
    lat_key = round(lat_f, 4)
    lon_key = round(lon_f, 4)

    elevation_m = fetch_elevation(lat_key, lon_key)
    elements, source_endpoint = fetch_surface_elements(lat_key, lon_key)

    if not elements:
        return build_offline_response(lat_f, lon_f, elevation_m)

    metrics = {
        "peaks": 0,
        "towers": 0,
        "airports": 0,
        "roads": 0,
        "railways": 0,
        "water_features": 0,
        "cities": 0,
        "towns": 0,
        "villages": 0,
        "suburbs": 0,
        "residential_areas": 0,
        "industrial_areas": 0,
        "commercial_areas": 0,
        "military_areas": 0,
        "power_sites": 0,
    }
    hazards = []
    names = []
    nearest = {
        "settlement": None,
        "airport": None,
        "military": None,
        "water": None,
        "road": None,
        "rail": None,
        "industrial": None,
        "power": None,
        "tower": None,
        "peak": None,
    }

    for element in elements:
        tags = element.get("tags", {})
        feature_name = tags.get("name", "Adsiz")
        item_lat = element.get("lat")
        item_lon = element.get("lon")
        if item_lat is None and "center" in element:
            item_lat = element["center"].get("lat")
            item_lon = element["center"].get("lon")
        distance_km = None
        if item_lat is not None and item_lon is not None:
            distance_km = haversine_km(lat_f, lon_f, item_lat, item_lon)

        place_type = tags.get("place", "")
        natural_type = tags.get("natural", "")
        landuse = tags.get("landuse", "")
        aeroway = tags.get("aeroway", "")
        highway = tags.get("highway", "")
        railway = tags.get("railway", "")
        man_made = tags.get("man_made", "")

        if natural_type in {"peak", "volcano", "cliff"}:
            metrics["peaks"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "peak", lat_f, lon_f, item_lat, item_lon)
            if item_lat is not None and item_lon is not None:
                add_hazard(hazards, "peak", f"{feature_name} (Peak)", item_lat, item_lon, "MEDIUM", 10)
        elif natural_type in {"water", "wetland", "coastline"} or tags.get("waterway") == "riverbank":
            metrics["water_features"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "water", lat_f, lon_f, item_lat, item_lon)
            if item_lat is not None and item_lon is not None:
                add_hazard(hazards, "water", f"{feature_name} (Water)", item_lat, item_lon, "LOW", 10)

        if man_made in {"tower", "communications_tower", "mast"}:
            metrics["towers"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "tower", lat_f, lon_f, item_lat, item_lon)
            if item_lat is not None and item_lon is not None:
                add_hazard(hazards, "tower", f"{feature_name} (Tower)", item_lat, item_lon, "LOW", 10)

        if place_type == "city":
            metrics["cities"] += 1
        elif place_type == "town":
            metrics["towns"] += 1
        elif place_type in {"village", "hamlet"}:
            metrics["villages"] += 1
        elif place_type in {"suburb", "neighbourhood"}:
            metrics["suburbs"] += 1

        if place_type and item_lat is not None and item_lon is not None:
            update_nearest_km(nearest, "settlement", lat_f, lon_f, item_lat, item_lon)
            add_hazard(hazards, "residential", f"{feature_name} ({place_type.title()})", item_lat, item_lon, "MEDIUM", 10)

        if landuse == "residential":
            metrics["residential_areas"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "settlement", lat_f, lon_f, item_lat, item_lon)
        elif landuse == "industrial":
            metrics["industrial_areas"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "industrial", lat_f, lon_f, item_lat, item_lon)
            if item_lat is not None and item_lon is not None:
                add_hazard(hazards, "industrial", f"{feature_name} (Industrial)", item_lat, item_lon, "LOW", 10)
        elif landuse in {"commercial", "retail"}:
            metrics["commercial_areas"] += 1
        elif landuse == "military":
            metrics["military_areas"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "military", lat_f, lon_f, item_lat, item_lon)

        if aeroway in {"aerodrome", "runway"}:
            metrics["airports"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "airport", lat_f, lon_f, item_lat, item_lon)
            if item_lat is not None and item_lon is not None:
                add_hazard(hazards, "airport", f"{feature_name} (Aerodrome)", item_lat, item_lon, "HIGH", 10)

        if highway in {"motorway", "trunk", "primary"}:
            metrics["roads"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "road", lat_f, lon_f, item_lat, item_lon)
        if railway == "rail":
            metrics["railways"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "rail", lat_f, lon_f, item_lat, item_lon)
        if tags.get("power") == "plant":
            metrics["power_sites"] += 1
            if distance_km is not None:
                update_nearest_km(nearest, "power", lat_f, lon_f, item_lat, item_lon)

        if len(names) < 12 and tags.get("name"):
            names.append(feature_name)

    density_class, weighted_density = classify_density(metrics)
    human_presence = weighted_density + (metrics["airports"] * 2.5) + (metrics["military_areas"] * 2.0)
    nearest_settlement = nearest["settlement"]
    nearest_airport = nearest["airport"]
    nearest_military = nearest["military"]
    nearest_water = nearest["water"]
    nearest_road = nearest["road"]
    is_water = (
        metrics["water_features"] >= 2
        and metrics["cities"] == 0
        and metrics["towns"] == 0
        and metrics["roads"] == 0
        and elevation_m <= 12
    ) or (metrics["water_features"] > human_presence and elevation_m <= 5)

    score = 78
    if is_water:
        score -= 55
    elif density_class == "URBAN":
        score -= 42
    elif density_class == "SUBURBAN":
        score -= 24
    elif density_class == "RURAL":
        score -= 10
    else:
        score += 4

    if metrics["airports"] > 0:
        score -= min(28, 16 + metrics["airports"] * 4)
    if metrics["military_areas"] > 0:
        score -= min(18, 8 + metrics["military_areas"] * 3)
    if metrics["industrial_areas"] > 0 and density_class in {"SPARSE", "RURAL"}:
        score += 6
    elif metrics["industrial_areas"] > 0:
        score -= 4

    if elevation_m >= 2200:
        score -= 24
    elif elevation_m >= 1200:
        score -= 12
    elif elevation_m >= 250:
        score += 5
    elif elevation_m <= -5:
        score -= 15
    else:
        score += 2

    if metrics["peaks"] > 0:
        score -= min(18, metrics["peaks"] * 4)
    if metrics["towers"] > 0:
        score -= min(10, metrics["towers"] * 2)
    if metrics["roads"] >= 2:
        score += 4
    if metrics["railways"] > 0:
        score += 2
    if metrics["power_sites"] > 0:
        score += 2

    if not is_water:
        if nearest_settlement is not None:
            if nearest_settlement < 5:
                score -= 30
            elif nearest_settlement < 10:
                score -= 18
            elif nearest_settlement < 20:
                score -= 8
            elif nearest_settlement >= 35 and density_class in {"SPARSE", "RURAL"}:
                score += 5

        if nearest_airport is not None:
            if nearest_airport < 15:
                score -= 28
            elif nearest_airport < 30:
                score -= 16
            elif nearest_airport < 60:
                score -= 8

        if nearest_military is not None:
            if nearest_military < 12:
                score -= 18
            elif nearest_military < 25:
                score -= 10

        if nearest_road is None and density_class in {"SPARSE", "RURAL"}:
            score -= 4
        elif nearest_road is not None:
            if 1.5 <= nearest_road <= 20:
                score += 4
            elif nearest_road < 0.8:
                score -= 3

        if nearest_water is not None:
            if 3 <= nearest_water <= 45 and density_class in {"SPARSE", "RURAL"}:
                score += 6
            elif nearest_water < 1.0 and elevation_m <= 10:
                score -= 8

    score = int(clamp(score, 0, 100))
    is_coastal = bool(not is_water and nearest_water is not None and nearest_water <= 15 and elevation_m <= 80)
    buffer_candidates = [item for item in (nearest_settlement, nearest_airport, nearest_military) if item is not None]
    site_buffer_km = min(buffer_candidates) if buffer_candidates else None

    if is_water:
        terrain_info = f"{int(round(elevation_m))} m - ACIK SU / KIYI SUYU"
        civ_risk = "DUSUK RISK: Yerlesim baskisi yok, ancak su ustu operasyon altyapisi gerekir"
        acoustic_risk = "DUSUK: Akustik etki kara yerlesimine yayilmaz"
        logistics = "DUSUK: Deniz platformu veya ozel lojistik gerekir"
        water_safety = "YUKSEK: Su etkisi baskin, recovery ve ulasim zorlasir"
        suitability = "UYGUN DEGIL: Su yuzeyi operasyon icin ana saha olarak zayif"
    else:
        if density_class == "URBAN":
            civ_risk = "YUKSEK RISK: Kent / yogun yerlesim etkisi"
        elif density_class == "SUBURBAN":
            civ_risk = "ORTA RISK: Yerlesim alanlari yakin"
        elif density_class == "RURAL":
            civ_risk = "DUSUK RISK: Kirsal yerlesim daginik"
        else:
            civ_risk = "MINIMAL RISK: Belirgin yerlesim yogunlugu tespit edilmedi"

        if elevation_m >= 1800 or metrics["peaks"] >= 2:
            terrain_info = f"{int(round(elevation_m))} m - DAGLIK / RUGGED TERRAIN"
        elif is_coastal and density_class in {"SPARSE", "RURAL"}:
            terrain_info = f"{int(round(elevation_m))} m - KIYI OTESI DUZLUK / RECOVERY KORIDORU"
        elif elevation_m >= 600:
            terrain_info = f"{int(round(elevation_m))} m - YUKSEK PLATO / ENgebeli SAHA"
        else:
            terrain_info = f"{int(round(elevation_m))} m - DUZLUK / ALCAK EGRIM"

        if density_class == "URBAN":
            acoustic_risk = "YUKSEK: Ses ve sarsinti yerlesimlere ulasabilir"
        elif density_class == "SUBURBAN":
            acoustic_risk = "ORTA: Yerlesim etkisi kontrollu tampon ister"
        else:
            acoustic_risk = "DUSUK: Akustik yayilim operasyonel tampon ile yonetilebilir"

        logistics_parts = []
        if metrics["roads"] > 0:
            logistics_parts.append("ana yol erisimi")
        if metrics["railways"] > 0:
            logistics_parts.append("demiryolu")
        if metrics["industrial_areas"] > 0:
            logistics_parts.append("sanayi altyapisi")
        if metrics["power_sites"] > 0:
            logistics_parts.append("enerji tesisi")

        if logistics_parts:
            logistics = "ORTA-YUKSEK: " + ", ".join(logistics_parts[:3])
        elif nearest_road is not None and nearest_road <= 20:
            logistics = f"ORTA: Ana erisim koridoru {nearest_road:.1f} km"
        else:
            logistics = "ORTA: Belirgin agir lojistik emaresi yok"

        if is_coastal:
            water_safety = "KONTROLLU: Kiyisal recovery koridoru avantaj saglayabilir"
        else:
            water_safety = "DUSUK: Kara ustu saha tespit edildi"

        if score >= 82:
            suitability = "STRATEJIK: Arazi ve yerlesim dengesi operasyon icin guclu"
        elif score >= 65:
            suitability = "KONTROLLU UYGUN: Tampon ve saha planlamasi gerekir"
        elif score >= 45:
            suitability = "SINIRLI: Ek saha guvenlik tedbirleri gerekir"
        else:
            suitability = "KRITIK: Yerlesim veya arazi engeli operasyonu zorluyor"

    if nearest_airport is not None and nearest_airport < 30:
        airspace_risk = f"YUKSEK: Havaalani / pist yaklasimi {nearest_airport:.1f} km"
    elif metrics["airports"] > 0:
        airspace_risk = f"ORTA: {metrics['airports']} havaalani / pist emaresi bulundu"
    elif nearest_military is not None and nearest_military < 25:
        airspace_risk = f"ORTA: Kontrollu / askeri saha {nearest_military:.1f} km"
    elif metrics["military_areas"] > 0:
        airspace_risk = "ORTA: Kontrollu veya askeri saha emareleri bulundu"
    else:
        airspace_risk = "DUSUK: Belirgin havaalani yaklasimi tespit edilmedi"

    if density_class == "URBAN":
        residential_label = f"Sehirlesme yuksek | city={metrics['cities']} town={metrics['towns']} suburb={metrics['suburbs']}"
        risk_radius_m = 22000
    elif density_class == "SUBURBAN":
        residential_label = f"Yerlesim orta | town={metrics['towns']} suburb={metrics['suburbs']} village={metrics['villages']}"
        risk_radius_m = 18000
    elif density_class == "RURAL":
        residential_label = f"Kirsal daginik | village={metrics['villages']} residential={metrics['residential_areas']}"
        risk_radius_m = 14000
    else:
        residential_label = "Yerlesim seyrek / veri dusuk"
        risk_radius_m = 12000

    if is_water:
        risk_radius_m = 20000
    if metrics["airports"] > 0:
        risk_radius_m += 4000
    if nearest_settlement is not None and nearest_settlement < 10:
        risk_radius_m += 4000
    elif nearest_settlement is not None and nearest_settlement < 20:
        risk_radius_m += 2000

    primary_constraints = []
    if is_water:
        primary_constraints.append("Su ustu saha: kara tabanli pad altyapisi bulunmuyor")
    if nearest_settlement is not None and nearest_settlement < 10:
        primary_constraints.append(f"Yerlesim tamponu dar: {nearest_settlement:.1f} km")
    elif density_class == "URBAN":
        primary_constraints.append("Yuksek yerlesim yogunlugu")
    elif density_class == "SUBURBAN":
        primary_constraints.append("Yerlesim tamponu gerekli")
    if nearest_airport is not None and nearest_airport < 40:
        primary_constraints.append(f"Havaalani / pist yakinligi: {nearest_airport:.1f} km")
    if nearest_military is not None and nearest_military < 30:
        primary_constraints.append(f"Kontrollu veya askeri saha: {nearest_military:.1f} km")
    if metrics["peaks"] >= 2 or elevation_m >= 1800:
        primary_constraints.append("Daglik veya engebeli arazi")
    if is_coastal and score >= 70:
        primary_constraints.append("Kiyisal recovery koridoru operasyonel avantaj saglayabilir")
    if not primary_constraints:
        primary_constraints.append("Belirgin kritik topo engeli tespit edilmedi")

    if score >= 85:
        launch_grade = "A"
        launch_recommendation = "ONAY"
        confidence = "ORTA-YUKSEK" if source_endpoint else "ORTA"
    elif score >= 70:
        launch_grade = "B"
        launch_recommendation = "KONTROLLU ONAY"
        confidence = "ORTA"
    elif score >= 50:
        launch_grade = "C"
        launch_recommendation = "DETAYLI SAHA INCELEMESI GEREKLI"
        confidence = "ORTA"
    else:
        launch_grade = "D"
        launch_recommendation = "RED"
        confidence = "ORTA" if source_endpoint else "DUSUK"

    return {
        "peaks": str(metrics["peaks"]),
        "towers": str(metrics["towers"]),
        "residential": residential_label,
        "score": str(score),
        "terrain_info": terrain_info,
        "elevation": int(round(elevation_m)),
        "acoustic_risk": acoustic_risk,
        "civ_risk": civ_risk,
        "industrial": str(metrics["industrial_areas"]),
        "airspace_risk": airspace_risk,
        "logistics": logistics,
        "water_safety": water_safety,
        "names": names,
        "hazards": hazards,
        "suitability": suitability,
        "target_lat": str(lat_f),
        "target_lon": str(lon_f),
        "risk_radius_m": int(risk_radius_m),
        "analysis_source": f"LIVE_OSM:{source_endpoint.split('/')[2]}" if source_endpoint else "LIVE_OSM",
        "surface_class": "WATER" if is_water else (f"COASTAL_{density_class}" if is_coastal else density_class),
        "launch_grade": launch_grade,
        "launch_recommendation": launch_recommendation,
        "confidence": confidence,
        "primary_constraints": primary_constraints,
        "nearest_settlement_km": round(nearest_settlement, 1) if nearest_settlement is not None else None,
        "nearest_airport_km": round(nearest_airport, 1) if nearest_airport is not None else None,
        "nearest_water_km": round(nearest_water, 1) if nearest_water is not None else None,
        "site_buffer_km": round(site_buffer_km, 1) if site_buffer_km is not None else None,
    }


if __name__ == "__main__":
    print(get_topo_data())
