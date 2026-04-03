import math

import requests
from geopy.geocoders import Nominatim

DEFAULT_WEATHER_TIMEOUT = 1.5
REVERSE_GEOCODE_TIMEOUT = 0.8

_GEOCODER = Nominatim(user_agent="tetratech_weather")

KNOWN_LOCATIONS = [
    {"name": "Gebze", "region": "Kocaeli", "country": "TR", "lat": 40.8028, "lon": 29.4307},
    {"name": "Istanbul", "region": "Istanbul", "country": "TR", "lat": 41.0082, "lon": 28.9784},
    {"name": "Bursa", "region": "Bursa", "country": "TR", "lat": 40.1885, "lon": 29.0610},
    {"name": "Izmit", "region": "Kocaeli", "country": "TR", "lat": 40.7654, "lon": 29.9408},
    {"name": "Ankara", "region": "Ankara", "country": "TR", "lat": 39.9334, "lon": 32.8597},
    {"name": "Izmir", "region": "Izmir", "country": "TR", "lat": 38.4237, "lon": 27.1428},
    {"name": "Antalya", "region": "Antalya", "country": "TR", "lat": 36.8969, "lon": 30.7133},
    {"name": "Kennedy Space Center", "region": "Florida", "country": "US", "lat": 28.5729, "lon": -80.6490},
    {"name": "Cape Canaveral", "region": "Florida", "country": "US", "lat": 28.3922, "lon": -80.6077},
    {"name": "Vandenberg", "region": "California", "country": "US", "lat": 34.7420, "lon": -120.5724},
    {"name": "Baikonur", "region": "Kyzylorda", "country": "KZ", "lat": 45.9646, "lon": 63.3052},
    {"name": "Kourou", "region": "French Guiana", "country": "GF", "lat": 5.2394, "lon": -52.7685},
    {"name": "Wenchang", "region": "Hainan", "country": "CN", "lat": 19.6144, "lon": 110.9511},
    {"name": "Sriharikota", "region": "Andhra Pradesh", "country": "IN", "lat": 13.7196, "lon": 80.2304},
]


def _haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _local_location_label(lat, lon):
    nearest = None
    nearest_distance = None
    for item in KNOWN_LOCATIONS:
        distance = _haversine_km(lat, lon, item["lat"], item["lon"])
        if nearest_distance is None or distance < nearest_distance:
            nearest = item
            nearest_distance = distance

    if nearest and nearest_distance is not None and nearest_distance <= 120:
        if nearest["name"].lower() == nearest["region"].lower():
            return nearest["name"]
        return f"{nearest['name']}, {nearest['region']}"

    return None


def _reverse_geocode_label(lat, lon):
    try:
        location = _GEOCODER.reverse(
            f"{lat}, {lon}",
            language="tr",
            timeout=REVERSE_GEOCODE_TIMEOUT,
            exactly_one=True,
            addressdetails=True,
        )
        if not location:
            return None

        address = getattr(location, "raw", {}).get("address", {})
        city_name = (
            address.get("city")
            or address.get("town")
            or address.get("municipality")
            or address.get("county")
            or address.get("state_district")
            or address.get("state")
        )
        region_name = address.get("state") or address.get("country")

        if city_name and region_name and city_name.lower() != region_name.lower():
            return f"{city_name}, {region_name}"
        if city_name:
            return city_name
    except Exception:
        return None

    return None


def _resolve_location_label(lat, lon, city=None):
    if city:
        return city

    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (TypeError, ValueError):
        return None

    local_label = _local_location_label(lat_f, lon_f)
    if local_label:
        return local_label

    reverse_label = _reverse_geocode_label(lat_f, lon_f)
    if reverse_label:
        return reverse_label

    return f"{lat_f:.4f}, {lon_f:.4f}"


def _build_fallback_weather(lat=40.2, lon=29.0, city=None, reason="OFFLINE"):
    """
    Return deterministic atmospheric values when the remote weather API is not
    reachable. This keeps the UI and simulator operational with numeric data.
    """
    try:
        lat_f = float(lat)
    except (TypeError, ValueError):
        lat_f = 40.2

    try:
        lon_f = float(lon)
    except (TypeError, ValueError):
        lon_f = 29.0

    temp = round(18 - abs(lat_f) * 0.08 + (abs(lon_f) % 7) * 0.35, 1)
    feels_like = round(temp - 0.7, 1)
    humidity = max(25, min(88, int(55 + (abs(lat_f) % 18) - (abs(lon_f) % 9))))
    pressure = max(985, min(1035, int(1013 - (abs(lat_f) % 11) + (abs(lon_f) % 6))))
    wind = round(max(1.2, min(14.5, 3.5 + (abs(lon_f) % 5) * 0.8 + (abs(lat_f) % 4) * 0.3)), 1)
    clouds = max(5, min(95, int((abs(lat_f * lon_f) % 70) + 10)))
    visibility = round(max(4.0, min(16.0, 12.0 - clouds / 15.0)), 1)
    label = _resolve_location_label(lat_f, lon_f, city)

    return {
        "city": label,
        "coord": f"{lat_f:.4f}, {lon_f:.4f}",
        "temp": f"{temp}",
        "feels_like": f"{feels_like}",
        "temp_min": f"{round(temp - 2.5, 1)}",
        "temp_max": f"{round(temp + 2.5, 1)}",
        "humidity": f"{humidity}",
        "pressure": f"{pressure}",
        "wind": f"{wind}",
        "clouds": f"{clouds}",
        "visibility": f"{visibility}",
        "desc": f"ATMOSFERIK YEDEK MODU ({reason})",
    }


def get_weather_data(lat=40.2, lon=29.0, city=None):
    api_key = "0b206b5f574fc02dba4ef9fda36e10f5"
    if not api_key:
        return _build_fallback_weather(lat, lon, city, "API KEY YOK")

    if city:
        url = (
            "https://api.openweathermap.org/data/2.5/weather"
            f"?q={city}&appid={api_key}&units=metric&lang=tr"
        )
    else:
        url = (
            "https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lon}&appid={api_key}&units=metric&lang=tr"
        )

    try:
        response = requests.get(url, timeout=DEFAULT_WEATHER_TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            coord = data.get("coord", {})
            city_name = data.get("name") or _resolve_location_label(lat, lon, city)
            country = data.get("sys", {}).get("country", "")

            return {
                "city": f"{city_name}, {country}".strip(", "),
                "coord": f"{coord.get('lat', '')}, {coord.get('lon', '')}",
                "temp": f"{data['main']['temp']}",
                "feels_like": f"{data['main']['feels_like']}",
                "temp_min": f"{data['main'].get('temp_min', '')}",
                "temp_max": f"{data['main'].get('temp_max', '')}",
                "humidity": f"{data['main']['humidity']}",
                "pressure": f"{data['main']['pressure']}",
                "wind": f"{data['wind']['speed']}",
                "clouds": f"{data.get('clouds', {}).get('all', 0)}",
                "visibility": f"{data.get('visibility', 0) / 1000}",
                "desc": (
                    data["weather"][0]["description"].upper()
                    if "weather" in data and data["weather"]
                    else "N/A"
                ),
            }

        return _build_fallback_weather(lat, lon, city, f"HTTP {response.status_code}")
    except requests.RequestException as exc:
        return _build_fallback_weather(lat, lon, city, exc.__class__.__name__)
    except Exception as exc:
        return _build_fallback_weather(lat, lon, city, f"BEKLENMEYEN HATA: {exc.__class__.__name__}")


if __name__ == "__main__":
    print(get_weather_data(city="Ankara"))
