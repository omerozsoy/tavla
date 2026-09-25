# TavlaTV FAQ çalışma notu

Tarih: 2026-09-25

## Kaldığımız nokta

`/sikca-sorulan-sorular` sayfası geliştirildi. BKGm FAQ ana sayfası ve dört ana alt sayfadaki soru başlıkları tarandı:

- Basic Rules: 41 soru
- Variants: 31 soru
- Matches: 24 soru
- Ratings: 18 soru
- Toplam: 114 soru-cevap

Sayfada 114 özgün Türkçe soru-cevap, konu grupları, Türkçe karakter uyumlu arama, hızlı konu bağlantıları, her soruya paylaşılabilir hash bağlantısı ve kaynak bağlantısı bulunuyor.

## Görseller

- 53 kaynak görseli yerel olarak `public/assets/faq-source/` altında indirildi.
- 44 görsel bloğu eklendi.
- 15 pozisyon mevcut TavlaTV `ArticleBoard` bileşeniyle gösteriliyor.
- Kaynak board görselleri yerine TavlaTV’nin standart board tasarımı kullanıldı.
- Son Playwright kontrolü: 114 madde, 44 görsel blok, 15 board, 43 kaynak görsel etiketi, 0 kırık görsel.

## Değişen / eklenen ana dosyalar

- `src/ui/FaqView.tsx`
- `src/App.css`
- `src/App.tsx` (FAQ route entegrasyonu mevcut; HEAD içinde de bulunuyor olabilir)
- `backend/routes/web.php`
- `backend/app/Support/SeoMeta.php`
- `public/assets/faq-source/**`

## Kontroller

- `npm run build` başarılı.
- `php -l backend/routes/web.php` başarılı.
- `php -l backend/app/Support/SeoMeta.php` başarılı.
- Production preview üzerinde `/sikca-sorulan-sorular` açıldı ve responsive Playwright kontrolü yapıldı.

## Devam ederken

1. Önce `git status --short` ve `git diff --stat` kontrol et.
2. Diğer mevcut kullanıcı değişikliklerine dokunma.
3. Push istenirse yalnızca FAQ ile ilgili dosyaları stage et; özellikle `src/ui/FaqView.tsx`, FAQ CSS, SEO/backend route dosyaları ve `public/assets/faq-source/**`.
4. Variant board pozisyonları kaynak diyagramlarının TavlaTV board bileşeniyle yeniden oluşturulmuş temsilleridir; kesin taş koordinatı doğrulaması istenirse kaynak GIF’leri tek tek inceleyip düzelt.

