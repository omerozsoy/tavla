# 3 Haklı Swiss — Uygunluk Raporu (salt okuma)

> İnceleme tarihi: 2026-10-07 · Yalnızca inceleme/karşılaştırma; kod, veritabanı, ayar veya veride hiçbir değişiklik yapılmadı.
> Bulgular kodun (`SwissEngine`, `SwissRuntime`, `TournamentController`, `TournamentResource`, model, migration, config, frontend `Tournaments.tsx`) ve mevcut testlerin okunmasına dayanır. Testler **çalıştırılmadı**; canlı turnuva verisi sorgulanmadı. Doğrulanmış bulgular ile yalnızca olası riskler ayrı ayrı işaretlendi.

---

## Genel değerlendirme

Mevcut sistem, **özel bir kayıp-bazlı eleme Swiss'i** olarak gerçekten uygulanmıştır — standart sabit-turlu Swiss değil. Çekirdek (`SwissEngine`) saf, deterministik ve iyi test edilmiş (18 unit + ~16 feature test). Kayıp hakkı, eleme, "tek oyuncu kalana kadar devam", bay'in hak düşürmemesi, final etabında hakların korunması, idempotent sonuç işleme ve eşleştirmede **global-optimal** (küçük grupta exhaustive) tekrar-rakip kaçınması doğru kurgulanmış ve testlerle kanıtlanmış.

Ancak istenen ürün tanımının **birkaç önemli parçası eksiktir veya sabittir**:

