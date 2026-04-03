import math
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

G_SEA = 9.80665
R_EARTH = 6371000
DT = 0.016666  # ~60 FPS fizik motoru iterasyon aralığı

def gravity_at(alt):
    """BÖLÜM 1: Inverse Square Law Yerçekimi"""
    return G_SEA * (R_EARTH / (R_EARTH + max(0, alt))) ** 2

def atmosphere_at(alt):
    """BÖLÜM 1: Üstel Atmosfer Modeli (ISA) -> Yoğunluk, Basınç, Ses Hızı"""
    if alt < 11000:
        T = 288.15 - 0.0065 * alt
        P = 101325 * (T / 288.15) ** 5.25588
    elif alt < 20000:
        T = 216.65
        P = 22632 * math.exp(-G_SEA * (alt - 11000) / (287.052 * 216.65))
    elif alt < 32000:
        T = 216.65 + 0.001 * (alt - 20000)
        P = 5474.8 * (T / 216.65) ** (-34.16319)
    else:
        T = 228.65 + 0.0028 * max(0, alt - 32000)
        P = 868 * math.exp(-(alt - 32000) / 7000)

    if alt > 100000:
        return 0.0, 0.0, 300.0  # Uzay

    rho = P / (287.052 * T)
    a = math.sqrt(1.4 * 287.052 * T)
    return rho, P, a

def transonic_drag_multiplier(mach):
    """Transonik sürtünme artışı (Chaos)"""
    if mach < 0.8: return 1.0
    elif mach < 1.05: return 1.0 + 2.5 * ((mach - 0.8) / 0.25)
    elif mach < 1.3: return 3.5 - 1.0 * ((mach - 1.05) / 0.25)
    elif mach < 5.0: return max(1.5, 2.5 - 1.0 * ((mach - 1.3) / 3.7))
    else: return 1.5

