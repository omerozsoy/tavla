# Soru Maratonu — Tasarım

_2026-11-16_

## Amaç / Neden
"Günün Sorusu"nun tek-soru/gün mantığını, **sınırsız bir streak-quiz** moduna çevir:
oyuncu arka arkaya soru çözer, her doğru cevapta zorluğa göre puan kazanır, **ilk
yanlışta yarışma biter**, final skorunu alır ve (isterse) **anonim takma-adla global skor
tabelasına** yazar. Baştan başlanabilir. Amaç: tekrar-oynanabilir, rekabetçi, girişsiz de
erişilebilir bir eğitim-oyunu.

## Hedefler
- Sınırsız soru akışı; bir turda aynı soru tekrar gelmez.
- Zorluk-bazlı puan (aşağıdaki tablo), **üstte anlık (canlı) skor**.
- Tek yanlış → oyun biter → final skor ekranı.
- **Anonim** skor gönderimi (takma-ad, giriş YOK) + global tabela (en yüksekler).
- "Baştan Başla".

## Hedef-değil / Anti-hedef
- Giriş/hesap zorunluluğu YOK (karar: B).
- Sunucu-taraflı hile-kanıtı puan doğrulama YOK (bkz. Kısıtlar) — kasıtlı basit.
- Günlük tek-soru özelliği emekliye ayrılır (yerini maraton alır).

## Kısıtlar
- **Puan istemciden gelir → spoof edilebilir.** Anonim/kasual bir tabela için kabul; hafif
  önlemler: takma-ad uzunluk sınırı + POST rate-limit (throttle) + opsiyonel ip-hash.
  Tavan: ciddi hile-koruması gerekirse ileride sunucu-doğrulamalı akışa taşınır.
- Cevap puanlaması bazı sorularda NeuralBot (ONNX, istemci) ister → soru başına küçük gecikme;
  açılış/ünlü sorular otoriter cevapla anında. Kabul edilebilir.

## Yaklaşımlar
- **A (reddedildi):** Girişli, skor `users`'a bağlı, mevcut Leaderboard aynen. Az kod ama
  girişsiz oyuncu yarışamaz → kullanıcı B'yi seçti.
- **B (seçildi):** Anonim `quiz_scores` tablosu + yeni controller/uçlar. Giriş gerekmez,
  herkes yarışır. Yeni tablo+endpoint maliyeti, hafif anti-spam.

## Puanlama
Sorunun zorluk bandı (`tierOf(hardnessText)`) çarpanı belirler, taban 25:

| Zorluk | tier | Çarpan | Puan |
|---|---|---|---|
| Çok Kolay + Kolay | 0–1 | ×1 | 25 |
| Orta | 2 | ×2 | 50 |
| Zor | 3 | ×3 | 75 |
| Çok Zor | 4 | ×4 | 100 |

## Karar verilenler (benim çağrılarım, düzeltilebilir)
- **Soru havuzu:** CURRICULUM'un düzleştirilmiş (test hariç) soruları — zaten board+zar
  dedup'lı (~2439). DAILY_POOL DEĞİL (o dedup'suz). Tur içi rastgele, tekrar yok.
- **Sayfa/slug:** yeni `/soru-maratonu`, menü etiketi "Soru Maratonu"; eski
  "Günün Pozisyonu" menü öğesi bununla değişir, DailyPuzzle render'ı maraton için yeniden
  kullanılır.
- **Doğru/yanlış:** LessonView'in mevcut ilk-deneme puanlaması (otoriter cevap veya
  NeuralBot ≤%2 equity) — LessonView'e `onAnswered(correct)` callback'i eklenir.
- **Backend tablo `quiz_scores`:** `id, nickname (str, ≤20), score (int), correct_count (int),
  created_at`. user_id YOK (anonim). ip_hash (opsiyonel, anti-spam).
- **Uçlar:** `POST /api/quiz-marathon/score` (throttle'lı; nickname+score+correct doğrula, ekle),
  `GET /api/quiz-marathon/leaderboard?limit=` (score desc, 30sn cache).
- **Frontend:** yeni `QuizMarathon.tsx` (akış+anlık skor+game-over+nick girişi+tabela);
  `api.ts` `submitQuizScore`/`quizLeaderboard`; `App.tsx` route+menü; `web.php` allowlist.

## Game-over ekranı (metin taslağı)
```
   ⬛  SKORUN: 325
   12 doğru · en iyi çarpan ×4

   [ Takma ad: ________ ]  [ Tabelaya Yaz ]

   🏆 Skor Tabelası
   1. ReisTavla      1250
   2. gnubg_killer    980
   3. sen (325)
   ...
   [ Baştan Başla ]
```

## Builder'a bırakılan
- QuizMarathon bileşen içi state makinesi (soru index, skor, seen-set, faz).
- LessonView callback entegrasyonu (fixed/marathon modunda per-soru sonuç).
- Tabela görünümü (mevcut Leaderboard.tsx stilini örnek al, ama ayrı basit tablo).
- Migration + controller + validation + throttle ayarı.
- i18n metinleri, web.php allowlist, deploy (dist).
