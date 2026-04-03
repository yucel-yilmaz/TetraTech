import zipfile
import gzip
import xml.etree.ElementTree as ET
import os
import math

def parse_float(value, default=0.0):
    try:
        if value is None: return default
        return float(value)
    except (TypeError, ValueError, AttributeError):
        return default

def calculate_polygon_area(points):
    if len(points) < 3: return 0.0
    x = [p[0] for p in points]
    y = [p[1] for p in points]
    return 0.5 * abs(sum(x[i]*y[i-1] - x[i-1]*y[i] for i in range(len(points))))

def get_property(element, tags, default=None):
    """Alt componentlerin (subcomponents) verilerini çalmadan kendi verilerini okur."""
    for tag in tags:
        val = element.findtext(tag)
        if val is not None: return val
        for child in element:
            if child.tag in ['subcomponents', 'motorconfigurations', 'simulations']:
                continue
            val = child.findtext(tag)
            if val is not None: return val
    return default

def print_all_rocket_parameters(file_path):
    if not os.path.exists(file_path):
        print(f"Hata: '{file_path}' bulunamadı babacı.")
        return

    print(f"=== {file_path} İÇİN ROKET PARAMETRELERİ (V7 KURTARMA SÜRÜMÜ) ===\n")
    root = None

    try:
        tree = ET.parse(file_path)
        if tree.getroot().find('rocket') is not None: root = tree.getroot()
    except Exception: pass

    if root is None:
        for ext in [zipfile.ZipFile, gzip.open]:
            try:
                if ext == zipfile.ZipFile:
                    with ext(file_path, 'r') as archive:
                        for name in archive.namelist():
                            try:
                                with archive.open(name) as f:
                                    tree = ET.parse(f)
                                    if tree.getroot().find('rocket') is not None:
                                        root = tree.getroot()
                                        break
                            except: continue
                else:
                    with ext(file_path, 'rb') as f:
                        tree = ET.parse(f)
                        if tree.getroot().find('rocket') is not None: root = tree.getroot()
            except: pass

    if root is None:
        print("Hata: Dosyanın içindeki roket verisi okunamadı.")
        return

    try:
        rocket = root.find('rocket')
        
        print("[ TEMEL BİLGİLER ]")
        print("-" * 40)
        print(f"Roket Adı      : {rocket.findtext('name', default='İsimsiz Roket')}")
        print(f"Tasarımcı      : {rocket.findtext('designer', default='Bilinmiyor')}\n")

        print("[ PARÇA PARAMETRELERİ VE DETAYLI KÜTLE HESABI ]")
        print("-" * 40)
        
        total_mass_kg = 0.0
        context_outer_radius = 0.0
        context_inner_radius = 0.0
        
        PHYSICAL_PARTS = [
            'nosecone', 'bodytube', 'transition', 'trapezoidfinset', 'ellipticalfinset', 
            'freeformfinset', 'ringfin', 'tubefin', 'masscomponent', 'innertube', 
            'centeringring', 'bulkhead', 'engineblock', 'parachute', 'streamer', 
            'shockcord', 'radialmass', 'axialmass', 'tracker', 'altimeter', 'flightcomputer', 'launchlug', 'stage'
        ]
        
        for element in rocket.iter():
            tag = element.tag
            if tag not in PHYSICAL_PARTS: continue
            
            name = get_property(element, ['name'], default=tag)
            
            L_m = parse_float(get_property(element, ['length'], '0.0'))
            Thick_m = parse_float(get_property(element, ['thickness'], '0.0'))
            
            # Akıllı Yarıçap (V5 ve Motor Bloğu Fix'i)
            if tag == 'bodytube':
                R_out = parse_float(get_property(element, ['radius', 'outerradius'], '0.0'))
                context_outer_radius = R_out
            elif tag == 'innertube':
                R_out = parse_float(get_property(element, ['outerradius', 'radius'], '0.0'))
                context_inner_radius = R_out
            elif tag == 'nosecone':
                # Burası düzeltildi: aftradius geri geldi!
                R_out = parse_float(get_property(element, ['aftradius', 'radius'], '0.0'))
                if R_out == 0.0: R_out = context_outer_radius
            elif tag in ['engineblock', 'centeringring', 'bulkhead', 'radialmass']:
                R_out = parse_float(get_property(element, ['outerradius', 'radius'], '0.0'))
                if R_out == 0.0: R_out = context_inner_radius if context_inner_radius > 0 else context_outer_radius
            else:
                R_out = parse_float(get_property(element, ['radius', 'outerradius'], '0.0'))
            
            R_in = parse_float(get_property(element, ['innerradius'], '0.0'))

            mass_kg = 0.0
            calc_method = ""
            debug_info = ""
            
            # 1. Override ve Sabit Kütle Kontrolü
            raw_mass_str = get_property(element, ['mass', 'overridemass'])
            override_tag = element.find('override')
            if override_tag is not None:
                o_mass = override_tag.findtext('mass')
                if o_mass is not None: raw_mass_str = o_mass

            if raw_mass_str is not None and parse_float(raw_mass_str) > 0:
                mass_kg = parse_float(raw_mass_str)
                calc_method = "Özel Girilmiş SABİT Kütle"
            
            else:
                # 2. Özel Formüllü Parçalar (Paraşüt, Kordon vb.)
                if tag == 'parachute':
                    dia = parse_float(get_property(element, ['diameter'], '0.0'))
                    area_density = 0.0
                    mat = element.find('material')
                    if mat is not None: area_density = parse_float(mat.get('density', mat.text))
                    lines = parse_float(get_property(element, ['linecount'], '0.0'))
                    line_len = parse_float(get_property(element, ['linelength'], '0.0'))
                    line_density = 0.0
                    line_mat = element.find('linematerial')
                    if line_mat is not None: line_density = parse_float(line_mat.get('density', line_mat.text))
                    
                    mass_kg = (math.pi * (dia/2.0)**2 * area_density) + (lines * line_len * line_density)
                    calc_method = "Kumaş Alanı + İp Kütlesi"
                    if mass_kg == 0: debug_info = "Paraşüt kumaş yoğunluğu veya çapı 0."
                    
                elif tag == 'streamer':
                    s_len = parse_float(get_property(element, ['striplength'], '0.0'))
                    s_wid = parse_float(get_property(element, ['stripwidth'], '0.0'))
                    area_density = 0.0
                    mat = element.find('material')
                    if mat is not None: area_density = parse_float(mat.get('density', mat.text))
                    mass_kg = (s_len * s_wid * area_density)
                    calc_method = "Şerit Kumaş Alanı"
                    
                elif tag == 'shockcord':
                    line_density = 0.0
                    mat = element.find('material')
                    if mat is not None: line_density = parse_float(mat.get('density', mat.text))
                    mass_kg = L_m * line_density
                    calc_method = "Uzunluk x Çizgisel Yoğunluk"
                    if mass_kg == 0: debug_info = "Şok kordonu yoğunluğu 0."

                # 3. Klasik Hacimsel Parçalar
                else:
                    density = 0.0
                    material = element.find('material')
                    if material is not None: density = parse_float(material.get('density', material.text))
                    
                    if density > 0:
                        vol = 0.0
                        if tag in ['bodytube', 'innertube', 'engineblock', 'launchlug', 'tubefin']:
                            if Thick_m > 0:
                                r_i = max(0, R_out - Thick_m)
                                vol = math.pi * L_m * (R_out**2 - r_i**2)
                                calc_method = "Boru Kabuğu Hacmi"
                            else:
                                vol = math.pi * (R_out**2) * L_m
                                calc_method = "Dolu Silindir Hacmi"
                        
                        elif tag == 'centeringring':
                            if R_in == 0.0: R_in = context_inner_radius
                            if R_out > R_in:
                                vol = math.pi * L_m * (R_out**2 - R_in**2)
                                calc_method = "Halka Hacmi"
                        
                        elif tag in ['bulkhead', 'radialmass', 'axialmass']:
                            vol = math.pi * (R_out**2) * L_m
                            calc_method = "Dolu Silindir Hacmi"
                        
                        elif tag == 'nosecone':
                            if Thick_m > 0:
                                slant = math.sqrt(R_out**2 + L_m**2)
                                vol = math.pi * R_out * slant * Thick_m
                                calc_method = "Koni Kabuğu"
                            else:
                                vol = (1.0/3.0) * math.pi * (R_out**2) * L_m
                                calc_method = "Dolu Koni"
                                
                            # OMUZLUK (Shoulder) Eklentisi
                            sh_L = parse_float(get_property(element, ['shoulderlength'], '0.0'))
                            sh_R = parse_float(get_property(element, ['shoulderradius'], '0.0'))
                            sh_T = parse_float(get_property(element, ['shoulderthickness'], '0.0'))
                            if sh_L > 0 and sh_R > 0:
                                if sh_T > 0:
                                    sh_vol = math.pi * sh_L * (sh_R**2 - max(0, sh_R-sh_T)**2)
                                    is_closed = get_property(element, ['shoulderclosed'], 'false') == 'true'
                                    if is_closed: sh_vol += math.pi * max(0, sh_R-sh_T)**2 * sh_T
                                    calc_method += " + Boş Omuzluk"
                                else:
                                    sh_vol = math.pi * (sh_R**2) * sh_L
                                    calc_method += " + Dolu Omuzluk"
                                vol += sh_vol
                        
                        elif tag == 'transition':
                            fore_r = parse_float(get_property(element, ['foreradius'], '0.0'))
                            aft_r = parse_float(get_property(element, ['aftradius'], '0.0'))
                            if Thick_m > 0:
                                slant = math.sqrt((fore_r - aft_r)**2 + L_m**2)
                                vol = math.pi * (fore_r + aft_r) * slant * Thick_m
                                calc_method = "Ökse Kabuğu"
                            else:
                                vol = (1.0/3.0) * math.pi * L_m * (fore_r**2 + fore_r*aft_r + aft_r**2)
                                calc_method = "Dolu Ökse"

                            for prefix in ['fore', 'aft']:
                                sh_L = parse_float(get_property(element, [f'{prefix}shoulderlength'], '0.0'))
                                sh_T = parse_float(get_property(element, [f'{prefix}shoulderthickness'], '0.0'))
                                curr_r = fore_r if prefix == 'fore' else aft_r
                                if sh_L > 0:
                                    if sh_T > 0:
                                        vol += math.pi * sh_L * (curr_r**2 - max(0, curr_r-sh_T)**2)
                                        calc_method += f" + Boş {prefix.upper()} Omuzluk"
                                    else:
                                        vol += math.pi * (curr_r**2) * sh_L
                                        calc_method += f" + Dolu {prefix.upper()} Omuzluk"
                        
                        elif tag in ['trapezoidfinset', 'ellipticalfinset', 'freeformfinset', 'ringfin']:
                            fin_count = parse_float(get_property(element, ['fincount'], '3.0'))
                            area = 0.0
                            
                            points = []
                            for child in element:
                                if child.tag not in ['subcomponents', 'override']:
                                    points.extend(child.findall('.//point'))
                            if len(points) >= 3:
                                pts = [(parse_float(p.get('x')), parse_float(p.get('y'))) for p in points]
                                area = calculate_polygon_area(pts)
                                calc_method = f"Koordinat Alanı ({int(fin_count)} adet)"
                            else:
                                root_c = parse_float(get_property(element, ['rootchord'], '0.0'))
                                tip_c = parse_float(get_property(element, ['tipchord'], '0.0'))
                                span = parse_float(get_property(element, ['height', 'span'], '0.0'))
                                area = ((root_c + tip_c) / 2.0) * span
                                calc_method = f"Yamuk Alanı ({int(fin_count)} adet)"
                            
                            vol = area * Thick_m * fin_count
                        
                        # Kütleyi Hacimden Hesapla
                        mass_kg = vol * density
                        if mass_kg > 0: calc_method += " x Yoğunluk"
                        else: debug_info = "Hacim formülü 0 üretti."
                        
                        # KANATÇIK DOLGULARI (Fin Fillets) - Özel Eklenti
                        if tag in ['trapezoidfinset', 'ellipticalfinset', 'freeformfinset']:
                            fillet_r = parse_float(get_property(element, ['filletradius'], '0.0'))
                            if fillet_r > 0:
                                f_mat = element.find('filletmaterial')
                                if f_mat is not None:
                                    f_dens = parse_float(f_mat.get('density', f_mat.text))
                                    if f_dens > 0:
                                        root_c = parse_float(get_property(element, ['rootchord'], '0.0'))
                                        fin_count = parse_float(get_property(element, ['fincount'], '3.0'))
                                        f_area = 0.2146 * (fillet_r**2)
                                        f_mass = fin_count * 2 * f_area * root_c * f_dens
                                        mass_kg += f_mass
                                        calc_method += " + Epoksi Dolgular"
                    else:
                        if tag not in ['stage', 'masscomponent']: debug_info = "Malzeme yoğunluğu bulunamadı."

            total_mass_kg += mass_kg
            
            if tag == 'stage' and mass_kg == 0: continue

            print(f"-> {name.upper()} ({tag})")
            if mass_kg > 0:
                print(f"   Kütle: {mass_kg * 1000:.2f} gram ({calc_method})")
            else:
                print(f"   Kütle: 0.00 gram")
                if debug_info: print(f"   [!] Hata: {debug_info}")
            print()

        print("=" * 40)
        print("[ TOPLAM ROKET KÜTLESİ (Motorsuz) ]")
        print(f"HESAPLANAN NET KÜTLE: {total_mass_kg * 1000:.2f} gram ({total_mass_kg:.4f} kg)")
        print("=" * 40)
        
    except Exception as e:
        print(f"Kritik Hata knk: {e}")

