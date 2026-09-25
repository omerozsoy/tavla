# TavlaTV — Kız Tavlası Kesin Kural Seti (v1)

Bu belge, TavlaTV içinde uygulanan Kız Tavlası'nın **tek ve bağlayıcı** kural setidir.
Oyun içindeki "Nasıl Oynanır?" metni ve `src/kiz/engine.ts` bu kurallarla **birebir** aynıdır.
Kaynaklarda farklı sürümler olduğundan (bkz. aşağıda) tutarlılık için tek bir sürüm seçilmiştir;
eksik kurallar klasik tavladan **otomatik devralınmamıştır**.

## Tahta ve başlangıç
- İki oyuncu, oyuncu başına **15 pul**, iki zar.
- Her oyuncunun **kendi 6 hanesi** vardır (1–6). Başlangıç dizilişi:
  - 6, 5 ve 4 hanelerinde **üçer** pul,
  - 3, 2 ve 1 hanelerinde **ikişer** pul (toplam 3+3+3+2+2+2 = 15).
- İki oyuncunun haneleri **bağımsızdır**: kırma, bar, rakip hanesini kapatma **yoktur**.
- Pullar klasik tavladaki gibi tahtayı **dolaşmaz**.

## Sıra ve zar
- Sırası gelen oyuncu iki zar atar.
- Her zar değeri *d* bir haneyi gösterir: gelen zar hangi haneyse **o haneden bir pul toplanır**
  (tahtadan kaldırılır). İki zar iki ayrı hane içindir; oyuncu hangisini önce oynayacağını seçebilir.
- **Çift** (örn. 5-5): o hanedeki (5. hane) **tüm pullar** birden toplanır.
- **Boş hane:** zarın gösterdiği hane boşsa **o zar oynanmaz** (klasik "yüksek zar / overflow"
  kuralı Kız Tavlası'na **taşınmaz** — bilinçli tercih).
- **Hamlesiz tur:** iki zarın da gösterdiği haneler boşsa, sıra rakibe geçer.

## Kazanma ve mars
- Pullarını (15) **önce toplayan** oyuncu oyunu kazanır.
- **Mars:** Kazanan pullarını bitirdiğinde rakip **henüz hiç pul toplamamışsa** (0), oyun **mars**
  sayılır (iki kat). Aksi halde normal (tek) galibiyet.

## Bu sürümde bilinçli olarak OLMAYANLAR
- Ayrı bir "indirme" fazı yoktur: "açma" ve "toplama" aynı eylemdir (zarın gösterdiği haneden pul
  kaldırma). Oyun tek mekanikle akar.
- Kırma / bar / kapatma / pul dolaştırma yoktur.
- Boş haneye gelen zar için overflow (en yüksek haneden toplama) yoktur.

## Uygulama haritası
- Kural motoru (saf, test edilebilir): `src/kiz/engine.ts`
- Yapay zekâ (yalnız yasal hamle seçer): `src/kiz/ai.ts`
- Testler (pul korunumu, çift, boş hane, hamlesiz tur, galibiyet, mars, 100 rastgele oyun): `src/kiz/engine.test.ts`
- Oyun sayfası (yerel: iki kişi + YZ): `src/ui/KizTavlasi.tsx` (+ `KizTavlasi.css`)
- Rota/menü: `src/pages.ts` (`kiz` / `/kiz-tavlasi`, `inMenu:false`) + `src/App.tsx` bağlama.

## Kaynak karşılaştırması
Başlangıç dizilişi, hareket yönü ("zarın gösterdiği hane açılır") ve çift kuralı ("o kapının tüm
pulları alınır") için birincil kaynak: tavlaplus.net/kiz-tavlasi. Kaynak; boş hane, bear-off
ayrıntısı ve mars konusunda **belirsizdi** → bu noktalarda yukarıdaki net kurallar TavlaTV için
seçildi. Kaynaklardaki kod/metin/görsel kopyalanmadı; uygulama özgündür.
