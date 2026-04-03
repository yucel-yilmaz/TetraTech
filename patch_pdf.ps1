 = 'frontend/src/App.jsx'
 = Get-Content -Path  -Raw

 = @'
  const generateSimulationPDF = () => {
'@
 = @'
  const getPdfSourceLabel = (sourceValue) => {
    const raw = String(sourceValue || '').trim();
    if (!raw) return 'LIVE';
    const upper = raw.toUpperCase();
    if (upper.includes('FALLBACK')) return 'FALLBACK';
    if (upper.includes('RADAR')) return 'RADAR';
    if (upper.includes('NOAA')) return 'NOAA';
    if (upper.includes('LIVE')) return 'LIVE';
    return raw;
  };

  const addPdfSourceTable = (doc, startY, rows, headColor = [45, 55, 72]) => {
    autoTable(doc, {
      startY,
      head: [['Kaynak', 'Mod', 'Guven / Not']],
      body: rows,
      styles: { fontSize: 8, font: 'courier', halign: 'left' },
      headStyles: { fillColor: headColor },
      margin: { left: 20, right: 20 }
    });
  };

  const addPdfApprovalBox = (doc, startY, summaryLines = []) => {
    doc.setFillColor(245, 245, 245);
    doc.rect(20, startY, 170, 28, 'F');
    doc.setDrawColor(27, 23, 23);
    doc.rect(20, startY, 170, 28);
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(27, 23, 23);
    doc.text("TETRA ASSISTANT RAPOR NOTU", 25, startY + 8);
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    const wrapped = doc.splitTextToSize(summaryLines.filter(Boolean).join(' | '), 155);
    doc.text(wrapped, 25, startY + 15);
  };

  const generateSimulationPDF = () => {
'@
 = .Replace(, )

 = @'
    autoTable(doc, {
      startY: cy,
      head: [['Risk Vektoru', 'Siddet', 'Taktik Analiz']],
      body: simResult.risks.map(r => [tr(r.type), r.level, tr(r.msg)]),
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8, halign: 'left' },
      headStyles: { fillColor: [27, 23, 23] }
    });
'@
 = @'
    autoTable(doc, {
      startY: cy,
      head: [['Risk Vektoru', 'Siddet', 'Taktik Analiz']],
      body: simResult.risks.map(r => [tr(r.type), r.level, tr(r.msg)]),
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8, halign: 'left' },
      headStyles: { fillColor: [27, 23, 23] }
    });

    addPdfSourceTable(doc, doc.lastAutoTable.finalY + 8, [
      ['Atmosfer', getPdfSourceLabel(simResult.weather_forecast?.source || data.weather.source), Sehir: ],
      ['Uzay Havasi', getPdfSourceLabel(simResult.space?.source_mode || data.space.source_mode), Durum: ],
      ['Hava Sahasi', getPdfSourceLabel(simResult.notam?.source || data.airspace.source), tr(simResult.notam?.status_message || data.airspace.status_message || 'Nominal')]
    ]);
'@
 = .Replace(, )

 = .Replace("      head: [['Analiz Edilen Altsistem', 'Durum', 'AI Dogrulama']],", "      head: [['Analiz Edilen Altsistem', 'Durum', 'Sistem Dogrulamasi']],")

 = @'
    autoTable(doc, {
      startY: cy,
      head: [['Kuantum-Fizik Metrigi', 'Operasyonel Deger', 'Analitik Aciklama']],
      body: [
        ['Spesifik Itki (Isp - Vakum)', '348.1 sn', 'Yakitin Verimlilik Katsayisi (Pro-Grade)'],
        ['Delta-V Butcesi (Nominal)', '9,450 m/s', 'Yorungeye Yerlesim Icin Gereken Momentum'],
        ['TWR (Thrust-to-Weight)', '1.42 G', 'Kalkis Verimliligi Ve Ivmelenme Analizi'],
        ['Termal Isil Aki (Q-dot)', '125 W/cm2', 'Atmosfere Giris Isil Direnc Siniri'],
        ['Reynolds Sayisi (Re)', '4.2e7', 'Turbulansli Akiskan Dinamigi Katsayisi'],
        ['Maksimum G-Load', '3.82 G', 'Govde Uzerindeki Kritik Yukleme']
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [45, 55, 72] }
    });

    const pdfBlobUrl = doc.output('bloburl');