def get_rocket_parameters_dict(file_path):
    import zipfile
    import gzip
    import xml.etree.ElementTree as ET
    import os
    import math

    result = {
        'name': 'Bilinmeyen Roket',
        'designer': '',
        'total_mass_kg': 0.0,
        'height_m': 0.0,
        'max_diameter_m': 0.0,
        'stages': 0,
        'parts': []
    }

    if not os.path.exists(file_path): return result
    root = None

    try:
        tree = ET.parse(file_path)
        if tree.getroot().find('rocket') is not None: root = tree.getroot()
    except Exception: pass

    if root is None:
        for ext in [zipfile.ZipFile, gzip.open]:
            try:
                if ext == zipfile.ZipFile:
                    with ext(file_path, 'r') as archive:
                        for name in archive.namelist():
                            try:
                                with archive.open(name) as f:
                                    tree = ET.parse(f)
                                    if tree.getroot().find('rocket') is not None:
                                        root = tree.getroot()
                                        break
                            except: continue
                else:
                    with ext(file_path, 'rb') as f:
                        tree = ET.parse(f)
                        if tree.getroot().find('rocket') is not None: root = tree.getroot()
            except: pass

    if root is None: return result

    try:
        rocket = root.find('rocket')
        result['name'] = rocket.findtext('name', default='İsimsiz Roket')
        result['designer'] = rocket.findtext('designer', default='Bilinmiyor')

        PHYSICAL_PARTS = [
            'nosecone', 'bodytube', 'transition', 'trapezoidfinset', 'ellipticalfinset', 
            'freeformfinset', 'ringfin', 'tubefin', 'masscomponent', 'innertube', 
            'centeringring', 'bulkhead', 'engineblock', 'parachute', 'streamer', 
            'shockcord', 'radialmass', 'axialmass', 'tracker', 'altimeter', 'flightcomputer', 'launchlug', 'stage'
        ]

        total_mass_kg = 0.0
        max_rad = 0.0
        total_len = 0.0
        context_outer_radius = 0.0
        context_inner_radius = 0.0
        stages = 0

        for element in rocket.iter():
            tag = element.tag
            if tag not in PHYSICAL_PARTS: continue
            
            if tag == 'stage': stages += 1
            
            name = get_property(element, ['name'], default=tag)
            L_m = parse_float(get_property(element, ['length'], '0.0'))
            Thick_m = parse_float(get_property(element, ['thickness'], '0.0'))

            if tag == 'bodytube':
                R_out = parse_float(get_property(element, ['radius', 'outerradius'], '0.0'))
                context_outer_radius = R_out
            elif tag == 'innertube':
                R_out = parse_float(get_property(element, ['outerradius', 'radius'], '0.0'))
                context_inner_radius = R_out
            elif tag == 'nosecone':
                R_out = parse_float(get_property(element, ['aftradius', 'radius'], '0.0'))
                if R_out == 0.0: R_out = context_outer_radius
            elif tag in ['engineblock', 'centeringring', 'bulkhead', 'radialmass']:
                R_out = parse_float(get_property(element, ['outerradius', 'radius'], '0.0'))
                if R_out == 0.0: R_out = context_inner_radius if context_inner_radius > 0 else context_outer_radius
            else:
                R_out = parse_float(get_property(element, ['radius', 'outerradius'], '0.0'))
            
            R_in = parse_float(get_property(element, ['innerradius'], '0.0'))
            
            if R_out > max_rad: max_rad = R_out
            if tag in ['nosecone', 'bodytube', 'transition']:
                total_len += L_m

            mass_kg = 0.0
            
            raw_mass_str = get_property(element, ['mass', 'overridemass'])
            override_tag = element.find('override')
            if override_tag is not None:
                o_mass = override_tag.findtext('mass')
                if o_mass is not None: raw_mass_str = o_mass

            if raw_mass_str is not None and parse_float(raw_mass_str) > 0:
                mass_kg = parse_float(raw_mass_str)
            else:
                if tag == 'parachute':
                    dia = parse_float(get_property(element, ['diameter'], '0.0'))
                    area_density = 0.0
                    mat = element.find('material')
                    if mat is not None: area_density = parse_float(mat.get('density', mat.text))
                    lines = parse_float(get_property(element, ['linecount'], '0.0'))
                    line_len = parse_float(get_property(element, ['linelength'], '0.0'))
                    line_density = 0.0
                    line_mat = element.find('linematerial')
                    if line_mat is not None: line_density = parse_float(line_mat.get('density', line_mat.text))
                    mass_kg = (math.pi * (dia/2.0)**2 * area_density) + (lines * line_len * line_density)
                elif tag == 'streamer':
                    s_len = parse_float(get_property(element, ['striplength'], '0.0'))
                    s_wid = parse_float(get_property(element, ['stripwidth'], '0.0'))
                    area_density = 0.0
                    mat = element.find('material')
                    if mat is not None: area_density = parse_float(mat.get('density', mat.text))
                    mass_kg = (s_len * s_wid * area_density)
                elif tag == 'shockcord':
                    line_density = 0.0
                    mat = element.find('material')
                    if mat is not None: line_density = parse_float(mat.get('density', mat.text))
                    mass_kg = L_m * line_density
                else:
                    density = 0.0
                    material = element.find('material')
                    if material is not None: density = parse_float(material.get('density', material.text))
                    if density > 0:
                        vol = 0.0
                        if tag in ['bodytube', 'innertube', 'engineblock', 'launchlug', 'tubefin']:
                            if Thick_m > 0:
                                vol = math.pi * L_m * (R_out**2 - max(0, R_out - Thick_m)**2)
                            else:
                                vol = math.pi * (R_out**2) * L_m
                        elif tag == 'centeringring':
                            if R_in == 0.0: R_in = context_inner_radius
                            if R_out > R_in:
                                vol = math.pi * L_m * (R_out**2 - R_in**2)
                        elif tag in ['bulkhead', 'radialmass', 'axialmass']:
                            vol = math.pi * (R_out**2) * L_m
                        elif tag == 'nosecone':
                            if Thick_m > 0:
                                slant = math.sqrt(R_out**2 + L_m**2)
                                vol = math.pi * R_out * slant * Thick_m
                            else:
                                vol = (1.0/3.0) * math.pi * (R_out**2) * L_m
                            sh_L = parse_float(get_property(element, ['shoulderlength'], '0.0'))
                            sh_R = parse_float(get_property(element, ['shoulderradius'], '0.0'))
                            if sh_L > 0 and sh_R > 0:
                                vol += math.pi * (sh_R**2) * sh_L
                        elif tag == 'transition':
                            fore_r = parse_float(get_property(element, ['foreradius'], '0.0'))
                            aft_r = parse_float(get_property(element, ['aftradius'], '0.0'))
                            if Thick_m > 0:
                                slant = math.sqrt((fore_r - aft_r)**2 + L_m**2)
                                vol = math.pi * (fore_r + aft_r) * slant * Thick_m
                            else:
                                vol = (1.0/3.0) * math.pi * L_m * (fore_r**2 + fore_r*aft_r + aft_r**2)
                        elif tag in ['trapezoidfinset', 'ellipticalfinset', 'freeformfinset', 'ringfin']:
                            fin_count = parse_float(get_property(element, ['fincount'], '3.0'))
                            root_c = parse_float(get_property(element, ['rootchord'], '0.0'))
                            tip_c = parse_float(get_property(element, ['tipchord'], '0.0'))
                            span = parse_float(get_property(element, ['height', 'span'], '0.0'))
                            area = ((root_c + tip_c) / 2.0) * span
                            vol = area * Thick_m * fin_count
                        mass_kg = vol * density

            total_mass_kg += mass_kg
            if tag == 'stage' and mass_kg == 0: continue

            # Extract detailed fin/parachute info to draw them appropriately
            extra = {}
            if tag in ['trapezoidfinset', 'ellipticalfinset', 'freeformfinset']:
                extra = {
                    'rootchord': parse_float(get_property(element, ['rootchord'], '0.0')),
                    'tipchord': parse_float(get_property(element, ['tipchord'], '0.0')),
                    'span': parse_float(get_property(element, ['height', 'span'], '0.0')),
                    'sweepangle': parse_float(get_property(element, ['sweepangle'], '0.0'))
                }
            elif tag == 'transition':
                extra = {
                    'foreradius': parse_float(get_property(element, ['foreradius'], '0.0')),
                    'aftradius': parse_float(get_property(element, ['aftradius'], '0.0'))
                }
            elif tag == 'parachute':
                extra = {'diameter': parse_float(get_property(element, ['diameter'], '0.0'))}

            result['parts'].append({
                'name': name,
                'tag': tag,
                'length': L_m,
                'radius': R_out,
                'inner_radius': R_in,
                'mass': mass_kg,
                'extra': extra
            })

        result['total_mass_kg'] = total_mass_kg
        result['height_m'] = total_len
        result['max_diameter_m'] = max_rad * 2.0
        result['stages'] = stages

    except Exception as e:
        print(f"Bilinmeyen hata: {e}")
    
    return result

if __name__ == "__main__":
    benim_roket_dosyam = "hadiinşallah.ork" 
    print_all_rocket_parameters(benim_roket_dosyam)
