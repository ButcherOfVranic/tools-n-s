# Combustor Post-Process Tool

**Geliştiren: Muhammed Emin URAL**

Fluent combustor analizlerinin post-process çıktılarını tek bir arayüzde toplar, karşılaştırır, not tutar ve
PowerPoint / Excel / tek dosyalık HTML olarak dışa aktarır. Yalnızca Python 3 standart kütüphanesi gerekir; kurulum yok.

## Dosyalar

Repodan **Code → Download ZIP** ile indir ve şu yapıyı koru:

```
postproc.py
dashboard_template.html
ui/   (core.js, charts.js, views.js, gallery.js, mapping.js, notes.js, export.js, main.js)
```

## Çalıştırma

```
py postproc.py --root D:\analizler      # ilk sefer: analiz klasörünü ver (hatırlanır)
py postproc.py                          # sonraki seferler
```

Tarayıcıda arayüz açılır (`http://127.0.0.1:8765`, yalnızca bu bilgisayardan erişilir).
`D:\analizler` altındaki her alt klasör bir analizdir. Yeni analiz için klasörü oraya kopyala, **↻ Yeniden tara**.

## Özellikler

- **Dosya adı/yeri önemli değil**: tüm metin dosyaları içeriğine göre tanınır (yüzey raporları, XY / circ-avg,
  report-definition `.out`, sütunlu tablolar).
- **Yeniden adlandırma**: soldaki listede analize çift tıkla (ya da Notlar > Görünen ad). Klasör adı değişmez;
  yeni ad her yerde (tablolar, grafikler, sunum, Excel, paylaşım) kullanılır.
- **Sıralama**: soldaki listede ya da Özet tablosunda ⠿ tutamağıyla sürükle. Sütunları başlıktan sürükle.
  Geniş tabloları fareyle tutup kaydır.
- **Eşdeğer adlar** (Eşleme sekmesi): farklı post-process’lerde aynı şeyin adı farklıysa
  (`outlet` ≡ `outlet-plane`, `Total Temperature` ≡ `Total-Temperature`, `outlet-circ-temp` ≡ `cikis_circ_T`)
  bir kez eşleştir, uygulamanın her yerinde tek şey sayılır. Araç benzer adları önerir.
- **Profiller**: x ekseni radius ya da 0–1 span olarak gelse de **% span**’e çevrilir (otomatik, min–maks
  ya da hub/tip elle). RTDF’nin span konumu da % span verilir.
- **Görseller**: dosya adları farklı olsa da (`ATP_cp_analiz3_v2.png`, `ATP_cp_final.png`) önekten eşleşir.
  Kalıcı gruplar önek / joker (`*_cp_*`) ile tanımlanır. Karşılaştırma modları: yan yana (senkron zoom/kaydırma),
  kaydırmalı A|B, üst üste (opaklık), yanıp sönme, piksel farkı; ayrıca grup × analiz **matris** görünümü.
  ← → ile gruplar arası geçiş.
- **Notlar**: her analiz için görünen ad, durum, kısa açıklama, geometri değişiklik tablosu (ne / değişim),
  serbest not, tarihli günlük ve referansa göre otomatik sonuç farkları. Kalıcıdır
  (`D:\analizler\postproc_eslesme.json`), sunuma, Excel’e ve paylaşım dosyasına gider.
- **⇪ Dışa aktar**:
  - *PowerPoint*: kapak, içerik, analiz listesi, her analiz için not sayfası, özet tablosu (en iyi/kötü renkli,
    referansa göre %), metrik grafikleri, profiller, debi dağılımı, kesit üzerinde debi, görsel karşılaştırmaları,
    yöntem. Bölümler ve görsel grupları seçilebilir.
  - *Excel*: Özet, Fark (% ref), Notlar, her profil için veri, Debi dağılımı, Ham değerler, Bilgi.
  - *Paylaşım HTML’i*: tek dosya; sonuçlar, grafikler, notlar ve seçilen görseller **içine gömülü**
    (yeniden sıkıştırılmış; kalite seçilebilir). `D:\analizler\_paylasim\` içine yazılır. Alıcı çift tıklayıp açar.

## Hesaplananlar

| Metrik | Tanım |
|---|---|
| dP/P toplam, difüzör, liner | (Pt₁ − Pt₂) / Pt₁ · 100, mutlak basınçla (gerekirse **Operating pressure** gir) |
| Difüzör Cp | (Ps_dif − Ps_giriş) / (Pt_giriş − Ps_giriş) |
| OTDF | (T_maks,çıkış − T_çıkış) / (T_çıkış − T_giriş) |
| RTDF | (circ-avg profil maksimumu − T_çıkış) / (T_çıkış − T_giriş), maksimumun span konumu ile |
| Debi dağılımı | seçilen yüzey gruplarının \|debi\| toplamı / giriş debisi · 100 |
| Formüller | arayüzde kendi formülünü yaz: ör. `dPP_liner / dPP_comb * 100` |

## Ek özellikler (istenmeden eklenenler) — geri almak

`ui/core.js` başındaki `EXTRA` bloğunda ilgili satırı `false` yap:

| Bayrak | Özellik |
|---|---|
| `conv` | Yakınsama kontrolü: `.out` geçmişinin son %10’u ±%0.5’ten fazla oynuyorsa uyarı |
| `metricChart` | Özet altında seçilen metriğin çubuk grafiği |
| `transpose` | Özet tablosunu çevirme (satır = metrik) |
| `colHide` | Özet’te sütun gizleme paneli |
| `parent` | Notlarda “türetildiği analiz” ve ona göre sonuç farkları |
| `method` | PowerPoint’te “Yöntem ve tanımlar” sayfası |
| `diffImg` | Görsel karşılaştırmada piksel farkı modu |

`postproc.py` içinde `BACKUP_KEEP = 0` → eşleme dosyasının otomatik yedeklenmesi kapanır
(yedekler: `D:\analizler\.postproc_cache\yedek\`).

## Sorun giderme

`py postproc.py diag analiz-1`: tanınan dosyaları ve metin satırlarını **sayılar maskelenmiş** olarak yazar.

Test verisi (sentetik): `py tests/make_sample.py C:\temp\ornek`

---
© 2026 Muhammed Emin URAL
