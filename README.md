# Combustor Post-Process Tool

**Geliştiren: Muhammed Emin URAL**

Fluent combustor analizlerinin post-process çıktılarını tek bir arayüzde toplar, karşılaştırır ve özetler.
Yalnızca Python 3 standart kütüphanesi gerekir; kurulum yok.

## Dosyalar

İki dosyayı aynı klasöre koy: `postproc.py` ve `dashboard_template.html`.

## Çalıştırma

```
py postproc.py --root D:\analizler      # ilk sefer: analiz klasörünü ver (hatırlanır)
py postproc.py                          # sonraki seferler
```

Tarayıcıda arayüz açılır (`http://127.0.0.1:8765`, yalnızca bu bilgisayardan erişilir).
Konsol penceresi açık kaldığı sürece arayüz çalışır; kapatmak için Ctrl+C.

`D:\analizler` altındaki her alt klasör bir analizdir (`analiz-1`, `analiz-2`, ...). Yeni analiz eklemek için
klasörü oraya kopyala ve arayüzde **↻ Yeniden tara**'ya bas.

## Nasıl çalışır

- **Dosya adı ve yeri önemli değil.** Analiz klasöründeki tüm metin dosyaları içeriğine göre tanınır:
  Fluent yüzey raporları (Mass-Weighted Average, Area-Weighted Average, Mass Flow Rate, Facet Maximum ...),
  XY dosyaları (circumferential / radial average), report-definition `.out` dosyaları ve sütunlu tablolar.
  `.cas/.dat/.h5` gibi büyük ikili dosyalar atlanır. Tarama sonuçları önbelleğe alınır; ikinci açılış hızlıdır.
- **Eşleme & formüller** sekmesinde hangi değerin ne olduğu seçilir (Pt giriş, Tt çıkış, debi grupları,
  RTDF profili ...). İlk açılışta araç otomatik tahmin yapar; sen yalnızca düzeltirsin.
  Bir analizde yüzey adı farklıysa yalnızca o analiz için ayrı seçim yapılabilir.
- Seçimler otomatik kaydedilir: `D:\analizler\postproc_eslesme.json` ve aracın yanına varsayılan olarak
  (yeni bir analiz klasöründe aynı ayarlarla başlar). Yeni sürüm indirmek bu dosyaları silmez.

## Hesaplananlar

| Metrik | Tanım |
|---|---|
| dP/P toplam, difüzör, liner | (Pt₁ − Pt₂) / Pt₁ · 100, mutlak basınçla (gerekirse **Operating pressure** gir) |
| Difüzör Cp | (Ps_dif − Ps_giriş) / (Pt_giriş − Ps_giriş) |
| OTDF | (T_maks,çıkış − T_çıkış) / (T_çıkış − T_giriş) |
| RTDF | (circ-avg profil maksimumu − T_çıkış) / (T_çıkış − T_giriş), maksimumun span konumu ile |
| Debi dağılımı | seçilen yüzey gruplarının \|debi\| toplamı / giriş debisi · 100 |
| Kütle farkı | (çıkış − giriş) / giriş · 100 (yakıt girişi dahil) |
| Formüller | arayüzde kendi formülünü yaz: ör. `dPP_liner / dPP_comb * 100` |

## Sekmeler

**Özet** (mutlak / Δ / Δ% referansa göre, sıralama, en iyi/en kötü renklendirme, Excel CSV),
**Profiller** (span-parametre grafikleri, referansa göre fark), **Debi dağılımı** (kesit görseli üzerine
sürüklenebilir etiketler + yığılmış çubuk), **Görseller** (aynı konturu analizler arası yan yana),
**Eşleme & formüller**, **Katalog** (bulunan her değer, analizler yan yana), **Notlar** (etiket, not,
elle T maks), **Uyarılar**.

## Paylaşmak

Arayüzde **Paylaşılabilir HTML** ya da `py postproc.py build`: `D:\analizler\dashboard.html` adında tek bir dosya
üretir. Sunucu gerektirmez.

## Sorun giderme

`py postproc.py diag analiz-1` komutu, tanınan dosyaları ve metin satırlarını **sayılar maskelenmiş** olarak yazar.
Bir dosya tanınmıyorsa bu çıktıyı paylaşabilirsin.

Test verisi (sentetik): `py tests/make_sample.py C:\temp\ornek`

---
© 2026 Muhammed Emin URAL