'@
 = @'
    autoTable(doc, {
      startY: cy,
      head: [['Kuantum-Fizik Metrigi', 'Operasyonel Deger', 'Analitik Aciklama']],
      body: [
        ['Spesifik Itki (Isp - Vakum)', '348.1 sn', 'Yakitin Verimlilik Katsayisi (Pro-Grade)'],
        ['Delta-V Butcesi (Nominal)', '9,450 m/s', 'Yorungeye Yerlesim Icin Gereken Momentum'],
        ['TWR (Thrust-to-Weight)', '1.42 G', 'Kalkis Verimliligi Ve Ivmelenme Analizi'],
        ['Termal Isil Aki (Q-dot)', '125 W/cm2', 'Atmosfere Giris Isil Direnc Siniri'],
        ['Reynolds Sayisi (Re)', '4.2e7', 'Turbulansli Akiskan Dinamigi Katsayisi'],
        ['Maksimum G-Load', '3.82 G', 'Govde Uzerindeki Kritik Yukleme']
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [45, 55, 72] }
    });

    addPdfApprovalBox(doc, doc.lastAutoTable.finalY + 10, [
      Karar: ,
      Skor: %,
      Guven: ,
      Motor: 
    ]);

    const pdfBlobUrl = doc.output('bloburl');
'@
 = .Replace(, )

 = .Replace("    doc.text(Skor: %   |   Guven:    |   Motor: , 105, 64, { align: 'center' });", "    doc.text(Skor: %   |   Guven:    |   Motor: , 105, 64, { align: 'center' });")

 = @'
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Risk Vektoru', 'Seviye', 'Analiz']],
'@
 = @'
    addPdfSourceTable(doc, doc.lastAutoTable.finalY + 8, [
      ['Atmosfer', getPdfSourceLabel(weatherInfo.source), Sehir: ],
      ['Uzay Havasi', getPdfSourceLabel(spaceInfo.source_mode), Durum: ],
      ['Hava Sahasi', getPdfSourceLabel(notamInfo.source), fmtValue(notamInfo.status_message, 'Nominal')]
    ], [71, 85, 105]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Risk Vektoru', 'Seviye', 'Analiz']],
'@
 = .Replace(, )

 = .Replace("    doc.text(wrappedSummary, 16, doc.lastAutoTable.finalY + 22);", "    doc.text(wrappedSummary, 16, doc.lastAutoTable.finalY + 22);
    addPdfApprovalBox(doc, doc.lastAutoTable.finalY + 30, [
      Karar: ,
      Skor: %,
      Guven: ,
      Hava Sahasi: `r
    ]);")

 = .Replace("        ['AI Guven Araligi', debrisResult.confidence || 'YUKSEK'],", "        ['Guven Araligi', debrisResult.confidence || 'YUKSEK'],")

 = @'
    autoTable(doc, {
      startY: cy,
      head: [['Parametre', 'Veri Degeri']],
      body: [
        ['Analiz Edilen Arac', tr(debrisResult.rocket)],
        ['Firlatma Koordinati', ${debrisLaunchLat}N / E],
        ['Azimut Acisi', ${debrisAzimuth} derece],
        ['Hesaplanan Enkaz Sayisi', debrisResult.impact_zones?.length || 0],
        ['Guven Araligi', debrisResult.confidence || 'YUKSEK'],
        ['Yakit / Itki Tipi', tr(debrisResult.propellant)]
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [27, 23, 23] }
    });
'@
 = @'
    autoTable(doc, {
      startY: cy,
      head: [['Parametre', 'Veri Degeri']],
      body: [
        ['Analiz Edilen Arac', tr(debrisResult.rocket)],
        ['Firlatma Koordinati', ${debrisLaunchLat}N / E],
        ['Azimut Acisi', ${debrisAzimuth} derece],
        ['Hesaplanan Enkaz Sayisi', debrisResult.impact_zones?.length || 0],
        ['Guven Araligi', debrisResult.confidence || 'YUKSEK'],
        ['Yakit / Itki Tipi', tr(debrisResult.propellant)]
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [27, 23, 23] }
    });

    addPdfSourceTable(doc, doc.lastAutoTable.finalY + 8, [
      ['Balistik Motor', getPdfSourceLabel(debrisResult.method || 'BALLISTIC_PHYSICS'), tr(debrisResult.method || 'Deterministik analiz')],
      ['Uzay Havasi', getPdfSourceLabel(data.space.source_mode), Durum: ],
      ['Atmosfer', getPdfSourceLabel(data.weather.source), Konum: ]
    ]);
'@
 = .Replace(, )

 = .Replace("    doc.save(${reportID}_HERMES_ANALIZ.pdf);", "    addPdfApprovalBox(doc, doc.lastAutoTable.finalY + 10, [
      Roket: ,
      Guven: ,
      Motor: ,
      Enkaz noktasi: `r
    ]);

    doc.save(${reportID}_HERMES_ANALIZ.pdf);")

 = New-Object System.Text.UTF8Encoding(False)
[System.IO.File]::WriteAllText((Resolve-Path ), , )
