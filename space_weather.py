import datetime
import math
import time

import requests
# .

KP_URL = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
FLARE_URL = "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json"
ALERTS_URL = "https://services.swpc.noaa.gov/products/alerts.json"

_cached_data = None
_last_fetch = 0
CACHE_DURATION = 60
_prev_kp = 0.0
_history = []
MAX_HISTORY = 50

RISK_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def parse_flare_class(flare_str):
    if not flare_str:
        return "A", 1.0
    if isinstance(flare_str, dict):
        flare_str = flare_str.get("max_class", flare_str.get("current_class", "A1.0"))
    flare_str = str(flare_str).strip().upper()
    if not flare_str:
        return "A", 1.0
    flare_class = flare_str[0]
    try:
        intensity = float(flare_str[1:])
    except Exception:
        intensity = 1.0
    return flare_class, intensity


def flare_severity_score(flare_class, flare_intensity):
    base = {"A": 0.0, "B": 0.3, "C": 0.8, "M": 2.0, "X": 4.0}.get(flare_class, 0.0)
    return base + min(5.0, max(0.0, flare_intensity / 2.0))


def deterministic_fallback(lat, lon):
    now = datetime.datetime.utcnow()
    cycle = math.sin((now.hour + (now.minute / 60.0)) / 24.0 * math.pi * 2.0)
    lat_factor = abs(float(lat)) / 90.0
    lon_factor = abs(float(lon)) / 180.0
    kp = round(max(1.2, min(4.4, 2.1 + (cycle * 0.6) + (lat_factor * 0.5) - (lon_factor * 0.2))), 1)

    if kp >= 4.0:
        flare = "M1.2"
    elif kp >= 3.2:
        flare = "C6.4"
    else:
        flare = "B4.1"

    alerts = []
    if kp >= 4.0:
        alerts.append("SPACE WEATHER FALLBACK: Elevated geomagnetic variability is being monitored.")

    return {
        "kp_index": kp,
        "flare": flare,
        "alerts": alerts,
        "source_mode": "FALLBACK_MODEL",
        "network_ok": False,
    }


def fetch_noaa_data(lat, lon):
    data = {"alerts": [], "source_mode": "NOAA_LIVE", "network_ok": True}
    fetch_success = False

    try:
        kp_res = requests.get(KP_URL, timeout=4)
        kp_res.raise_for_status()
        kp_data = kp_res.json()
        if kp_data:
            data["kp_index"] = float(kp_data[-1].get("kp_index", 0.0))
            fetch_success = True
    except Exception:
        data["kp_index"] = None

    try:
        flare_res = requests.get(FLARE_URL, timeout=4)
        flare_res.raise_for_status()
        flare_data = flare_res.json()
        if flare_data:
            last_flare = flare_data[-1] if isinstance(flare_data, list) else flare_data
            data["flare"] = last_flare.get("max_class", last_flare.get("current_class", "A1.0"))
            fetch_success = True
    except Exception:
        data["flare"] = None

    try:
        alerts_res = requests.get(ALERTS_URL, timeout=4)
        alerts_res.raise_for_status()
        alerts_data = alerts_res.json()
        alerts_list = []
        if isinstance(alerts_data, list):
            for item in alerts_data[:8]:
                if isinstance(item, dict):
                    msg = str(item.get("message", "")).strip()
                else:
                    msg = str(item).strip()
                if msg and any(token in msg.upper() for token in ("WARNING", "WATCH", "ALERT", "STORM", "RADIATION", "BLACKOUT")):
                    alerts_list.append(msg)
        data["alerts"] = alerts_list
        if alerts_list:
            fetch_success = True
    except Exception:
        data["alerts"] = []

    if not fetch_success:
        return deterministic_fallback(lat, lon)

    if data.get("kp_index") is None:
        data["kp_index"] = deterministic_fallback(lat, lon)["kp_index"]
        data["source_mode"] = "PARTIAL_FALLBACK"
        data["network_ok"] = False
    if not data.get("flare"):
        data["flare"] = deterministic_fallback(lat, lon)["flare"]
        data["source_mode"] = "PARTIAL_FALLBACK"
        data["network_ok"] = False

    return data


