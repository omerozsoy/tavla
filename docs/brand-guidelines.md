# TavlaTV — Marka Kılavuzu

> **Kaynak-of-truth = kod.** Bu belge `src/App.css` `:root` bloğunu ve `src/fonts.css`'i
> aynalar; renk/token değeri değişirse CSS otoriterdir, bu dosya onu takip eder.
> Üretilme tarihi: 2026-11-15 (mevcut koddan çıkarıldı).

## Kimlik

- **Ad:** TavlaTV · yazımı **TavlaTv** · alan adı **tavlatv.com**
- **Ne:** Tarayıcıda çalışan tavla platformu — canlı maç, turnuva, mağaza, maç analizi ve eğitim.
- **Karakter:** Sıcak, zamansız, editoryal. Casino/parlak-neon değil; toprak tonlu, oturaklı, güven veren.

## Renk paleti — "warm earth / terracotta"

Primitive isimleri (`--med-*`, `--navy`, `--gold`) legacy; **değerler terracotta paletidir.**
PRIMARY/yapısal = Ink (koyu), ACCENT = Kiremit (brick), sıcak tersiyer = Amber.

### Çekirdek (light tema — krem zemin)

| Rol | Token | Değer |
|-----|-------|-------|
| Ink — primary/yapısal koyu, ana metin | `--tv-ink` / `--med-ink` | `#1c1a17` |
| Ink deep — primary hover | `--med-blue-deep` | `#100e0c` |
| Kiremit (brick) — **ACCENT** | `--terracotta` / `--coral` | `#c9563f` |
| Kiremit deep — açık zeminde accent + hover | `--terracotta-hover` | `#d14e24` |
| Amber-gold — ikincil aksan / coin / puan | `--orange` / `--tv-gold` | `#d98b3a` |
| Krem — ana açık zemin | `--cream` / `--med-ivory` | `#f4efe6` |
| Krem-deep — ikincil yüzey | `--med-ice-soft` | `#efeae1` |
| Beyaz — kart/yüzey | `--tv-white` | `#ffffff` |
| Line / border | `--tv-line` / `--med-sand` | `#ded7ca` |
| İkincil metin (muted) | `--tv-ink-muted` / `--slate` | `#5e574c` |
| Üçüncül / etiket (faint) | `--tv-ink-faint` | `#8a8377` |

### Coin (markadan AYRI semantik değer — accent'e karışmaz)

| Rol | Token | Değer |
|-----|-------|-------|
| Coin altını | `--coin-gold` | `#e6b422` |
| Parlak gold (vurgu) | — | `#ffd76a` |

### Dark tema (ink zemin)

| Rol | Token | Değer |
|-----|-------|-------|
| Ana zemin | `--med-navy-900` | `#1c1a17` |
| Kart | `--med-navy-800` | `#24211d` |
| Elevated / hover / dark border | `--med-navy-700` / `--med-line-dark` | `#33302b` |
| Accent (koyu temada da ana marka rengi) | `--accent` | `#d14e24` |
| Accent metin (koyu zeminde ~5:1 AA) | `--accent-text` | `#ec7a52` |

### Semantik durum renkleri (paletten AYRI, erişilebilirlik zorunlu)

| Rol | Token | Değer |
|-----|-------|-------|
| Success | `--color-success` | `#2e9e5b` |
| Warning (= amber) | `--color-warning` | `#d98b3a` |
| Error (brick'ten ayrı, pembe-kırmızı) | `--color-error` | `#e0455e` |
| Info | `--color-info` | `#6b9bcc` |

**Bölüm aksanı:** Eğitim yolu (`/tavla-egitimi`, `.tr-path`) kendi aksanını kullanır: `#a83a2b`.

## Tipografi

- **Birincil aile: Outfit** (self-hosted woff2, ağırlık **300–900**). Tüm UI, başlık ve gövde.
  Token: `--tv-font-ui` / `--tv-font-display` / `--tv-font-mono` → **hepsi Outfit'e çözülür**
  (marka kuralı: *tek yazı ailesi, font pairing yok*).
- **Spectral** (self-hosted serif 400–700) yüklü ve kullanılabilir ama token sistemi Outfit'e sabit.
- **Sayısal veriler** (skor, rating, saat): Outfit + `tabular-nums` ile hizalı kalır.
- Fontlar **kendi origin'inden** servis edilir (3. taraf bağlantı yok; AB gizlilik, `font-display: swap`).
- Fallback: `system-ui, -apple-system, 'Segoe UI', sans-serif`.

## Ses tonu

- **Dil: Türkçe** (zorunlu — kullanıcı direktifi; tüm UI, bildirim, pazarlama).
- Sıcak, net, oyuncu-dostu; abartısız. Teknik doğruluk önce gelir ("düzeldi" demeden önce doğrula).
- Coin/ödül UI'da **emoji değil** `<Icon name="coin">` kullanılır (bazı fontlarda 🪙 tofu □ olur).

## Görsel varlıklar

- Logo / kimlik görselleri: proje kökünde `identity*.png` (henüz asset klasörüne taşınmadı).
- Takım amblemi: `TeamEmblem` SVG — **SHIELD** (kalkan) formu; logo kalkana kırpılır, çerçeve gradyan.
- Avatar: daire maske (kalkan değil) — `AvatarCropper`.

## Kullanım kuralları

1. **Accent'i kontrollü kullan** — kiremit vurgu, zemin değil. Zemin krem (light) / ink (dark).
2. **Coin altını ≠ marka accent'i.** Coin için `--coin-gold`, karakter vurgusu için `--terracotta`.
3. Yeni renk eklemeden önce token tablosuna bak — paletten sapma yalnız semantik durum için meşru.
4. Değer değişikliği **`src/App.css` `:root`'ta** yapılır; bu belge sonra güncellenir.
