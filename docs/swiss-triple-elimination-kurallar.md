# Swiss Triple Elimination — Tam Kurallar

> TavlaTV ürün kuralı (bu tür için; evrensel federasyon standardı değil).
> Kaynak: `backend/app/Support/Swiss/SwissEngine.php` + `SwissRuntime.php`.

## 1. Can / eleme
- Hak sayısı **turnuva başına seçilir: 1, 2 veya 3** (`swiss_lives`; `[1,3]`'e kırpılır, `MAX_LIVES=3` = tavan).
- Seçilen hak **kura anında kilitlenir**, her katılımcıyla taşınır. Eski kayıtta yoksa → 3.
- Oyuncu **kendi hakkı kadar maç kaybedince elenir** (`losses >= livesCap`): 1-haklıda ilk yenilgide, 3-haklıda 3. yenilgide.
- `remainingLives = livesCap − losses`. Hak yalnız **tamamlanmış turnuva maçıyla** azalır (tavla eli/mars/hedef puan DEĞİL).
- Kazanmak kaybedilen hakkı geri getirmez. **Beraberlik yok.**

## 2. Turnuva sonu
- **Sabit tur sayısı yok** — tek aktif oyuncu kalana kadar devam (`isComplete = aktif ≤ 1`).
- Son 2/3 oyuncuda da aynı Swiss + bay politikası.

## 3. İki ayrı galibiyet sayacı
- **`wins` (ilerleme galibiyeti):** bay + hükmen dahil.
- **`realWins` (gerçek maç):** yalnız oynanıp kazanılan. Rakip geçmişi (`opponents`) de yalnız gerçek maçta işlenir.

## 4. Bay (bye)
- Tek sayıda aktif oyuncu varsa **bir** bay verilir.
- Bay = ilerleme galibiyeti; **mağlubiyet/hak kaybı YOK**, gerçek galibiyet sayılmaz.
- **Bay seçim önceliği:** ① en az bay almış → ② en çok mağlubiyeti olan → ③ en az turnuva galibiyeti → ④ bayı en eski turda almış → ⑤ seed.

## 5. Eşleştirme (Swiss pairing)
Maliyet **bu öncelik sırasıyla** minimize edilir (lexicographic):
1. **Tekrar rakip** sayısı (mümkünse hiç)
2. **max** mağlubiyet farkı → sonra **toplam** mağlubiyet farkı (aynı can-grubunu eşle)
3. **max** galibiyet farkı → sonra **toplam**
4. **Ardışık float cezası** (geçen tur üst gruba çıkan tekrar çıkmasın, düşen tekrar düşmesin)
5. **seed dizisi** (nihai tie-break, deterministik)

- **≤14 oyuncu:** tüm eşleşmeler taranır → **global-optimal**. 1.5 sn aşılırsa sezgisele düşer.
- **>14 oyuncu:** mağlubiyet grubuna göre sırala, grup içi (−wins, seed), ardışık eşle, tek kalan alt gruba float; sonra tekrar-rakip çiftlerini yerel takasla azalt — **optimal değil**, raporlanır.

## 6. Özel sonuçlar
- **Hükmen / no-show** (`realMatch=false`): kazanana ilerleme galibiyeti, kaybedene mağlubiyet; gerçek-maç sayaçları ve rakip geçmişi **artmaz**.
- **Çift mağlubiyet** (iki taraf da gelmedi): ikisine birer mağlubiyet, galip yok.
- **Çekilme (withdraw):** aktif maç ayrıca kesinleşecekse mağlubiyet yazma; durum `withdrawn`.
- **Diskalifiye (dq):** yapay mağlubiyet yazmaz; ayrı `dq` durumu.

## 7. Sıralama
- **Canlı tablo:** aktif önce → az mağlubiyet → çok galibiyet → çok gerçek galibiyet → seed.
- **Kesin sonuç:** şampiyon=1 → sonra **geç elenen önce** (`eliminatedRound` DESC). Aynı turda elenenler şu kademeyle sıralanır (üstteki daha iyi):
  1. **Bay çekmeyen** üstte (az bay = üst sıra; bay bedava ilerleme sayılır)
  2. **Galibiyet** (`wins`) çok olan üstte
  3. **Gerçek maç galibiyeti** (`realWins`) çok olan üstte
  4. **Puan averajı** (gerçek maçlarda alınan − verilen) yüksek olan üstte
  5. **Rating** yüksek olan üstte

  Bu alanların **hepsi eşitse ORTAK derece** (ikisi ortak 3. ise sonraki 5.; seed yalnız gösterim sırası). Çekilen/DQ'ya sportif derece verilmez (rank=null).

## 8. Determinizm
- Kura ve eşleştirme `random` kullanmaz; **seed'li SHA-256 shuffle**. Aynı girdi + seed + `ALGO_VERSION` → aynı eşleştirme (resume/tekrar-üretilebilir).
