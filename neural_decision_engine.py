import datetime
import os

import numpy as np


class TetraNeuralEngine:
    def __init__(self, input_size=12, hidden_size=16, output_size=1):
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.output_size = output_size

        self.W1 = np.random.randn(self.input_size, self.hidden_size) * np.sqrt(1.0 / self.input_size)
        self.b1 = np.zeros((1, self.hidden_size))
        self.W2 = np.random.randn(self.hidden_size, self.output_size) * np.sqrt(1.0 / self.hidden_size)
        self.b2 = np.zeros((1, self.output_size))

        self.model_path = os.path.join(os.path.dirname(__file__), "tetra_neural_weights.npz")
        self.is_trained = False

    def sigmoid(self, x):
        return 1 / (1 + np.exp(-x))

    def sigmoid_derivative(self, x):
        return x * (1 - x)

    def generate_synthetic_data(self, samples=50000):
        x_values = []
        y_values = []

        for _ in range(samples):
            wind = np.random.uniform(0, 35)
            temp = np.random.uniform(-10, 45)
            humidity = np.random.uniform(10, 100)
            visibility = np.random.uniform(0.1, 20)
            altitude = np.random.uniform(-10, 3000)
            civil_penalty = np.random.choice([0, 20, 50, 100])
            kp = np.random.uniform(0, 9)
            thrust = np.random.uniform(10, 30000)
            mass = np.random.uniform(1000, 2000000)
            tolerance = np.random.uniform(5, 20)
            efficiency = np.random.uniform(0.5, 1.0)
            hour = np.random.randint(0, 24)

            score = 100.0
            if wind > tolerance:
                score -= (wind - tolerance) * 10.0
            if wind > tolerance * 1.5:
                score -= 50
            if kp >= 5:
                score -= (kp - 4) * 15.0
            if kp >= 7:
                score -= 40
            if visibility < 2.0:
                score -= 30
            if altitude <= 0:
                score = 0
            if altitude > 2000 and np.random.random() > 0.6:
                score -= 40
            if civil_penalty >= 80:
                score -= 70
            if humidity > 85:
                score -= 15

            target = 1.0 if score >= 70 else (0.5 if score >= 45 else 0.0)
            input_vec = [
                wind / 35,
                (temp + 10) / 55,
                humidity / 100,
                visibility / 20,
                altitude / 3000,
                civil_penalty / 100,
                kp / 9,
                thrust / 30000,
                mass / 2000000,
                tolerance / 20,
                efficiency,
                hour / 24,
            ]
            x_values.append(input_vec)
            y_values.append([target])

        return np.array(x_values), np.array(y_values)

    def train(self, epochs=5000, lr=0.1):
        x_values, y_values = self.generate_synthetic_data()
        for _ in range(epochs):
            layer1 = self.sigmoid(np.dot(x_values, self.W1) + self.b1)
            output = self.sigmoid(np.dot(layer1, self.W2) + self.b2)

            error = y_values - output
            d_output = error * self.sigmoid_derivative(output)
            error_hidden = d_output.dot(self.W2.T)
            d_hidden = error_hidden * self.sigmoid_derivative(layer1)

            self.W2 += layer1.T.dot(d_output) * lr / len(x_values)
            self.b2 += np.sum(d_output, axis=0, keepdims=True) * lr / len(x_values)
            self.W1 += x_values.T.dot(d_hidden) * lr / len(x_values)
            self.b1 += np.sum(d_hidden, axis=0, keepdims=True) * lr / len(x_values)

        np.savez(self.model_path, W1=self.W1, b1=self.b1, W2=self.W2, b2=self.b2)
        self.is_trained = True

    def load_model(self):
        if os.path.exists(self.model_path):
            data = np.load(self.model_path)
            self.W1 = data["W1"]
            self.b1 = data["b1"]
            self.W2 = data["W2"]
            self.b2 = data["b2"]
            self.is_trained = True
            return True
        return False

    def _safe_float(self, val, div=1.0):
        if val is None or str(val).strip() in {"", "-"}:
            return 0.0
        try:
            clean_val = str(val).replace(",", "").replace(" ", "").split("k")[0].split("m")[0]
            return float(clean_val) / div
        except Exception:
            return 0.0

    def _add_risk(self, risks, risk_type, level, msg):
        if any(r["type"] == risk_type and r["msg"] == msg for r in risks):
            return
        risks.append({"type": risk_type, "level": level, "msg": msg})

    def _has_any(self, text, keywords):
        upper_text = str(text or "").upper()
        return any(keyword in upper_text for keyword in keywords)

    def _risk_rank(self, value):
        return {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}.get(str(value or "").upper(), 0)

    def predict_score(self, weather, topo, space, rocket, time_str="", approved_launch_site=False, land_detected=False):
        if not self.is_trained:
            self.load_model()

        hour = int(time_str.split(":")[0]) if ":" in time_str else datetime.datetime.now().hour

        current_elevation = self._safe_float(topo.get("elevation", 0))
        topo_score = max(0.0, min(100.0, self._safe_float(topo.get("score", 70))))
        wind_speed = self._safe_float(weather.get("wind"))
        temp = self._safe_float(weather.get("temp"))
        humidity = self._safe_float(weather.get("humidity"))
        visibility = self._safe_float(weather.get("visibility", 10))
        kp_index = self._safe_float(space.get("kp_index"))
        rocket_tol = max(1.0, self._safe_float(rocket.get("tol", 15)))
        weather_desc = str(weather.get("desc", ""))

        suitability = str(topo.get("suitability", ""))
        terrain_info = str(topo.get("terrain_info", ""))
        civ_risk = str(topo.get("civ_risk", ""))

        comms_risk = str(space.get("communication_risk", "LOW")).upper()
        navigation_risk = str(space.get("navigation_risk", "LOW")).upper()
        radiation_risk = str(space.get("radiation_risk", "LOW")).upper()
        satellite_risk = str(space.get("satellite_risk", "LOW")).upper()
        operation_status = str(space.get("operation_status", "GO")).upper()
        source_mode = str(space.get("source_mode", "UNKNOWN")).upper()
        active_alerts = space.get("active_alerts", []) or []

        topo_data_unavailable = (
            self._has_any(suitability, ["HATA", "YUKLENEMEDI"])
            or self._has_any(terrain_info, ["HATALI VERI"])
            or self._has_any(civ_risk, ["FAILSAFE"])
        )
        explicit_water_risk = self._has_any(suitability, ["SU", "OKYANUS", "DENIZ"]) or self._has_any(
            terrain_info, ["SU KUTLESI", "OKYANUS", "DENIZ"]
        )
        urban_block = self._has_any(suitability, ["METROPOL", "KRITIK IHLAL"]) or self._has_any(
            civ_risk, ["SEHIR MERKEZI", "YUKSEK IHLAL"]
        )
        harsh_terrain = self._has_any(suitability, ["TEKNIK RED"]) or self._has_any(
            terrain_info, ["ASIRI DAGLIK", "DAGLIK", "SARP"]
        )

        learned_score = None
        if self.is_trained:
            input_vec = np.array(
                [[
                    self._safe_float(weather.get("wind"), 35),
                    (temp + 10) / 55,
                    self._safe_float(weather.get("humidity"), 100),
                    self._safe_float(weather.get("visibility", 10), 20),
                    self._safe_float(current_elevation, 3000),
                    (100.0 - topo_score) / 100.0,
                    self._safe_float(space.get("kp_index"), 9),
                    self._safe_float(rocket.get("thrust"), 30000),
                    self._safe_float(rocket.get("mass"), 2000000),
                    self._safe_float(rocket.get("tol", 15), 20),
                    self._safe_float(rocket.get("efficiency", 0.8), 1.0),
                    hour / 24,
                ]]
            )
            layer1 = self.sigmoid(np.dot(input_vec, self.W1) + self.b1)
            learned_prob = self.sigmoid(np.dot(layer1, self.W2) + self.b2)[0][0]
            learned_score = float(min(100, max(0, learned_prob * 100)))

        rule_score = 100.0
        risks = []
        severe_weather = False
        moderate_weather = False

        if wind_speed > rocket_tol:
            penalty = min(45.0, (wind_speed - rocket_tol) * 5.0 + 12.0)
            rule_score -= penalty
            severe_weather = True
            self._add_risk(
                risks,
                "Aerodinamik Kararsizlik",
                "KRITIK" if penalty >= 25 else "YUKSEK",
                f"Ruzgar hizi ({wind_speed:.1f} m/s) arac limitini ({rocket_tol:.1f} m/s) asiyor.",
            )
        elif wind_speed > rocket_tol * 0.85:
            rule_score -= 8
            moderate_weather = True
            self._add_risk(risks, "Yuksek Ruzgar Yuklenmesi", "DIKKAT", f"Ruzgar limiti sinira yakin ({wind_speed:.1f} m/s).")

        if visibility < 2.0:
            rule_score -= 25
            severe_weather = True
            self._add_risk(risks, "Gorus Kisiti", "YUKSEK", f"Gorus mesafesi cok dusuk ({visibility:.1f} km).")
        elif visibility < 5.0:
            rule_score -= 10
            moderate_weather = True

        if humidity > 90:
            rule_score -= 8
            moderate_weather = True
            self._add_risk(risks, "Atmosferik Nem", "ORTA", f"Nem seviyesi yuksek (%{humidity:.0f}).")

        if temp <= -15 or temp >= 42:
            rule_score -= 12
            moderate_weather = True
            self._add_risk(risks, "Ekstrem Sicaklik", "ORTA", f"Atmosferik sicaklik operasyon limiti icin zorlu ({temp:.1f} C).")

        if self._has_any(weather_desc, ["FIRTINA", "THUNDER", "STORM", "SIMSEK", "SAGANAK", "TORNADO"]):
            rule_score -= 40
            severe_weather = True
            self._add_risk(risks, "Siddetli Hava Olayi", "KRITIK", f"Tehlikeli hava kosulu tespit edildi: {weather_desc}.")
        elif self._has_any(weather_desc, ["YAGMUR", "RAIN", "KAR", "SNOW", "DOLU", "HAIL", "SIS", "FOG"]):
            rule_score -= 18
            moderate_weather = True
            self._add_risk(risks, "Olumsuz Hava Kosulu", "YUKSEK", f"Hava durumu operasyonu zorlastiriyor: {weather_desc}.")

        if kp_index >= 5:
            penalty = min(35.0, (kp_index - 4.0) * 12.0)
            rule_score -= penalty
            severe_weather = True
            self._add_risk(
                risks,
                "Manyetik Radyasyon",
                "KRITIK" if kp_index >= 7 else "YUKSEK",
                f"Jeomanyetik aktivite yuksek (Kp {kp_index:.1f}).",
            )
        elif kp_index >= 4:
            rule_score -= 8
            moderate_weather = True

        if operation_status == "NO_GO":
            rule_score -= 30
            severe_weather = True
            self._add_risk(risks, "Uzay Hava Blokaji", "KRITIK", "Uzay hava katmani firlatma icin NO_GO durumunda.")
        elif operation_status == "HOLD":
            rule_score -= 20
            severe_weather = True
            self._add_risk(risks, "Uzay Hava Bekletmesi", "YUKSEK", "Uzay hava kosullari operasyonu bekletme moduna aliyor.")
        elif operation_status == "REVIEW":
            rule_score -= 10
            moderate_weather = True
            self._add_risk(risks, "Uzay Hava Incelemesi", "DIKKAT", "Uzay hava kosullari yeniden degerlendirme gerektiriyor.")

        if self._risk_rank(comms_risk) >= 3:
            rule_score -= 16
            severe_weather = True
            self._add_risk(risks, "Iletisim Kesintisi Riski", "KRITIK", "HF ve komuta baglantisinda kesinti olasiligi yuksek.")
        elif self._risk_rank(comms_risk) == 2:
            rule_score -= 10
            moderate_weather = True
            self._add_risk(risks, "Iletisim Bozulmasi", "YUKSEK", "Uzay havasi kaynakli iletisim dalgalanmasi bekleniyor.")
        elif self._risk_rank(comms_risk) == 1:
            rule_score -= 4

        if self._risk_rank(navigation_risk) >= 3:
            rule_score -= 15
            severe_weather = True
            self._add_risk(risks, "Navigasyon Kaymasi", "KRITIK", "GNSS ve yon bulma katmaninda ciddi bozulma riski var.")
        elif self._risk_rank(navigation_risk) == 2:
            rule_score -= 9
            moderate_weather = True
            self._add_risk(risks, "Navigasyon Riski", "YUKSEK", "Uzay havasi sebebiyle rotalama ve takip hatasi artabilir.")
        elif self._risk_rank(navigation_risk) == 1:
            rule_score -= 4

        if self._risk_rank(radiation_risk) >= 3:
            rule_score -= 18
            severe_weather = True
            self._add_risk(risks, "Radyasyon Yuklenmesi", "KRITIK", "Elektronikler ve hassas aviyonik icin kritik radyasyon riski bulunuyor.")
        elif self._risk_rank(radiation_risk) == 2:
            rule_score -= 11
            moderate_weather = True
            self._add_risk(risks, "Radyasyon Riski", "YUKSEK", "Aviyonik ve faydali yuk icin artmis radyasyon riski tespit edildi.")
        elif self._risk_rank(radiation_risk) == 1:
            rule_score -= 5

        if self._risk_rank(satellite_risk) >= 2:
            self._add_risk(risks, "Yuksek Yatay Sistem Riski", "YUKSEK" if self._risk_rank(satellite_risk) == 2 else "KRITIK", "Uydu, telemetri ve takip alt sistemlerinde bozucu etki bekleniyor.")

        if len(active_alerts) >= 3:
            rule_score -= 8
            moderate_weather = True
            self._add_risk(risks, "NOAA Uyari Yogunlugu", "DIKKAT", f"Aktif uzay hava uyarisi sayisi yuksek ({len(active_alerts)}).")
        elif len(active_alerts) >= 1:
            rule_score -= 3

        if approved_launch_site:
            rule_score += 12
        elif topo_data_unavailable:
            rule_score -= 6
            self._add_risk(risks, "Topo Veri Eksigi", "DIKKAT", "Arazi verisi tam cekilemedi; karar kisitli veriyle uretildi.")
        elif explicit_water_risk and not land_detected:
            rule_score -= 70
            self._add_risk(risks, "Cografi Imkansizlik", "KRITIK", "Secilen noktada karasal firlatma platformu tespit edilemedi.")
        elif urban_block:
            rule_score -= 55
            self._add_risk(risks, "Sivil Yerlesim Riski", "KRITIK", "Yogun yerlesim nedeniyle firlatma koridoru uygun degil.")
        elif harsh_terrain:
            rule_score -= 30
            self._add_risk(risks, "Arazi Engeli", "YUKSEK", "Arazi kosullari operasyonu zorlastiriyor.")
        else:
            rule_score -= max(0.0, (70.0 - topo_score) * 0.45)
            if topo_score >= 85:
                rule_score += 6

        if temp < -20 or temp > 45:
            rule_score -= 10

        if self._safe_float(rocket.get("thrust")) <= 0:
            rule_score -= 60
            self._add_risk(risks, "Itki Yetersizligi", "KRITIK", "Secilen arac aktif firlatma itkisina sahip gorunmuyor.")

        if approved_launch_site and topo_data_unavailable:
            rule_score = max(rule_score, 80 if moderate_weather else 84)

        if approved_launch_site:
            self._add_risk(risks, "Onayli Saha Onayi", "GUVENLI", "Gorev resmi firlatma ussu uzerinden planlaniyor. Cografi uygunluk onaylandi.")

        score_source = rule_score if learned_score is None else (rule_score * 0.85 + learned_score * 0.15)
        score = int(max(0, min(100, round(score_source))))

        if approved_launch_site and severe_weather:
            score = min(score, 58)
        elif approved_launch_site and moderate_weather:
            score = min(score, 78)
        elif approved_launch_site and not risks:
            score = min(score, 96)

        status = "UYGUN"
        decision = "TETRA ASSISTANT ONAYI: GOREV ONAYLANDI"
        if score < 45:
            status = "IPTAL"
            decision = "TETRA ASSISTANT KARARI: GOREV REDDEDILDI"
        elif score < 75:
            status = "BEKLEME"
            decision = "TETRA ASSISTANT KARARI: GOREV BEKLEMEYE ALINDI"

        if approved_launch_site and score < 80 and not severe_weather and not moderate_weather and kp_index < 5 and wind_speed <= rocket_tol:
            score = max(score, 84)
            status = "UYGUN"
            decision = "TETRA ASSISTANT ONAYI: GOREV ONAYLANDI"

        confidence_base = 90
        if topo_data_unavailable:
            confidence_base -= 4
        if learned_score is not None:
            confidence_base += 3
        if source_mode != "NOAA_LIVE":
            confidence_base -= 3
        if len(active_alerts) >= 1:
            confidence_base += 1
        confidence_base += 4 if status in {"UYGUN", "IPTAL"} else 2

        return {
            "score": score,
            "status": status,
            "decision": decision,
            "risks": risks,
            "ai_engine": "Tetra Assistant V1.2 [SPACE-WEATHER-ENHANCED]",
            "confidence": f"%{int(max(80, min(99, confidence_base)))}",
        }


neural_engine = TetraNeuralEngine()


if __name__ == "__main__":
    result = neural_engine.predict_score(
        {"wind": 10, "temp": 20, "humidity": 50, "visibility": 10},
        {"elevation": 500, "score": 90, "suitability": "STRATEJIK"},
        {"kp_index": 2, "communication_risk": "LOW", "navigation_risk": "LOW", "radiation_risk": "LOW", "operation_status": "GO"},
        {"thrust": 16000, "mass": 800000, "tol": 15, "efficiency": 0.9},
    )
    print(result)