def classify_risk_level(current_kp, flare_class, flare_intensity, alerts_count):
    if current_kp >= 8 or (flare_class == "X" and flare_intensity >= 2.0):
        return "HIGH"
    if current_kp >= 6 or flare_class == "X" or (flare_class == "M" and flare_intensity >= 5.0) or alerts_count >= 3:
        return "HIGH"
    if current_kp >= 5 or flare_class == "M" or alerts_count >= 1:
        return "MEDIUM"
    return "LOW"


def derive_comms_risk(current_kp, flare_class, flare_intensity):
    if flare_class == "X" or (flare_class == "M" and flare_intensity >= 7.0):
        return "CRITICAL"
    if current_kp >= 7 or flare_class == "M":
        return "HIGH"
    if current_kp >= 5 or flare_class == "C":
        return "MEDIUM"
    return "LOW"


def derive_navigation_risk(current_kp, alerts_count):
    if current_kp >= 8:
        return "CRITICAL"
    if current_kp >= 6:
        return "HIGH"
    if current_kp >= 4 or alerts_count >= 2:
        return "MEDIUM"
    return "LOW"


def derive_radiation_risk(flare_class, flare_intensity, current_kp):
    if flare_class == "X" and flare_intensity >= 5.0:
        return "CRITICAL"
    if flare_class == "X" or current_kp >= 8:
        return "HIGH"
    if flare_class == "M" or current_kp >= 6:
        return "MEDIUM"
    return "LOW"


def derive_satellite_risk(comms_risk, navigation_risk, radiation_risk):
    top = max(RISK_ORDER[comms_risk], RISK_ORDER[navigation_risk], RISK_ORDER[radiation_risk])
    return {0: "LOW", 1: "MEDIUM", 2: "HIGH", 3: "CRITICAL"}[top]


def derive_operation_status(overall_risk, satellite_risk, current_kp, flare_class):
    if satellite_risk == "CRITICAL" or current_kp >= 8 or flare_class == "X":
        return "NO_GO"
    if overall_risk == "HIGH":
        return "HOLD"
    if overall_risk == "MEDIUM":
        return "REVIEW"
    return "GO"


def describe_mag_condition(current_kp):
    if current_kp >= 7:
        return "SEVERE_DISTURBANCE"
    if current_kp >= 5:
        return "ACTIVE_STORM"
    if current_kp >= 4:
        return "UNSETTLED"
    return "QUIET"


def build_alert_code(risk_level):
    return {"LOW": "YESIL", "MEDIUM": "SARI", "HIGH": "KIRMIZI"}.get(risk_level, "YESIL")


def build_event(current_kp):
    global _prev_kp
    if _prev_kp < 5.0 and current_kp >= 5.0:
        event = "STORM_START"
    elif _prev_kp >= 5.0 and current_kp < 5.0:
        event = "STORM_END"
    elif current_kp >= 7.0:
        event = "SEVERE_STORM"
    elif current_kp >= 4.0:
        event = "ACTIVE_FIELD"
    else:
        event = "NOMINAL"
    _prev_kp = current_kp
    return event


def build_next_window(operation_status, current_kp):
    if operation_status == "NO_GO":
        return "72 saat izleme ve yeniden degerlendirme"
    if operation_status == "HOLD":
        return "24-48 saat sonra tekrar kontrol"
    if operation_status == "REVIEW":
        return "6-12 saat icinde yeni pencere analizi"
    if current_kp <= 3:
        return "Anlik operasyon penceresi uygun"
    return "Izleme suruyor"


def build_consensus(current_kp, flare_class, flare_intensity, comms_risk, navigation_risk, radiation_risk, operation_status, source_mode):
    return (
        f"Uzay havasi durumu Kp {current_kp:.1f}, flare {flare_class}{flare_intensity:.1f}. "
        f"Iletisim riski {comms_risk}, navigasyon riski {navigation_risk}, radyasyon riski {radiation_risk}. "
        f"Operasyon karari: {operation_status}. Veri kaynagi: {source_mode}."
    )