class SimulatorHandler(BaseHTTPRequestHandler):
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
        
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
        
    def do_POST(self):
        if self.path == '/simulate':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            params = json.loads(post_data.decode('utf-8'))

            # Kullanıcının oluşturduğu tüm kademeler (parts) listesi
            parts = params.get('parts', [])
            wind_speed = float(params.get('windSpeed', 3) or 3)
            
            # Tüm parçaların mevcut yakıtlarını ayarla
            total_initial_mass = 0.0
            for p in parts:
                p['current_fuel'] = float(p.get('fuelMass', 0))
                total_initial_mass += float(p.get('dryMass', 0)) + p['current_fuel']
            
            payload_mass = float(parts[-1].get('dryMass', 0)) if parts and parts[-1].get('type') == 'payload' else 0

            # MÜHENDİSLİK KURALLARI (fizik.txt)
            DT = 0.1 # Zaman Adımı
            G_SEA = 9.80665
            R_EARTH = 6371000.0 # Dünya yarıçapı (metre)
            
            alt = 0.0
            vel_y = 0.0
            x = 0.0
            vel_x = 0.0
            t = 0.0
            
            active_index = 0
            active_parts = list(parts)
            falling_objects = []
            events = [{'time': 0, 'msg': 'ATEŞLEME — Başlangıç kademesi çalıştırıldı. Kalkış!'}]
            trajectory = []
            kademeler_log = []
            uyarilar = []
            
            max_alt = 0.0
            max_vel = 0.0
            max_acc = 0.0
            max_q_val = 0.0 # Max-Q tracking
            
            phase = 'IGNITION'
            
            # Çevre Faktörleri (API / Kullanıcı)
            wind_speed = float(params.get('windSpeed', 3.0))
            base_temp_c = float(params.get('temperature', 15.0))
            base_temp_k = base_temp_c + 273.15
            base_press_pa = float(params.get('pressure', 1013.25)) * 100.0
            
            # Bitiş şartları için
            time_since_all_separated = 0.0
            all_separated = False
            sim_ended = False
            
            # Ayrılma süreci kontrolü
            is_separating = False
            sep_timer = 0.0
            
            while t < 1000.0 and not sim_ended:  # Master Limit 1000s
                if active_index >= len(parts):
                    break
                
                # KRİTİK: KALKIŞ BAŞARISIZ KONTROLÜ
                if t > 5.0 and alt < 1.0 and phase == 'IGNITION':
                    events.append({'time': t, 'msg': "KRİTİK HATA: İtki yetersiz! Roket rampadan kalkamadı."})
                    uyarilar.append("KALKIŞ BAŞARISIZ — Roket kütlesi itki kapasitesinden fazla.")
                    sim_ended = True
                    break

                cap = parts[active_index]
                F_itki = 0.0
                
                # 1. KADEME AYRILMASI - GELİŞMİŞ SÜREÇ (Smooth Transition)
                sep_alt = float(cap.get('sepAlt', 1000000))
                
                # Ayrılma tetikleme
                if not is_separating and alt >= sep_alt and len(active_parts) > 1:
                    is_separating = True
                    sep_timer = 0.0
                    events.append({'time': t, 'msg': f"MEKANİZMA AKTİF: {cap.get('name')} kilidi açıldı."})

                # Ayrılma animasyonu/süreci (neredeyse anlık)
                if is_separating:
                    sep_timer += DT
                    if sep_timer >= 0.1:
                        # TAM AYRILMA GERÇEKLEŞTİ
                        is_separating = False
                        
                        msg = f"AYRILMA: {cap.get('name')} ana gövdeden ayrıldı."
                        events.append({'time': t, 'msg': msg})
                        uyarilar.append(msg)
                        
                        kademeler_log.append({
                            'kademe_no': active_index + 1,
                            'ayrilma_zamani_s': round(t, 2),
                            'ayrilma_irtifasi_m': round(alt, 2),
                            'ayrilma_hizi_ms': round(math.sqrt(vel_y**2 + vel_x**2), 2),
                            'delta_v_ms': round(vel_y, 2)
                        })
                        
                        # Artık bağımsız balistik cisim - YUMUŞAK AYRILMA
                        # ANAHTAR FİZİK: Parça roketten nerdeyse aynı hızla çıkar,
                        # çok hafif bir aşağı itki (-0.3 m/s) ile yavaşça ayrılır.
                        # Bu sayede parça birkaç saniye roketin yanında "süzülür"
                        # ve sonra yavaş yavaş yerçekimi etkisiyle aşağı düşmeye başlar.
                        falling_objects.append({
                            'id': cap.get('id', f'kademe_{active_index}'),
                            'name': cap.get('name', 'Kademe'),
                            'mass': float(cap.get('dryMass', 50)) + cap.get('current_fuel', 0),
                            'cd': 2.5, # Gerçekçi Cd: Çok yüksek olmasın ki yavaş düşsün
                            'area': math.pi * (float(cap.get('diameter', 0.1))/2.0)**2 * 3.0,
                            'x': x, 
                            'y': alt,  # Aynı irtifadan başla
                            'vx': vel_x * 0.995, 
                            'vy': vel_y * 0.995 - 0.3, # Çok hafif bir kopuş: neredeyse aynı hız
                            'rot': 0, 'rot_v': 0.02, # Yavaş dönüş (soft ayrılma hissi)
                            'landed': False,
                            'sep_time': t  # Ayrılma zamanını kaydet (drift fazı için)
                        })
                        
                        cap['current_fuel'] = 0 
                        active_index += 1
                        active_parts = parts[active_index:]
                        cap = parts[active_index]
                        
                        if len(active_parts) == 1: 
                            all_separated = True
                    else:
                        # Süreç devam ederken (0.0 - 1.0s) motor itişi zaten 113. satır sonrası F_itki kontrolünde 
                        # aktif parçadan (üst kademe) geleceği için burada ek bir şey yapmaya gerek yok.
                        pass

                # Toplam güncel kütle
                current_mass = sum(float(p.get('dryMass', 0)) + float(p.get('current_fuel', 0)) for p in active_parts)

                # Yanma & İtki & Yakıt Tüketimi (m_dot)
                if cap.get('type') == 'motor':
                    if cap['current_fuel'] > 0:
                        # Gerçek itki verisi (N)
                        F_itki = float(cap.get('thrust', 0))
                        burn_t = float(cap.get('burnTime', 1))
                        if burn_t <= 0: burn_t = 0.1
                        
                        # m_dot: Yakıt akış hızı (kg/s)
                        m_dot = float(cap.get('fuelMass', 0)) / burn_t
                        
                        cap['current_fuel'] -= m_dot * DT
                        if cap['current_fuel'] <= 0: 
                            cap['current_fuel'] = 0
                            events.append({'time': t, 'msg': f"MECO: {cap.get('name')} yakıtı tükendi! Balistik tırmanış başladı."})
                            
                        phase = 'IGNITION'
                    else:
                        # Yakıt bitti ama irtifa artıyor -> Süzülme (Coast)
                        phase = 'COAST' if vel_y > 0 else 'DESCENT'
                else:
                    # Payload (Uydu/Kapsül) fazı
                    phase = 'COAST' if vel_y > 0 else 'DESCENT'
                    if alt > 150000 and abs(vel_y) < 50:
                        phase = 'STABLE_ORBIT' # Yörünge stabilitesi (Görsel amaçlı)

                        
                # 4. HAVA YOĞUNLUĞU VE SES HIZI (GERÇEK ZAMANLI VERİLİ DİNAMİK MODEL)
                # İdeal gaz yasası (P = rho * R * T) ve Barometrik Formül üzerinden hesaplanır.
                current_temp_k = base_temp_k - 0.0065 * alt if alt < 11000 else base_temp_k - 71.5
                current_press = base_press_pa * math.exp(-G_SEA * alt / (287.05 * base_temp_k))
                rho = current_press / (287.05 * current_temp_k) if current_temp_k > 0 else 0
                sonic_speed = math.sqrt(1.4 * 287.05 * current_temp_k) if current_temp_k > 0 else 300
                
                # 5. HIZ VE MACH SAYISI
                v = math.sqrt(vel_y**2 + vel_x**2)
                mach = v / sonic_speed if sonic_speed > 0 else 0
                
                # 6. MACH BAĞIMLI Cd GÜNCELLEMESİ (Drag Divergence)
                base_cd = float(cap.get('cd', 0.4))
                if mach < 0.8:
                    current_cd = base_cd
                elif 0.8 <= mach < 1.0:
                    current_cd = base_cd * (1 + (mach - 0.8) * 10)
                elif 1.0 <= mach < 1.2:
                    current_cd = base_cd * 3.5
                else:
                    current_cd = base_cd * (1.5 + 0.5/mach)
                
                # 7. SÜRÜKLEME KUVVETİ (Dinamik Basınç q)
                current_dia = float(cap.get('diameter', 0.15))
                A = math.pi * (current_dia / 2.0)**2
                q_press = 0.5 * rho * (v**2) # Dinamik basınç
                max_q_val = max(max_q_val, q_press)
                F_drag = q_press * current_cd * A
                
                # 8. İRTİFAYA BAĞLI YERÇEKİMİ (Ters Kare Yasası)
                current_g = G_SEA * (R_EARTH / (R_EARTH + alt))**2
                F_gravity = current_mass * current_g
                
                # 9. RÜZGAR VE VEKTÖREL SÜRÜKLEME
                v_rel_x = vel_x - wind_speed
                v_rel_y = vel_y
                v_rel = math.sqrt(v_rel_x**2 + v_rel_y**2)
                
                if v_rel > 0:
                    drag_y = F_drag * (v_rel_y / v_rel)
                    drag_x = F_drag * (v_rel_x / v_rel)
                else:
                    drag_y = 0; drag_x = 0

                net_F_y = F_itki - drag_y - F_gravity
                net_F_x = -drag_x 
                
                # 10. EULER ENTEGRASYONU
                if alt <= 0 and net_F_y <= 0 and phase == 'IGNITION':
                    net_F_y = 0; vel_y = 0; alt = 0
                    
                acc_y = net_F_y / current_mass if current_mass > 0 else 0
                acc_x = net_F_x / current_mass if current_mass > 0 else 0
                
                vel_y += acc_y * DT
                vel_x += acc_x * DT
                alt += vel_y * DT
                x += vel_x * DT
                
                # ÇARPMA TESPİTİ: Roket yere çakıldı mı?
                if alt <= 0 and t > 1.0 and vel_y < -5.0:
                    alt = 0
                    impact_speed = abs(vel_y)
                    phase = 'CRASH'
                    events.append({'time': t, 'msg': f"💥 ÇARPMA! Roket {impact_speed:.1f} m/s hızla yere çakıldı!"})
                    uyarilar.append(f"SİMÜLASYON BAŞARISIZ — Roket {impact_speed:.1f} m/s ile yere çarparak imha oldu.")
                    sim_ended = True
                elif alt < 0:
                    alt = 0
                    vel_y = 0
                
                # Çıktı Kaydı
                mach = v / 343.0
                total_fuel_remaining = sum(p.get('current_fuel', 0) for p in parts)
                
                # 11. DÜŞEN PARÇA FİZİĞİ - YUMUŞAK AYRILMA + SÜZÜLME + DÜŞÜŞ
                falling_out = []
                for fo in falling_objects:
                    if fo['y'] <= 0 and not fo['landed']:
                        fo['y'] = 0; fo['vy'] = 0; fo['vx'] = 0; fo['rot_v'] = 0; fo['landed'] = True
                        events.append({'time': t, 'msg': f"KADEME İNİŞİ: {fo['name']} yere ({fo['x']:.1f}m) düştü."})
                    
                    if not fo['landed']:
                        rho_f = (base_press_pa * math.exp(-G_SEA * fo['y'] / (287.05 * base_temp_k))) / (287.05 * (base_temp_k - 0.0065 * fo['y'] if fo['y'] < 11000 else base_temp_k - 71.5))
                        vf = math.sqrt(fo['vx']**2 + fo['vy']**2)
                        
                        # ═══ DRİFT FAZI: Ayrılma sonrası ilk 3 saniye ═══
                        # Parça roketin yanında süzülür, yavaşça uzaklaşır
                        sep_elapsed = t - fo.get('sep_time', t)
                        
                        if sep_elapsed < 3.0:
                            # Drift fazı: Çok az yerçekimi etkisi, parça neredeyse asılı
                            drift_factor = sep_elapsed / 3.0  # 0 → 1 arası (yavaş artış)
                            effective_gravity = fo['mass'] * G_SEA * (R_EARTH / (R_EARTH + fo['y']))**2 * drift_factor * 0.3
                            
                            # Dönme de yavaş yavaş artar
                            fo['rot_v'] += 0.005 * drift_factor
                            
                            # Çok hafif sürükleme (havada süzülme hissi)
                            drag_f = 0.5 * rho_f * (vf**2) * fo['cd'] * fo['area'] * 0.2
                            if vf > 0:
                                fdy = drag_f * (fo['vy']/vf)
                                fdx = drag_f * (fo['vx']/vf)
                            else:
                                fdy, fdx = 0, 0
                            
                            f_net_y = -effective_gravity - fdy
                            f_net_x = -fdx
                        else:
                            # ═══ DÜŞÜŞ FAZI: Normal fizik devreye girer ═══
                            # Ama yine de soft: aerodinamik sönümleme aktif
                            
                            # Hava yoğunluğu arttıkça takla yavaşlar
                            fo['rot_v'] *= (1.0 - 0.05 * rho_f)
                            
                            drag_f = 0.5 * rho_f * (vf**2) * fo['cd'] * fo['area']
                            if vf > 0:
                                fdy = drag_f * (fo['vy']/vf)
                                fdx = drag_f * (fo['vx']/vf)
                            else:
                                fdy, fdx = 0, 0
                            
                            gravity_f = fo['mass'] * G_SEA * (R_EARTH / (R_EARTH + fo['y']))**2
                            
                            f_net_y = -gravity_f - fdy
                            f_net_x = -fdx
                        
                        # İvme ve hız güncelleme
                        fo['vy'] += (f_net_y / fo['mass']) * DT
                        fo['vx'] += (f_net_x / fo['mass']) * DT

                        fo['y'] += fo['vy'] * DT
                        fo['x'] += fo['vx'] * DT
                        fo['rot'] += fo['rot_v'] * DT
                    falling_out.append(dict(fo))
                
                # SUPERSET JSON ÇIKTISI (Fizik promptu GEREKLİNİMLERİ + React UI GEREKSİNİMLERİ)
                frame = {
                    # Prompt Gereksinimi
                    't_s': round(t, 2),
                    'irtifa_m': round(alt, 2),
                    'dikey_hiz_ms': round(vel_y, 2),
                    'yatay_hiz_ms': round(vel_x, 2),
                    'ivme_ms2': round(acc_y, 2),
                    'aktif_kademe': active_index + 1,
                    
                    # RocketCanvas.jsx Gereksinimi (Siyah ekranı önler)
                    't': t, 'alt': alt, 'velY': vel_y, 'velX': vel_x, 'accY': acc_y, 'x': x,
                    'mach': mach, 'q': F_drag, 'fuel': total_fuel_remaining,
                    'phase': phase, 'activeIndex': active_index, 'falling': falling_out
                }
                trajectory.append(frame)
                
                # Rekorlar
                max_alt = max(max_alt, alt)
                max_vel = max(max_vel, v)
                max_acc = max(max_acc, acc_y)
                
                t += DT
                
                # BİTİŞ ŞARTLARI (HIZLI MİSYON SONLANDIRMA — KRAL İSTEDİ)
                if sim_ended:
                    break 
                
                # Eğer son kademedeysek ve yakıt bittiyse (Veya çok yavaşsak) BİTİR!
                is_last_stage = (active_index == len(parts) - 1)
                final_fuel_empty = (parts[-1].get('current_fuel', 0) <= 0.05)

                if is_last_stage and final_fuel_empty:
                    uyarilar.append("YAKIT TÜKENDİ: Misyon başarımı %100 - Veriler donduruldu.")
                    sim_ended = True
                
                # Güvenlik çıkışı: 1000 saniyeden sonra raporu daya gitsin
                if t >= 1000.0:
                    uyarilar.append("ZAMAN AŞIMI: Operasyonel periyot sonu.")
                    sim_ended = True

            # YANITI OLUŞTUR
            ozet = {
                "maks_irtifa_m": round(max_alt, 2),
                "maks_hiz_ms": round(max_vel, 2),
                "maks_ivme_ms2": round(max_acc, 2),
                "toplam_ucus_suresi_s": round(t, 2),
                "yuk_orani": round(payload_mass / total_initial_mass if total_initial_mass > 0 else 0, 4)
            }
            
            # ──────────────────────────────────────────────────
            # 🧠 MONTE CARLO ENKAz ANALİZİ (Debris Impact Zone AI)
            # Her ayrılan kademe için 200 rastgele simülasyon çalıştırarak
            # olası düşüş bölgesinin yarıçapını hesaplar.
            # Parametre Randomizasyonu:
            #   - Rüzgar hızı: ±%50 varyasyon
            #   - Sürtünme katsayısı (Cd): ±%30 varyasyon (takla rastgeleliği)
            #   - Ayrilma açısı/hızı: ±%20 varyasyon
            # ──────────────────────────────────────────────────
            import random
            
            debris_analysis = []
            
            for klog in kademeler_log:
                kademe_no = klog['kademe_no']
                sep_alt_m = klog['ayrilma_irtifasi_m']
                sep_vel = klog['ayrilma_hizi_ms']
                
                # O kademeye ait fiziksel parçayı bul
                stage_idx = kademe_no - 1
                if stage_idx >= len(parts):
                    continue
                stage_part = parts[stage_idx]
                stage_mass = float(stage_part.get('dryMass', 50))
                stage_cd = float(stage_part.get('cd', 0.5)) * 5.0
                stage_dia = float(stage_part.get('diameter', 0.15))
                stage_area = math.pi * (stage_dia / 2.0)**2
                
                landing_positions = []
                
                NUM_SIMS = 200
                for sim_i in range(NUM_SIMS):
                    # Rastgele parametre varyasyonları (Enkaz takla atarak düşer)
                    wind_var = wind_speed * (1.0 + random.uniform(-0.5, 0.5))
                    cd_var = stage_cd * (1.0 + random.uniform(0.1, 1.5)) # Takla atarken sürtünme katlanarak artar
                    vel_var_y = klog['delta_v_ms'] * (1.0 + random.uniform(-0.2, 0.2)) - 20.0
                    vel_var_x = random.uniform(-35.0, 35.0) # Yanal ayrılma şiddeti daha yüksek

                    # Gövde takla attığı için kesit alanı (çap * çap) yerine (uzunluk * çap) kullanılır
                    # Uzunluk yaklaşık olarak kütle/çap/250 alınır (silindirik tahmin)
                    lateral_area = stage_dia * (stage_mass / max(stage_dia, 0.1) / 250.0)
                    if lateral_area < stage_area * 2: lateral_area = stage_area * 2
                    
                    # Mini simülasyon
                    mc_y = sep_alt_m
                    mc_x = 0.0
                    mc_vy = vel_var_y
                    mc_vx = vel_var_x
                    mc_dt = 0.5  # Daha kaba adım (hız için)
                    
                    for _ in range(5000):  # Maks 2500 saniye
                        if mc_y <= 0:
                            break
                        rho_mc = 1.225 * math.exp(-mc_y / 8500.0)
                        v_mc = math.sqrt(mc_vy**2 + mc_vx**2)
                        drag_mc = 0.5 * rho_mc * (v_mc**2) * cd_var * stage_area
                        
                        if v_mc > 0:
                            d_y = drag_mc * (mc_vy / v_mc)
                            d_x = drag_mc * (mc_vx / v_mc)
                        else:
                            d_y, d_x = 0, 0
                        
                        net_y = -stage_mass * G_SEA - d_y
                        # Rüzgarın yanal itme kuvveti devasa silindirik yüzeye direkt etki eder
                        net_x = -d_x + 0.5 * rho_mc * (wind_var**2) * 1.5 * lateral_area * (1 if wind_var > 0 else -1)
                        
                        mc_vy += (net_y / stage_mass) * mc_dt
                        mc_vx += (net_x / stage_mass) * mc_dt
                        mc_y += mc_vy * mc_dt
                        mc_x += mc_vx * mc_dt
                    
                    landing_positions.append(mc_x)
                
                # İstatistik: Ortalama ve maks yarıçap
                if landing_positions:
                    mean_x = sum(landing_positions) / len(landing_positions)
                    max_dist = max(abs(lp - mean_x) for lp in landing_positions)
                    min_land = min(landing_positions)
                    max_land = max(landing_positions)
                    spread_m = max_land - min_land
                    
                    debris_analysis.append({
                        'kademe_no': kademe_no,
                        'kademe_adi': stage_part.get('name', f'{kademe_no}. Kademe'),
                        'ayrilma_irtifasi_m': sep_alt_m,
                        'ortalama_dusus_mesafesi_m': round(mean_x, 1),
                        'maks_sapma_yaricapi_m': round(max_dist, 1),
                        'maks_sapma_yaricapi_km': round(max_dist / 1000.0, 3),
                        'toplam_yayilim_m': round(spread_m, 1),
                        'toplam_yayilim_km': round(spread_m / 1000.0, 3),
                        'min_dusus_m': round(min_land, 1),
                        'max_dusus_m': round(max_land, 1),
                        'simulasyon_sayisi': NUM_SIMS
                    })
            
            response_payload = {
                "ozet": ozet,
                "kademeler": kademeler_log,
                "trajectory": trajectory,
                "uyarilar": uyarilar,
                "events": events,
                "enkaz_analizi": debris_analysis  # 🧠 Monte Carlo Enkaz Bölgesi
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_payload).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('', 5000), SimulatorHandler)
    print("🚀 SKYBOUNDARY Fizik Sunucusu — Port 5000 Başlatıldı.")
    server.serve_forever()
