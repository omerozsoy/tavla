# TavlaTV — Adil Zar (Provably-Fair Dice)

Bu depo, **tavlatv.com** üzerinde tek oyun/dereceli/paralı maçlarda zarları üreten **gerçek sunucu
kodudur** (`App\Services\FairDiceService`, Laravel/PHP). Buradaki `FairDiceService.php`, aşağıdaki
eşitleme tarihinde canlıda çalışan dosyayla birebir aynıdır — "güven bize" demiyoruz, kodu kendin
inceleyip zarları kendin doğrulayabilirsin. Yanında **Laravel gerektirmeyen tek dosyalık doğrulayıcı**
(`verify.php`) var.

> _Son eşitleme / Last synced: 2026-11-28 (FairDiceService.php @ 07d32ddcb)_

> This is the **actual server code** that generates dice for single-game/ranked/stake matches on
> **tavlatv.com**, identical to production as of the sync date above. `verify.php` is a standalone
> verifier (no Laravel) that reproduces every die of a match and checks roll-index integrity.

## Nasıl çalışır? (commit–reveal, v2)

1. **Commit** — Oda **kurulurken** sunucu gizli bir `serverSeed` (32 bayt) üretir ve
   `commit = SHA256(serverSeed)` taahhüdünü, **daha hiçbir oyuncu tohumu yokken** herkese verir.
   Sunucu kendi tohumunu oyuncularınkinden ÖNCE kilitlediği için sonradan avantajlı tohum seçemez.
2. **Client katkısı** — Her insan oyuncu, commit'i gördükten sonra kendi rastgele tohumunu gönderir.
   Sunucu bunları `clientSeed = "<p1>.<p2>"` biçiminde birleştirir. **İlk (açılış) zarı atıldıktan sonra
   tohum DONAR**; yeni katkı kabul edilmez.
3. **Zar** — Her el için zar baytı `HMAC_SHA256(key = serverSeed, mesaj)` ile türetilir. `round`
   reddetme örneklemesinin blok sayacıdır (aşağıya bakın):
   - normal el: `v2:roll:<clientSeed>:<index>:<round>`
   - açılış: `v2:single:<clientSeed>:<gameNo>:<attempt>:<round>`

   Deterministiktir: aynı girdi → aynı zar.
4. **Reveal** — Maç bitince `serverSeed` açılır. İki taraf da `SHA256(serverSeed) == commit` olduğunu
   ve **tüm zarların** bu tohumdan çıktığını `verify.php` ile **bağımsızca** doğrular. Sunucu zarları
   sonradan değiştiremez.

## Index bütünlüğü — atlanan zar yakalanır

Sunucu normal el zarlarını `index` **0, 1, 2, … ARALIKSIZ** atar (`dice_roll_index`). Zar değerini
seçemese de teorik olarak "beğenmediği bir index'i atlayıp" bir sonrakini kullanmayı deneyebilir.
Bu yüzden `verify.php`, reveal'daki normal el index'lerinin tam `0..N-1` (boşluksuz, tekrarsız)
olduğunu denetler; bir index eksik/tekrar ise sonucu **başarısız** sayar. (Açılış zarları `gameNo` ile
ayrı anahtarlanır, index saymaz.)

## "Tohumum zamanında geldi mi?" seçim açığı — kapalı

Teorik endişe: sunucu kendi `serverSeed`'ini bildiği için, bir oyuncunun tohumunu *dahil eden* ve
*etmeyen* iki diziyi hesaplayıp "tohum zamanında gelmedi" diyerek işine geleni seçebilir miydi?
Önlem: **donmuş `clientSeed`, açılış zarıyla birlikte iki tarayıcıya da gönderilir**; her tarayıcı
kendi tohum parçasının dizide olup olmadığını **maç başında** görür ve parçası düşürülmüşse anında
uyarılır (maç sonunu beklemez). `verify.php` de v2 reveal'da **boş tohum parçasını** (`"."` / `"abc."`)
uyarı olarak bildirir — bot maçlarında rakip (p2) parçasının boş olması normaldir, bunu reveal'da
`"bot": true` ile belirtebilirsin.

## Modulo yanlılığı yok

256, 6'ya tam bölünmez; naif `byte % 6` bazı yüzleri biraz daha olası yapardı. Bu yüzden `252` ve üstü
baytlar **reddedilir** (rejection sampling) ve HMAC bir sonraki domain-separated bloktan (`:<round>`,
round = 0, 1, …) sürdürülür → her yüz tam olarak **1/6** olasılıkla gelir. (`uniformBytes`, 252 = 42×6)

## Kendin doğrula

```bash
# 1) verify.php'nin gömülü ground-truth vektörleriyle tutarlı olduğunu gör:
php verify.php --self-test

# 2) Gerçek bir maçı doğrula (maç sonu "reveal" verisini reveal.json'a koy):
php verify.php reveal.json
```

`reveal.json` biçimi:

```json
{
  "commit":     "<sha256 hex>",
  "serverSeed": "<64 hex>",
  "clientSeed": "<p1>.<p2>",
  "bot":        false,
  "rolls": [
    {"opening": 1, "white": 2, "black": 6, "starter": "black"},
    {"index": 0, "dice": [6, 2]},
    {"index": 1, "dice": [6, 1]},
    {"index": 2, "dice": [1, 1, 1, 1]}
  ]
}
```

`rolls` içindeki normal el index'leri `0, 1, 2, …` aralıksız olmalı; çift gelen zar oyunda 4 eleman
olarak kaydedilir (örn. `[1,1,1,1]`). `verify.php`, tek bir zar bile tutmazsa, bir index atlanmışsa
veya PvP'de bir tohum parçası boşsa bunu bildirir ve sıfırdan farklı çıkışla biter.

(Tarayıcıda, Bilgi › **Adil Zar** sayfasında aynı algoritmanın JavaScript portuyla etkileşimli
doğrulama ve dağılım testi de var.)

## Sürümler

- **v2** (güncel, `clientSeed` içinde `.` var): yukarıdaki commit-reveal akışı, önekli HMAC mesajları.
- **v1** (eski odalar, `.` yok): mesaj `"<clientSeed>:<index>:<round>"` / açılış
  `"<clientSeed>:single:<gameNo*4+attempt>:<round>"`. Eski maçların doğrulaması bozulmasın diye korunur;
  sürüm `clientSeed` biçiminden anlaşılır.

## Güvenlik neden kodu açınca bozulmaz?

Provably-fair sistemlerde güvenlik algoritmanın gizliliğine değil, **maça özel gizli `serverSeed`'e**
dayanır. Algoritma herkese açıktır (olması gereken budur); seed yalnızca maç bitince açılır.

Lisans: kaynak kod incelemesi içindir.