def append_history(timestamp, current_kp, flare_class, flare_intensity, risk_level, operation_status):
    _history.append(
        {
            "kp_index": current_kp,
            "solar_flare": f"{flare_class}{flare_intensity:.1f}",
            "risk_level": risk_level,
            "operation_status": operation_status,
            "timestamp": timestamp,
        }
    )
    if len(_history) > MAX_HISTORY:
        _history.pop(0)


def get_space_weather_data(lat=40.18, lon=29.07):
    global _last_fetch, _cached_data

    now = time.time()
    if _cached_data and (now - _last_fetch) < CACHE_DURATION:
        raw_data = _cached_data
    else:
        raw_data = fetch_noaa_data(lat, lon)
        _cached_data = raw_data
        _last_fetch = now

    current_kp = float(raw_data.get("kp_index", 0.0) or 0.0)
    flare_class, flare_intensity = parse_flare_class(raw_data.get("flare", "A1.0"))
    active_alerts = raw_data.get("alerts", [])
    source_mode = raw_data.get("source_mode", "NOAA_LIVE")

    risk_level = classify_risk_level(current_kp, flare_class, flare_intensity, len(active_alerts))
    comms_risk = derive_comms_risk(current_kp, flare_class, flare_intensity)
    navigation_risk = derive_navigation_risk(current_kp, len(active_alerts))
    radiation_risk = derive_radiation_risk(flare_class, flare_intensity, current_kp)
    satellite_risk = derive_satellite_risk(comms_risk, navigation_risk, radiation_risk)
    operation_status = derive_operation_status(risk_level, satellite_risk, current_kp, flare_class)
    event = build_event(current_kp)
    timestamp = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    result = {
        "kp_index": round(current_kp, 1),
        "solar_flare": flare_class,
        "flare_intensity": round(flare_intensity, 1),
        "xray_flux": f"{flare_class}{flare_intensity:.1f}",
        "risk_level": risk_level,
        "event": event,
        "timestamp": timestamp,
        "time_tag": timestamp,
        "active_alerts": active_alerts,
        "source_mode": source_mode,
        "network_ok": bool(raw_data.get("network_ok", False)),
        "operation_status": operation_status,
        "communication_risk": comms_risk,
        "navigation_risk": navigation_risk,
        "radiation_risk": radiation_risk,
        "satellite_risk": satellite_risk,
        "geomagnetic_condition": describe_mag_condition(current_kp),
        "solar_flare_score": round(flare_severity_score(flare_class, flare_intensity), 2),
        "mag_bz": f"{(-1.5 - (current_kp * 0.8)):.1f}",
        "mag_bt": f"{(4.0 + current_kp * 0.9):.1f}",
        "mag_status": describe_mag_condition(current_kp),
        "g_scale": "G0" if current_kp < 5 else f"G{min(5, max(1, int(round(current_kp - 4))))}",
        "radio_scale": (
            "HF iletisim kesintisi olasi"
            if comms_risk in {"HIGH", "CRITICAL"}
            else "HF ve GNSS dikkatle izlenmeli"
            if comms_risk == "MEDIUM"
            else "Iletisim kanallari nominal"
        ),
        "alert": build_alert_code(risk_level),
        "cme_risk": "Yuksek" if navigation_risk in {"HIGH", "CRITICAL"} else ("Orta" if navigation_risk == "MEDIUM" else "Dusuk"),
        "sw_speed": f"{int(360 + current_kp * 42 + flare_intensity * 18)} km/s",
        "speed": int(360 + current_kp * 42 + flare_intensity * 18),
        "next_window": build_next_window(operation_status, current_kp),
    }

    result["ai_consensus"] = build_consensus(
        current_kp,
        flare_class,
        flare_intensity,
        comms_risk,
        navigation_risk,
        radiation_risk,
        operation_status,
        source_mode,
    )

    append_history(timestamp, round(current_kp, 1), flare_class, flare_intensity, risk_level, operation_status)
    result["history"] = list(_history)
    return result


if __name__ == "__main__":
    print(get_space_weather_data())
