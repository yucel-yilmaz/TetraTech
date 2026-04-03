import math
import random

import requests
# .

OPENSKY_TIMEOUT = 4


def _format_flight(callsign, alt_text, distance_km, lat, lon, is_conflict, eta, status):
    return {
        "callsign": callsign,
        "alt": alt_text,
        "dist": f"{distance_km:.1f} km",
        "lat": lat,
        "lon": lon,
        "is_conflict": is_conflict,
        "eta_minutes": eta,
        "status": status,
    }


def _build_response(lat, lon, flights, has_conflict, max_wait, source, source_detail=None):
    count = sum(1 for flight in flights if flight.get("is_conflict"))
    status_message = "SISTEM NOMINAL - FIRLATMAYA UYGUN"
    if has_conflict:
        status_message = f"DIKKAT! HAVA SAHASI {max_wait} DK ICINDE TEMIZLENECEKTIR"

    notams = [
        {
            "id": f"A{random.randint(1000, 9999)}/26",
            "msg": "TRAFFIC MONITORING ACTIVE.",
            "severity": "BILGI",
        },
        {
            "id": f"N0{random.randint(100, 999)}/26",
            "msg": f"LAUNCH SECTOR REVIEW ACTIVE AT [{lat:.2f}, {lon:.2f}]",
            "severity": "KRITIK" if has_conflict else "BILGI",
        },
    ]

    response = {
        "status": source,
        "source": source,
        "source_detail": source_detail or "",
        "count": count,
        "is_airspace_clear": not has_conflict,
        "status_message": status_message,
        "wait_time": max_wait,
        "flights": flights,
        "notams": notams,
        "restricted_zones": [],
    }
    return response


def _fallback_radar(lat, lon, source_detail):
    seed_val = int(abs(lat * 1000) + abs(lon * 1000))
    seeded_random = random.Random(seed_val)

    flights = []
    has_conflict = False
    max_wait = 0

    for _ in range(3):
        distance_km = seeded_random.uniform(6, 28)
        is_conflict = distance_km < 11.5
        eta = seeded_random.randint(4, 14) if is_conflict else 0
        if is_conflict:
            has_conflict = True
            max_wait = max(max_wait, eta)

        flights.append(
            _format_flight(
                f"TTR{seeded_random.randint(100, 999)}",
                "32000 ft",
                distance_km,
                lat + seeded_random.uniform(-0.12, 0.12),
                lon + seeded_random.uniform(-0.12, 0.12),
                is_conflict,
                eta,
                "YEDEK-RADAR",
            )
        )

    return _build_response(lat, lon, flights, has_conflict, max_wait, "YEDEK RADAR", source_detail)


def get_notam_and_flights(lat, lon):
    """
    OpenSky uzerinden canli trafik dener; hata olursa her zaman yapisal olarak
    ayni formatta deterministic fallback doner.
    """
    lamin, lomin = lat - 0.5, lon - 0.5
    lamax, lomax = lat + 0.5, lon + 0.5
    url = f"https://opensky-network.org/api/states/all?lamin={lamin}&lomin={lomin}&lamax={lamax}&lomax={lomax}"

    try:
        response = requests.get(url, timeout=OPENSKY_TIMEOUT)
        flights = []
        has_conflict = False
        max_wait = 0

        if response.status_code == 200:
            data = response.json()
            states = data.get("states", [])

            for state in states[:10]:
                callsign = (state[1] or "").strip() or "BILINMIYOR"
                flight_lon = state[5]
                flight_lat = state[6]
                alt_val = state[7]

                if flight_lon is None or flight_lat is None:
                    continue

                distance_km = math.sqrt((flight_lat - lat) ** 2 + (flight_lon - lon) ** 2) * 111
                is_conflict = distance_km < 12.0
                eta = random.randint(3, 15) if is_conflict else 0

                if is_conflict:
                    has_conflict = True
                    max_wait = max(max_wait, eta)

                flights.append(
                    _format_flight(
                        callsign,
                        f"{int(alt_val)} m" if alt_val else "BILINMIYOR",
                        distance_km,
                        flight_lat,
                        flight_lon,
                        is_conflict,
                        eta,
                        "RISKLI" if is_conflict else "GUVENLI",
                    )
                )

            if flights:
                return _build_response(lat, lon, flights, has_conflict, max_wait, "CANLI RADAR (OPENSKY)")

            return _fallback_radar(lat, lon, "OPENSKY BOS DONDU")

        return _fallback_radar(lat, lon, f"HTTP {response.status_code}")
    except requests.RequestException as exc:
        return _fallback_radar(lat, lon, exc.__class__.__name__)
    except Exception as exc:
        return _fallback_radar(lat, lon, f"BEKLENMEYEN HATA: {exc.__class__.__name__}")
