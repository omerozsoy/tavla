# TavlaTV — Kız Tavlası Kesin Kural Seti (v2, İKİ FAZLI)

Bu belge, TavlaTV içinde uygulanan Kız Tavlası'nın **tek ve bağlayıcı** kural setidir.
Oyun içindeki "Nasıl Oynanır?" metni ve `src/kiz/engine.ts` bu kurallarla **birebir** aynıdır.

Sürüm: yalnız **bilgisayara (YZ) karşı**, **iki fazlı** (önce indirme/açma, sonra toplama).
Kaynak: gokhanbagci/KizTavlasiAlgoritma (iki-fazlı sürüm). Eksik ayrıntılar (boş hane, mars)
için net kurallar TavlaTV için seçildi; klasik tavladan otomatik devralma **yoktur**.

## Tahta ve başlangıç
- İki oyuncu (sen + bilgisayar), oyuncu başına **15 pul**, iki zar.
- Her oyuncunun **kendi 6 hanesi** vardır (1–6). Başlangıç: 6, 5, 4 hanelerinde **üçer**;
  3, 2, 1 hanelerinde **ikişer** pul. Tüm pullar başta **KAPALI** (kendi hanesinde dizili).
- İki oyuncunun haneleri **bağımsızdır**: kırma, bar, hane kapatma **yoktur**. Pullar tahtayı
  **dolaşmaz**.

## 1. Aşama — İndirme / Açma
- Oyuncunun **kapalı pulu olduğu sürece** bu fazdadır.
- Sıradaki oyuncu iki zar atar. Her zar değeri *d*, **d hanesinden bir pulu indirir**
  (kapalı → açık). İki zar iki ayrı hane içindir.
- **Çift** (d,d): d hanesindeki **tüm kapalı pullar** birden indirilir.
- Zarın gösterdiği hanede **kapalı pul yoksa o zar oynanmaz.**

## 2. Aşama — Toplama
- Oyuncunun **tüm pulları indirildikten sonra** (kapalı = 0) bu faza geçilir. (Faz oyuncu bazında;
  iki oyuncu bağımsız ilerler.)
- Aynı zar kuralı geçerlidir: zar *d*, **d hanesindeki bir açık pulu toplar** (açık → tahtadan
  kalkar / off). **Çift** (d,d): o hanenin **tüm açık pulları** toplanır.
- Zarın gösterdiği hanede **açık pul yoksa o zar oynanmaz.**
- Bir turda son kapalı pul indirilirse, **ikinci zar aynı turda toplama fazında** oynanabilir.

## Hamlesiz tur, galibiyet, mars
- İki zar da (aktif faza göre) oynanamıyorsa **sıra rakibe geçer.**
- Pullarını (15) **önce toplayan** kazanır.
- **Mars:** Kazanan bitirdiğinde rakip **henüz hiç pul toplamamışsa** (off = 0) → mars (iki kat).

## Bu sürümde bilinçli olarak OLMAYANLAR
- Kırma / bar / kapatma / pul dolaştırma yoktur.
- Boş haneye gelen zar için "en yüksek/alt haneden alma" (overflow) yoktur — o zar oynanmaz.
- Çevrimiçi (arkadaşa/eşleşmeye) mod ve sunucu doğrulaması bu sürümde yoktur (yalnız YZ'ye karşı).

## Tahtada gösterim (gerçek Board üzerinde)
- **Kapalı** pullar oyuncunun **ev bölgesinde** (sağ). **Açık** (indirilmiş) pullar **karşı bölgede**
  (sol) gösterilir; açma fazında pullar sağdan sola "iner". Toplama fazında açık pullar
  **bear-off tepsisine** toplanır. Skor şeridinde her oyuncunun **fazı** (Açma/Toplama) ve
  ilerlemesi yazılır.

## Uygulama haritası
- Kural motoru (saf, iki fazlı): `src/kiz/engine.ts`
- YZ (yalnız yasal hamle seçer): `src/kiz/ai.ts`
- Testler: `src/kiz/engine.test.ts` (indirme, çift, boş hane, faz geçişi, toplama, hamlesiz tur,
  galibiyet, mars, 100 rastgele tam oyun + pul korunumu)
- Oyun sayfası: `src/ui/KizTavlasi.tsx` (+ `KizTavlasi.css`) — yalnız YZ'ye karşı.
- Rota/menü: `src/pages.ts` (`kiz` / `/kiz-tavlasi`, `inMenu:false`) + `src/App.tsx` bağlama.
