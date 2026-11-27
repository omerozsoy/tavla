# TavlaTV — Adil Zar (Provably-Fair Dice)

Bu depo, **tavlatv.com** üzerinde tek oyun/dereceli/paralı maçlarda zarları üreten **gerçek sunucu
kodudur** (`App\Services\FairDiceService`, Laravel/PHP). Buradaki `FairDiceService.php` canlıda çalışan
dosyanın birebir aynısıdır — "güven bize" demiyoruz, kodu kendin inceleyip zarları kendin doğrulayabilirsin.
Yanında **Laravel gerektirmeyen tek dosyalık doğrulayıcı** (`verify.php`) var.

> This is the **actual server code** that generates dice for single-game/ranked/stake matches on
> **tavlatv.com**. `FairDiceService.php` is identical to the file running in production.
> `verify.php` is a standalone verifier (no Laravel needed) that reproduces every die of a match.

## Nasıl çalışır? (commit–reveal, v2)

1. **Commit** — Oda **kurulurken** sunucu gizli bir `serverSeed` (32 bayt) üretir ve
   `commit = SHA256(serverSeed)` taahhüdünü, **daha hiçbir oyuncu tohumu yokken** herkese verir.
   Sunucu kendi tohumunu oyuncularınkinden ÖNCE kilitlediği için sonradan avantajlı tohum seçemez.
2. **Client katkısı** — Her insan oyuncu, commit'i gördükten sonra kendi rastgele tohumunu gönderir.
   Sunucu bunları `clientSeed = "<p1>.<p2>"` biçiminde birleştirir. **İlk (açılış) zarı atıldıktan sonra
   tohum DONAR**; yeni katkı kabul edilmez.
3. **Zar** — Her el için zar baytı `HMAC_SHA256(key = serverSeed, mesaj)` ile türetilir:
   - normal el: `v2:roll:<clientSeed>:<index>`
   - açılış: `v2:single:<clientSeed>:<gameNo>:<attempt>`

   Deterministiktir: aynı girdi → aynı zar.
4. **Reveal** — Maç bitince `serverSeed` açılır. İki taraf da `SHA256(serverSeed) == commit` olduğunu
   ve **tüm zarların** bu tohumdan çıktığını `verify.php` ile **bağımsızca** doğrular. Sunucu zarları
   sonradan değiştiremez.

## "Tohumum zamanında geldi mi?" seçim açığı — kapalı

Teorik bir endişe: sunucu kendi `serverSeed`'ini bildiği için, bir oyuncunun tohumunu *dahil eden* ve
*etmeyen* iki zar dizisini hesaplayıp "tohum zamanında gelmedi" diyerek işine geleni seçebilir miydi?
Bunu engellemek için **donmuş `clientSeed`, açılış zarıyla birlikte iki tarayıcıya da gönderilir**;
her tarayıcı kendi tohum parçasının dizide olup olmadığını **maç başında** görür. Parçan düşürülmüşse
anında uyarılırsın — maç sonunu beklemezsin.

## Modulo yanlılığı yok

256, 6'ya tam bölünmez; naif `byte % 6` bazı yüzleri biraz daha olası yapardı. Bu yüzden `252` ve üstü
baytlar **reddedilir** (rejection sampling) ve HMAC bir sonraki domain-separated bloktan sürdürülür →
her yüz tam olarak **1/6** olasılıkla gelir. (`uniformBytes`, 252 = 42×6)

## Kendin doğrula

```bash
# 1) Kodun sunucuyla birebir olduğunu kanıtla (gömülü ground-truth vektörleri):
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
  "rolls": [
    {"opening": 1, "white": 2, "black": 6, "starter": "black"},
    {"index": 0, "dice": [6, 2]},
    {"index": 2, "dice": [1, 1, 1, 1]}
  ]
}
```

`verify.php`, tek bir zar bile tutmazsa hangi elin uyuşmadığını gösterir ve sıfırdan farklı çıkışla biter.
(Tarayıcıda, Bilgi › **Adil Zar** sayfasında aynı algoritmanın JavaScript portuyla etkileşimli doğrulama
ve dağılım testi de var.)

## Sürümler

- **v2** (güncel, `clientSeed` içinde `.` var): yukarıdaki commit-reveal akışı, önekli HMAC mesajları.
- **v1** (eski odalar, `.` yok): mesaj `"<clientSeed>:<index>"` / açılış `"<clientSeed>:single:<index>"`.
  Eski maçların doğrulaması bozulmasın diye korunur; sürüm `clientSeed` biçiminden anlaşılır.

## Güvenlik neden kodu açınca bozulmaz?

Provably-fair sistemlerde güvenlik algoritmanın gizliliğine değil, **maça özel gizli `serverSeed`'e**
dayanır. Algoritma herkese açıktır (olması gereken budur); seed yalnızca maç bitince açılır.

Lisans: kaynak kod incelemesi içindir.