1. **Hak sayısı 1/2/3 seçilemez — koda sabit `3`'tür.** Bu, istenen sistemin birinci maddesini doğrudan karşılamaz. En kritik uyumsuzluk budur.
2. **Averaj** hiçbir yerde hesaplanmaz/gösterilmez.
3. **Admin'in turnuva sonu sıralamasını elle değiştirmesi** yoktur.
4. **Tur gün/saat planlaması** (1.tur 20:00, 2.tur 21:00…) yoktur; turlar yalnızca önceki tur bitince üretilir. (İyi yan: erken bitiren oyuncu sonraki tura erken başlayamaz — bu alt-kural kendiliğinden sağlanır.)
5. **Admin onayı ile katılım** ve **check-in** yoktur (dokümantasyon `swiss-triple-elimination.md §11`'de "bağlandı" dese de kodda route/method/alan **yok** — doküman güncel değil).

Premium/ücret/coin akışı sağlam ve yarış-güvenli; "premium" bir **üyelik şartıdır** (etiket değil).

---

## Gereksinim karşılaştırma tablosu

### 1. Mağlubiyet hakkı ve eleme

| Gereksinim | Mevcut davranış | Durum | Kod kanıtı | Eksik / risk |
|---|---|---|---|---|
| 1/2/3 hak seçilebilmeli | Hak **koda sabit 3**. Admin formunda, migration'da, config'de hak alanı yok. Tek tip `swiss_triple`. | **Kurala aykırı / Eksik** | `SwissEngine.php:27` `MAX_LIVES = 3`; kullanım `:80,:119,:137`. Kilitli config'de hak yok `SwissRuntime.php:32-40`. Admin formda alan yok `TournamentResource.php:181-186`. Migration yalnız `type`+`swiss_state`. | 1 ve 2 haklı turnuva **hiç kurulamaz**. Ürünün temel seçeneği yok. |
| Kalan hak = limit − mağlubiyet | `remainingLives = max(0, 3 − losses)` | Tam uyumlu (ama limit=3 sabit) | `SwissEngine.php:78-81` | Limit sabit olduğu için formül de 3'e kilitli. |
| Limite ulaşan elenir, sonraki kuraya girmez | 3. mağlubiyette `status='eliminated'`; eşleştirme yalnız `active()` | Tam uyumlu | `SwissEngine.php:119-122`; `active()` `:73-76`; `pairRound` yalnız aktif `:217` | — |
| BYE hak düşürmez | `applyBye` yalnız `byes++`, `wins++`; mağlubiyet yok | Tam uyumlu | `SwissEngine.php:150-162`; test `SwissEngineTest.php:146` | — |
| Tek oyuncu kalana kadar | `isComplete` = `active ≤ 1`; champion = tek aktif | Tam uyumlu | `SwissEngine.php:84-94`; `SwissRuntime.php:121` | — |

### 2. Eşleştirme

| Gereksinim | Mevcut davranış | Durum | Kod kanıtı | Eksik / risk |
|---|---|---|---|---|
| Aynı kalan-haklılar eşleşmeli | Mağlubiyet farkı bir **maliyet** (minimize edilir), sert kısıt değil. ≤14 oyuncuda tüm eşleştirmeler arasından global-optimal seçilir. | Büyük ölçüde uyumlu | `matchingCost` `SwissEngine.php:328-357`; `exhaustiveMatch` `:380-427` | Mümkün olduğunca aynı grup; gerekirse gruplar arası float (kurala uygun). |
| Tekrar rakip, başka seçenek varsa olmamalı | Tekrar-rakip, maliyet vektöründe **en yüksek öncelik** (ilk boyut). ≤14'te global minimize. | Tam uyumlu | `matchingCost` sırası `[rematch, maxLoss, …]` `:356`; test `SwissEngineTest.php:203` | — |
| Zorunlu tekrar yalnız başka seçenek yoksa | Başka geçerli eşleşme yoksa tekrar yapılır, kilitlenmez | Tam uyumlu | test `test_forced_rematch_does_not_deadlock` `:220` | — |
| Algoritma tüm grubu mu, yoksa sıradaki ikiyi mi değerlendiriyor? | **≤14 oyuncu:** tüm perfect-matching'ler (global optimal). **>14:** sezgisel ardışık + yerel takas (optimal **değil**). | Kısmen uyumlu (büyük alanda) | `EXHAUSTIVE_MAX=14` `:30`; `heuristicMatch` `:436-483`; optimal olmayan `optimal=false` loglanır `:417` | >14 kişilik aynı-hak grubunda **önlenebilir tekrar-rakip / kötü float** çıkabilir (düşük olasılık, raporlanır). |
| Tek sayılı hak grubu | Tek bay yalnız **toplam aktif tek** ise. Grup tek ise oyuncu komşu gruba float eder (maliyetle). | Tam uyumlu (davranış net) | `pairRound` `:230-233`; `floatDeltas` `:486-510` | — |
| **Belirsizlik:** çift toplam ama iki grup tek | Sistem **yalnız bir bay** verir (o da toplam tek ise). Çift toplamda ikinci bay **yok**; gruplar arası tek eşleşme yapılır. | Tam uyumlu (karar net: asla >1 bay) | `pairRound` tek-bay mantığı `:227-244` | İstenen metindeki belirsizliği sistem "gruplar arası eşleşme" lehine çözmüş; bu makul ve tutarlı. |
| Tekrar-kaçınma vs aynı-hak çatışması | **Tekrar-kaçınma önceliklidir** (maliyet ilk boyutu). | Tam uyumlu (metnin güçlü ifadesiyle) | `:356` | Standart federasyon Swiss'inden farklı ama istenen metne uygun. |

### 3. BYE seçimi

| Gereksinim | Mevcut davranış | Durum | Kod kanıtı | Eksik / risk |
|---|---|---|---|---|
| BYE almamış biri **rastgele** seçilmeli | Havuz = **tüm aktifler**. Öncelik: en az bay → en çok mağlubiyet → en az galibiyet → en eski bay turu → seed. **Deterministik (seed), rastgele değil.** | Kısmen uyumlu | `selectBye` `SwissEngine.php:263-286` | "En az bay" sayesinde bay'sız oyuncu önce gelir (kurala uygun), ama ek ölçütler (mağlubiyet/galibiyet) ve seed-determinizmi metinde yok. "Rastgele" değil, seed-sabit. |
| Herkes bay aldıysa biri ikinci kez | "En az bay" otomatik olarak en az bay'lıyı seçer; herkes 1 bay'lıysa yine seçer | Tam uyumlu | `:267-269` | İkinci bay yine seed-deterministik (rastgele değil). |
| BYE geçmişi korunmalı + sıralamada gösterilmeli | `byes` ve `byeRounds` state'te tutulur; `liveStandings` `byes` döner; **frontend tablosunda bay sütunu YOK**. | Kısmen uyumlu | tutma `:58,:156`; serialize `:576`; frontend başlıklar yalnız Oyuncu/Hak/Galibiyet/Mağlubiyet `Tournaments.tsx:772` | Bay sayısı saklanır ama kullanıcıya **gösterilmez**. |
| İkiden fazla bay durumu | Sistem **aynı turda birden fazla bay üretmez**; "ikiden fazla bay" durumu oluşmaz. | Tam uyumlu (tasarımla) | `:227-244` | — |
| BYE'nin istatistiklere yansıması | `wins++` (ilerleme galibiyeti), `realWins` **artmaz**, rakip geçmişi **artmaz**, mağlubiyet yok, oynanan maç sayılmaz. | Tam uyumlu (ayrım net) | `applyBye` `:150-162`; doküman `swiss-triple-elimination.md:19-22` | Frontend "galibiyet" sütunu bay+hükmeni de içerir (`wins`), gerçek maç galibiyeti (`realWins`) ayrı tutulsa da gösterilmez. |

### 4. Final etabı

| Gereksinim | Mevcut davranış | Durum | Kod kanıtı | Eksik / risk |
|---|---|---|---|---|
| Son iki oyuncuda haklar korunur | Hak sıfırlama yok; `pairRound` son ikiyi normal eşler | Tam uyumlu | test `test_last_two_lives_not_reset_and_needs_rematches:282` | — |
| Tek maçlık finale dönüştürülmez | Otomatik yarı-final/tek-maç/3.'lük **yok**; son iki, biri elenene kadar oynar | Tam uyumlu | `generateRound` `:146-149`; doküman `:24-28` | — |
| Biri hakkını tüketene kadar devam | `advanceIfRoundComplete` → `isComplete` olana dek yeni tur | Tam uyumlu | `SwissRuntime.php:109-127` | — |
| Örnek (A:2 hak, B:1 hak) | A kazanınca B 3. mağlubiyete ulaşır → elenir → A şampiyon tek maçta; B şampiyon için A'yı 2 kez yenmeli | Tam uyumlu | `applyResult`+`isComplete`; test `test_two_two_records_next_match_decides_champion:304` | — |
| Farklı haklı final = normal kuralın özel hâli | Son 2 de aynı Swiss+bay politikasıyla eşlenir | Tam uyumlu | `pairRound` ayrım yapmaz | — |
| Final hedef puanı / sonuç / sonraki maç / şampiyon ilanı | `activeCount ≤ 2` iken `final_length`/`final_minutes` uygulanır; başlamış maçın hedefi değişmez | Tam uyumlu | `:148-150`; test `:137` | — |

### 5. Turnuva sonu istatistikleri ve sıralama

| Gereksinim | Mevcut davranış | Durum | Kod kanıtı | Eksik / risk |
|---|---|---|---|---|
| Oynanan maç sayısı | Hesaplanmaz, gösterilmez (türetilebilir: `realWins+losses` ama yok) | **Eksik** | frontend tablo `Tournaments.tsx:772,775-789` | — |
| Galibiyet | `wins` gösterilir (bay+hükmen dahil). Gerçek galibiyet `realWins` ayrı ama gösterilmez | Kısmen uyumlu | `:785` | "Galibiyet" ilerleme galibiyetidir; kullanıcı bay/hükmeni ayırt edemez. |
| Mağlubiyet | Gösterilir | Tam uyumlu | `:786` | — |
| BYE sayısı | Saklanır+serialize edilir, **gösterilmez** | Kısmen uyumlu | `:576`, frontend başlıkta yok `:772` | — |
| Averaj | **Hiçbir yerde yok** (ne formül ne alan ne gösterim) | **Eksik** | tüm kod tabanında averaj/buchholz araması boş | İstenen metin formül vermiyor; sistem de hesaplamıyor. Formül **belirlenmeli**. |
| Turnuva sonu sırası | `finalStandings`: şampiyon 1., sonra elenme turu DESC (geç elenen üstte), aynı turda elenenler **ortak derece**; çekilen/DQ derecesiz | Tam uyumlu | `finalStandings` `:598-644` | Eşitlik çözümü: aynı elenme turu → ortak rank; düz listede seed ile sıralanır (ödül indeksinde önemli, bkz. risk). |

> Averaj formülü mevcut kodda **tanımsızdır** — uydurma yapılmadı.

### 6. Admin sıralama değiştirme

| Gereksinim | Mevcut davranış | Durum | Kod kanıtı | Eksik / risk |
|---|---|---|---|---|
| Admin sonu sıralamasını elle değiştirebilmeli | **Yok.** Admin yalnız `champion_id` seçebilir; 2./3./4.… sıra düzenlenemez. Sıralama `finalStandings`'ten her serptte yeniden hesaplanır. | **Eksik** | Form yalnız `champion_id` `TournamentResource.php:286-291`; sıralama hesaplanır `SwissEngine.php:598` (depolanmaz) | Elle override saklanacak yer yok; hesaplama **ezer**. Yetki/geçmiş/ödül etkisi N/A (özellik yok). `champion_id` elle değişirse standings/ödül ile **tutarsızlık** riski (ayrı not, aşağıda). |

### 7. Tur günleri ve saatleri

| Gereksinim | Mevcut davranış | Durum | Kod kanıtı | Eksik / risk |
|---|---|---|---|---|
| Tur gün/saatleri önceden planlanmalı | **Yok.** Yalnız `register_until` (turnuva başlama anı). Tur başına saat alanı yok. `round_gap_seconds` config'de tanımlı ama **hiç kullanılmıyor** (ölü config). | **Eksik** | `starts_at` = `register_until` `:1460-1463`; config `tournament.php:16`, kullanım araması boş | — |
| Aynı turun maçları birlikte başlamalı | Bir turun tüm hücreleri **aynı anda** üretilir; planlı saat **yok**, önceki tur bitince üretilir | Kısmen uyumlu | `generateRound` `:164-194` | Eşzamanlı üretim var; planlı saat yok. |
| Oyuncular o saatte otomatik odaya alınmalı | Saate bağlı oto-alma yok. Oyuncu `match-room`'u çağırır; frontend `TournMatchReady` hazır olunca oto-açar (bracket ile aynı). | Kısmen uyumlu | `matchRoom` `:912`; bracket ile ortak akış | Saat tetikli değil, "hazır olunca" tetikli. |
| Erken bitiren sonraki tura erken başlamamalı | Sonraki tur **tüm** maçlar bitene kadar ÜRETİLMEZ → erken başlama imkânsız | **Tam uyumlu** | `advanceIfRoundComplete` `:109-118` | Bu alt-kural kendiliğinden sağlanır (olumlu bulgu). |
| Çok günlük takvim sayfada gösterilmeli | Yalnız tek başlama saati gösterilir (Countdown) | **Eksik** | `Tournaments.tsx:438-440,1112-1114` | Tur-tur takvim yok. |
| Önceki tur uzarsa sonraki tur saati gelince ne olur? | Planlı saat olmadığından sorun oluşmaz; sonraki tur her hâlükârda önceki bitince üretilir | Gereksinim belirsiz / N/A | `:109` | Planlama eklenirse bu çatışma yeniden değerlendirilmeli. |
| Toplam tur önceden kesin değil | Turlar dinamik üretilir (1 kalana dek) — bu yapı "bilinmeyen tur sayısı"na zaten uygun | Tam uyumlu (yapısal) | `generateRound` döngüsü | Planlama eklenirse "plan yetmezse" davranışı tasarlanmalı. |

### 8. Premium, ödeme, onay, coin

| Gereksinim | Mevcut davranış | Durum | Kod kanıtı | Eksik / risk |
|---|---|---|---|---|
| Ücretli turnuva "premium" gösterilebilmeli | `premium_only` açıksa katılım yalnız `plan_active != 'free'`. Frontend "Premium" rozeti. | Tam uyumlu (ama anlamı farklı) | `join` kapısı `:188-193`; rozet `Tournaments.tsx:407,1218-1222` | — |
| "Premium" = etiket mi, üyelik şartı mı? | **Üyelik şartı.** `premium_only` planı 'free' olanı join'den **engeller** (403 `premium_required`). Ücret (`entry_fee`) ayrı alandır. | Tam uyumlu (açıklama) | `:188-193` | "Premium" bir plan şartıdır; "ücretli" değil. İkisi bağımsız. |
| Ödeme/onay almayan kuraya girmemeli | Ücret ödenmeden/plan uymadan `addPlayer` çağrılmaz; kura yalnız `players[]` üzerinden | Tam uyumlu | `join` atomik `:197-236`; başlatma `players`'tan | **Admin onayı ile dahil etme akışı YOK** (aşağı satır). |
| Admin onaylı oyuncu dahil edilebilmeli | **Yok.** Admin oyuncu ekleyemez (`players` Filament'te salt-okunur), onay/davet akışı yok. Yalnız DQ/çekilme/sıfırlama. **check-in yok** (dokümanda var, kodda yok). | **Eksik** | `players` disabled+dehydrated(false) `TournamentResource.php:270-277`; route listesinde check-in yok `routes/api.php:252-262`; `check-in` yalnız test yorumunda `TournamentParticipationTest.php:13` | Doküman `§11` yanıltıcı ("bağlandı" diyor, kod boş). |
| Ücretsiz/coin ile katılım | `entry_fee` tek alan: `0`=ücretsiz, `>0`=coin bedeli. Bracket ile **aynı** yapı. | Tam uyumlu | `entry_fee` `:141,:335-341`; `join` `:213-230` | — |
| Ücretsiz (0) ile coin-bedelli ayrı seçenek mi? | **Ayrı değil** — tek `entry_fee` alanı (0 veya pozitif). | Kısmen uyumlu (tek alan) | `:335-341` | Metindeki "ayrı mı" sorusunun cevabı: tek alanla modellenmiş. |
| Çift katılım / çift coin düşme | Satır kilidi (`lockForUpdate`) + "zaten kayıtlı" kontrolü → idempotent | Tam uyumlu | `:197-212`, `addPlayer` `:1191-1211` | — |
| Katılım iptali / turnuva iptali | Leave (yalnız açıkken) iade eder; reset/delete/finish ödenmemişse `refundAll` | Tam uyumlu | `leave` `:256-279`; `refundAll` `:231,:1012,:1057` | — |
| Katıl/ayrıl döngüsü istismarı | Ücret `fee_paid` ile kayıt başına izlenir; iade doğru; `tournaments_played` sayacı düzeltilir | Tam uyumlu | `:231,:270-271,:1205` | — |

---

## 1) Kritik hatalar ve yanlış şampiyon/eleme/ödeme riskleri

Çekirdekte **yanlış şampiyon/eleme üreten doğrulanmış bir hata bulunamadı** — idempotency ve otorite zinciri sağlam. Aşağıdakiler kod kanıtlı sınırlamalar + olası risklerdir:

1. **(Doğrulanmış kısıt, kritik ürün açığı)** Hak sayısı 3'e sabit (`SwissEngine.php:27`). 1 veya 2 haklı turnuva kurmaya çalışırsanız yine 3 hak uygulanır — eleme ve şampiyon **istenen kuraldan sapar**. Yanlış sonuç değil ama **yanlış kural**.
2. **(Olası risk) `champion_id`'nin Filament'te elle değiştirilmesi** standings ve ödülü yeniden hesaplamaz/yeniden ödemez. Biten bir turnuvada admin şampiyonu değiştirirse gösterilen şampiyon ile `swiss_state`'ten hesaplanan sıralama/ödül **tutarsız** kalır. (`TournamentResource.php:286`; `payPrizes` `prize_paid` ile kilitli `SwissRuntime.php:234`.) Koddan görülen risk; canlı tetiklenme test edilmedi.
3. **(Olası risk) Ödül indeksi eşitlikte keyfi.** `payPrizes` düz `standings()` listesini kullanır; aynı turda elenen (ortak dereceli) oyuncular listede **seed** sırasına göre sıralanır (`finalStandings:611-612`). Ödül tablosunda eşit dereceler için farklı coin tanımlıysa, hangi oyuncuya hangi coin gittiği **keyfi** olur. (`SwissRuntime.php:280-295, 242-277`.)
4. **(Olası risk) >14 kişilik gruplarda sezgisel eşleştirme optimal değil** (`SwissEngine.php:417-419,436`). Önlenebilir tekrar-rakip veya kötü float üretebilir; `optimal=false` olarak `reports[]`'a yazılır ama engellenmez. Büyük aynı-hak gruplarında (ör. ilk turlarda 16+ oyuncu 0 mağlubiyetliyken) gerçekleşebilir.

> Not: Zaman aşımı/hükmen akışı normal sonuçlarla tutarlı işlenir — tek taraf gelirse walkover (gerçek maç sayılmaz, hak düşer), kimse gelmezse çift mağlubiyet (`resolveStalledSwiss` `:589-659`). Çift mağlubiyette ikisi de elenirse `note='no_champion'` + ücret iadesi (`SwissRuntime.php:226-233`).

## 2) Eksik özellikler

- **Hak sayısı seçimi (1/2/3).** [en kritik]
- **Averaj** hesabı ve gösterimi (formül de tanımlanmalı).
- **Admin elle sıralama değiştirme** (depolama + hesaplamanın ezmemesi + yetki/geçmiş).
- **Tur gün/saat planlaması** + çok günlük takvim gösterimi + saate bağlı oto-odaya-alma.
- **Admin onayı/daveti ile katılım** ve **check-in** (dokümanda var, kodda yok).
- **İstatistik gösterimi:** oynanan maç sayısı ve bay sayısı sütunları (veri var, UI yok).

## 3) Karar verilmesi gereken belirsiz kurallar

1. **Averaj formülü** — metinde yok, kodda yok. Tanımlanmalı (ör. gerçek maç galibiyet oranı mı, rakip-gücü/Buchholz mü, puan averajı mı?).
2. **BYE seçiminde "rastgele" mi, deterministik mi?** Mevcut: seed-deterministik + ek ölçütler. İstenen "rastgele". Hangisi kalacak?
3. **Çift toplam + iki tek grup** — mevcut: gruplar arası eşleşme, asla ikinci bay. İstenen metin bunu "mevcut davranışı raporla" diyordu; onaylanırsa kural netleşir.
4. **Eşitlikte ödül/sıra kırma** — ortak derecelerde coin ve nihai sıra nasıl bölünecek?
5. **Tur planlaması eklenirse** "önceki tur uzarsa sonraki tur saati gelince" ve "planlanan turlar yetmezse" davranışı tanımlanmalı (şu an dinamik, saatsiz).

## 4) Kod değiştirmeden izlenen örnek senaryolar (beklenen / mevcut)

1. **1 veya 2 haklı turnuva** — *Beklenen:* 1/2 mağlubiyette eleme. *Mevcut:* seçenek yok; her zaman 3 hak (`MAX_LIVES=3`). **Uyumsuz.**
2. **3 haklı, 8 oyuncu (çift)** — *Beklenen:* bay yok, tek oyuncu kalana dek. *Mevcut:* doğru (test `SwissTournamentTest.php:115`). **Uyumlu.**
3. **Tek katılımcı sayısı (ör. 7)** — *Beklenen:* 1 bay. *Mevcut:* tam bir bay hücresi (`:99` test). **Uyumlu.**
4. **Çift toplam, iki tek hak grubu** — *Beklenen (metin belirsiz):* ya 2 bay ya gruplar arası. *Mevcut:* ikinci bay yok, gruplar arası float. **Davranış net; onay gerek.**
5. **Zorunlu tekrar-rakip** — *Beklenen:* kilitlenmeden tekrar. *Mevcut:* doğru (`:220`). **Uyumlu.**
6. **Herkes bay almış** — *Beklenen:* biri ikinci bay. *Mevcut:* "en az bay" ile en az bay'lı seçilir (seed-deterministik). **Davranışsal uyumlu, "rastgele" değil.**
7. **Farklı haklı final (A:2, B:1)** — *Beklenen:* A 1 galibiyetle, B 2 galibiyetle şampiyon. *Mevcut:* doğru (`:282,:304`). **Uyumlu.**
8. **Önceki turun uzaması** — *Beklenen:* sonraki tur başlamamalı. *Mevcut:* sonraki tur tüm maçlar bitene kadar üretilmez. **Uyumlu (saatsiz).**
9. **Çok günlük takvim** — *Beklenen:* tur tarihleri sayfada. *Mevcut:* yalnız başlama saati. **Eksik.**
10. **Tekrar gelen maç sonucu** — *Beklenen:* ikinci işleme yok. *Mevcut:* `winner`/`double_loss` dolu hücre idempotent atlanır (`SwissRuntime.php:80`; test `:274`). **Uyumlu.**
11. **Tekrar gelen ödeme/çift katılım** — *Beklenen:* tek tahsil. *Mevcut:* satır kilidi + kayıt kontrolü. **Uyumlu.**

## 5) Düzeltme önerileri ve öncelik sırası

**P0 (ürün kuralı — temel):**
- `MAX_LIVES` sabitini **turnuva başına kilitli config'e** taşı (`swiss_state.config.max_lives`, 1/2/3). `remainingLives/applyResult/applyDoubleLoss/serialize` ve frontend `maxLives` bu değeri okusun. Admin formuna "Hak sayısı (1/2/3)" Select'i ekle. (`SwissEngine.php:27,78-81,119,137`; `SwissRuntime.php:32-40,316`; `TournamentResource.php` form.)

**P1 (eksik ana özellikler):**
- **Averaj**: önce formülü karara bağla, sonra `liveStandings/finalStandings`'e alan + frontend sütunu ekle. Oynanan maç ve bay sütunlarını da ekle (veri hazır: `wins/realWins/losses/byes`).
- **Admin elle sıralama**: `swiss_state`'e opsiyonel `manual_rank[]` override alanı; `finalStandings` doluysa onu baz alıp tutarlı yeniden-numaralandırsın (çakışma/boşluk olmadan); ödül dağıtımı override'ı kullansın; yetki (admin) + değişiklik logu.

**P2 (planlama):**
- **Tur gün/saat planı**: turnuvaya tur-tur zaman çizelgesi; `generateRound` üretse de maç odası/oto-giriş `opens_at` ile gate'lensin (bracket final gate deseni `applyWinnerToBracket:428` zaten örnek). Frontend'de takvim göster. `round_gap_seconds` ölü config'ini ya kullan ya kaldır.

**P3 (katılım/onay + temizlik):**
- **Admin onayı/daveti ile ekleme** + **check-in** (ya gerçekten uygula ya doküman `§11`'i gerçekle eşitle).
- `champion_id`'nin elle değişiminde standings/ödül tutarlılığını koru (ya salt-okunur yap ya yeniden-hesapla).
- Ödül eşitlik-kırma kuralını netleştir (`payPrizes` düz liste + seed).

---

**Özet:** Çekirdek Swiss mantığı (eleme, final, bay, eşleştirme, idempotency, ödeme) doğru ve test kanıtlı. İstenen ürünün farkı büyük ölçüde **yapılandırılabilirlik ve sunum katmanında**: hak sayısı sabit, averaj yok, admin sıralama/onay yok, tur planlaması yok, bazı istatistikler gösterilmiyor. Doküman `swiss-triple-elimination.md §11`'in "check-in bağlandı" ifadesi **gerçeği yansıtmıyor** — kodda yok.
