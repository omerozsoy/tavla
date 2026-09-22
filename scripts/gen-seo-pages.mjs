/**
 * gen-seo-pages.mjs — SEO icerik sayfalarinin HTML govdelerini uretip
 * backend/database/data/seo-pages.json dosyasina yazar.
 *
 * Calistirma (tsx ile — .ts kaynaklarini dogrudan import eder):
 *   npx tsx scripts/gen-seo-pages.mjs
 *
 * Kaynaklar (metinler BIREBIR buradan alinir):
 *   - src/data/guides.ts            -> rehber yazilari (tavla-rehberi/<slug>)
 *   - src/data/tournamentRules.ts   -> turnuva-kurallari (WBF)
 *   - Rules CONTENT.tr (asagida gomulu, src/ui/Rules.tsx ile birebir) -> nasil-oynanir
 *   - Landing metinleri (asagida gomulu, src/ui/SeoContent.tsx ile birebir) -> online-tavla / tavla-oyna
 *
 * Uretilen body = temiz HTML (<h2>/<h3>/<p>/<ul><li>/<a href>); kart/TOC YOK (duz metin).
 * title + seo_title + seo_description mevcut SEO_TITLES/SEO_DESCS ile tutarli.
 *
 * Cikti: firstOrCreate ile seed edilecek JSON dizisi:
 *   [{ slug, title, seo_title, seo_description, body, sort }, ...]
 * (published + firstOrCreate davranisi PHP komutunda; JSON yalniz veri tasir.)
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
// Windows'ta mutlak yol import'u file:// URL ister -> pathToFileURL ile sar.
const imp = (rel) => import(pathToFileURL(resolve(ROOT, rel)).href)

const { GUIDES } = await imp('src/data/guides.ts')
const { TOURNAMENT_RULES, RULE_COMMENTS, RULE_EDITION } = await imp('src/data/tournamentRules.ts')

// ---- SEO meta (App.tsx SEO_TITLES / SEO_DESCS ile birebir) ----------------------
const SEO_TITLES = {
  'online-tavla': 'Online Tavla Oyna - Ücretsiz Canlı Tavla | TavlaTv',
  'tavla-oyna': 'Tavla Oyna - Ücretsiz Bedava Tavla Oyunu | TavlaTv',
  'tavla-turnuvasi-organizasyonu': 'Tavla Turnuvası Organizasyonu | Kurumsal, Belediye, AVM | TavlaTv',
  'kurumsal-tavla-turnuvasi': 'Kurumsal Tavla Turnuvası Organizasyonu | TavlaTv',
  'belediye-tavla-turnuvasi': 'Belediye Tavla Turnuvası Organizasyonu | TavlaTv',
  'avm-tavla-turnuvasi': 'AVM Tavla Turnuvası Organizasyonu | TavlaTv',
  'iletisim': 'İletişim | TavlaTv',
  'nasil-oynanir': 'Tavla Nasıl Oynanır? Kurallar ve Rehber | TavlaTv',
  'turnuva-kurallari': 'Tavla Turnuva Kuralları (WBF) — Resmî Kurallar | TavlaTv',
  'tavla-rehberi/tavla-acilis-stratejileri': 'Tavla Açılış Stratejileri: En İyi İlk Hamleler | TavlaTv',
  'tavla-rehberi/tavla-kupu-doubling-cube': 'Tavla Küpü (Doubling Cube) Nedir, Nasıl Kullanılır? | TavlaTv',
  'tavla-rehberi/tavla-kazanma-taktikleri': 'Tavla Kazanma Taktikleri ve İpuçları | TavlaTv',
  'tavla-rehberi/mars-gammon-backgammon-nedir': 'Mars (Gammon) ve Backgammon Nedir? | TavlaTv',
}
const SEO_DESCS = {
  'online-tavla':
    'Ücretsiz online tavla oyna! Gerçek rakiplere karşı canlı maçlar, güçlü yapay zekâ botu, turnuvalar ve maç analizi (PR). Kayıt gerektirmez, tarayıcıda hemen başla.',
  'tavla-oyna':
    'Bedava tavla oyna! Ücretsiz, kayıtsız ve tarayıcıda anında açılan tavla oyunu. Yapay zekâya karşı pratik yap, arkadaşınla veya gerçek rakiplerle online tavla oyna.',
  'tavla-turnuvasi-organizasyonu':
    'Kurumlar, belediyeler ve AVM’ler için anahtar teslim tavla turnuvası organizasyonu. Format kurgusu, hakemlik, dijital eşleşme tabloları ve ödül töreni dahil. Teklif alın.',
  'kurumsal-tavla-turnuvasi':
    'Şirketiniz için kurumsal tavla turnuvası organizasyonu: takım ruhu ve çalışan bağlılığı için anahtar teslim etkinlik. Ofiste, otelde veya hibrit online. Teklif alın.',
  'belediye-tavla-turnuvasi':
    'Belediyeler için kitlesel katılımlı tavla turnuvası organizasyonu: festival, Ramazan ve kültür etkinlikleri. Dijital kayıt, hakemlik ve ödül töreni dahil. Teklif alın.',
  'avm-tavla-turnuvasi':
    'AVM’ler için ziyaretçi çeken tavla turnuvası organizasyonu: sahne kurulumu, sponsorluk ve canlı skor ekranları. Marka etkileşimi yaratan etkinlik. Teklif alın.',
  'iletisim':
    'TavlaTV ile iletişime geçin: turnuva organizasyonu, sponsorluk, iş birliği ve sorularınız için bize yazın. En kısa sürede size dönüş yapalım.',
  'nasil-oynanir':
    'Tavla nasıl oynanır? Kurallar, açılış dizilimi, zar ve pul hareketleriyle yeni başlayanlar için tavla rehberi.',
  'turnuva-kurallari':
    'WBF (Dünya Tavla Federasyonu) Uluslararası Tavla Turnuva Kuralları: format, süre, zar ve küp kuralları, kural dışı hareketler ve anlaşmazlıkların çözümü. Resmî ve eksiksiz Türkçe kural metni.',
  'tavla-rehberi/tavla-acilis-stratejileri':
    'Tavla açılış stratejileri: her zar atışı için en iyi ilk hamleler, 5-nokta ve bar-nokta yapma, blot bırakma riskleri ve yeni başlayanlar için pratik ipuçları.',
  'tavla-rehberi/tavla-kupu-doubling-cube':
    'Tavla küpü (doubling cube) nedir, nasıl kullanılır? Katlama, kabul (take) ve pas (drop) kararları, Crawford kuralı ve doğru zamanlama ile küp stratejisi rehberi.',
  'tavla-rehberi/tavla-kazanma-taktikleri':
    'Tavla kazanma taktikleri: blot bırakmama, kilit ve prime kurma, pip sayımı, yarış ve tutma oyunu ile küp kullanımı. Oyununu geliştirecek pratik ipuçları.',
  'tavla-rehberi/mars-gammon-backgammon-nedir':
    'Mars (gammon) ve backgammon nedir? Tekli, mars ve backgammon galibiyetlerinin puan değerleri, küp çarpanı ve bu büyük galibiyetleri kazanma/önleme taktikleri.',
}
// Admin "Baslik" alani: kisa, temiz sayfa basligi (title suffix'siz).
const PAGE_TITLES = {
  'online-tavla': 'Online Tavla Oyna',
  'tavla-oyna': 'Tavla Oyna',
  'tavla-turnuvasi-organizasyonu': 'Tavla Turnuvası Organizasyonu',
  'kurumsal-tavla-turnuvasi': 'Kurumsal Tavla Turnuvası',
  'belediye-tavla-turnuvasi': 'Belediye Tavla Turnuvası',
  'avm-tavla-turnuvasi': 'AVM Tavla Turnuvası',
  'iletisim': 'İletişim',
  'nasil-oynanir': 'Tavla Nasıl Oynanır?',
  'turnuva-kurallari': 'Tavla Turnuva Kuralları',
  'tavla-rehberi/tavla-acilis-stratejileri': 'Tavla Açılış Stratejileri: En İyi İlk Hamleler',
  'tavla-rehberi/tavla-kupu-doubling-cube': 'Tavla Küpü (Doubling Cube) Nedir, Nasıl Kullanılır?',
  'tavla-rehberi/tavla-kazanma-taktikleri': 'Tavla Kazanma Taktikleri ve İpuçları',
  'tavla-rehberi/mars-gammon-backgammon-nedir': 'Mars (Gammon) ve Backgammon Nedir?',
}

// ---- HTML yardimcilari -----------------------------------------------------------
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const h2 = (s) => `<h2>${esc(s)}</h2>`
const h3 = (s) => `<h3>${esc(s)}</h3>`
// Paragraf: guides.ts icindeki HTML (a/strong/em) zaten guvenli -> oldugu gibi birak.
const pHtml = (s) => `<p>${s}</p>`
const pText = (s) => `<p>${esc(s)}</p>`
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`

function join(...parts) {
  return parts.filter(Boolean).join('\n')
}

// ---- Landing govdeleri (SeoContent.tsx ile birebir metin) ------------------------
function onlineTavlaBody() {
  return join(
    pText(
      'Bilgisayarını ya da telefonunu aç, tarayıcıdan gir ve saniyeler içinde online tavla oynamaya başla. TavlaTV; gerçek rakiplere karşı canlı maçlar, güçlü yapay zekâ botu, turnuvalar ve maç analizi sunan ücretsiz bir online tavla platformudur.',
    ),
    h2('Online tavla nedir?'),
    pText(
      'Online tavla, klasik masa tavlasının internet üzerinden, uzaktaki oyuncularla veya bilgisayara karşı oynanan halidir. Fiziksel bir tahtaya, zara ya da karşında oturan bir rakibe ihtiyaç duymadan, dünyanın her yerinden insanlarla eşleşebilirsin. Zar atışları sunucu tarafında güvenli rastgelelikle (CSPRNG) üretilir; yani atışlar şeffaf ve adildir. Tahta otomatik kurulur, kurallar oyunun içinde uygulanır ve geçersiz hamlelere izin verilmez — bu sayede kurallara boğulmadan yalnızca oyuna odaklanırsın.',
    ),
    pText(
      'Geleneksel tavlanın tüm heyecanı korunur: aynı on beş taş, aynı zarlar, aynı ev ve bar mantığı. Değişen tek şey mekân; kahvehane masası yerine ekranın var. Bu da tavlayı her zamankinden daha erişilebilir kılar. İşte molasında, akşam evinde ya da yolda beklerken birkaç dakikanı ayırıp keyifli bir maç oynayabilir; canın istediğinde uzun, puanlı bir karşılaşmaya girişebilirsin. Rakip bulmak için kimseyi ikna etmene gerek yoktur; her an çevrimiçi onlarca oyuncu seninle eşleşmeyi bekler.',
    ),
    h2('Nasıl başlanır?'),
    pText(
      "TavlaTV'de online tavla oynamak için karmaşık bir sürece gerek yok. Uygulama indirmez, kurulum yapmazsın; her şey tarayıcında çalışır. Adımlar oldukça basittir:",
    ),
    ul([
      'Siteye gir; misafir olarak dahi anında <a href="/yeni-oyun">yeni bir maç</a> kurabilirsin.',
      'Rakip tercihini yap: gerçek bir oyuncuya karşı canlı maç, yapay zekâya karşı pratik ya da arkadaşınla özel oda.',
      'Maç uzunluğunu (tek oyun veya hedef puan), süre kontrolünü ve küp (doubling) ayarını seç.',
      'Zarını at, taşlarını sürükle ve tüm pullarını evine getirip topla — ilk toplayan kazanır.',
    ]),
    pHtml(
      'Kuralları hatırlaman gerekiyorsa <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberimiz açılış dizilimini, zar hareketini, vurma-girme ve toplama (bear off) aşamalarını sade bir dille anlatır.',
    ),
    h2('Öne çıkan özellikler'),
    pText(
      'TavlaTV yalnızca bir oyun ekranı değil; tavlanı geliştirebileceğin kapsamlı bir ortamdır. Farklı oyun modları ve araçlar sayesinde hem eğlenir hem gelişirsin.',
    ),
    ul([
      '<strong>Arkadaşınla oyna:</strong> Özel bir davet kodu oluştur, arkadaşını çağır ve <a href="/arkadasinla-oyna">birlikte online tavla</a> keyfi yaşa. Süre ve puan ayarlarını birlikte belirlersiniz.',
      '<strong>Yapay zekâya karşı:</strong> Sinir ağı tabanlı <a href="/yz-ile-oyna">tavla botuna karşı</a> oyna. Seviyeni ayarla, rakibin gücünü kendine göre belirle ve baskı altında oynamayı öğren.',
      '<strong>Turnuvalar:</strong> <a href="/online-turnuvalar">Online tavla turnuvalarına</a> katıl, eleme tablolarında ilerle ve ödüller için yarış.',
      '<strong>Analiz ve PR:</strong> Her maçtan sonra hamlelerinin en iyi oynanışa ne kadar yakın olduğunu gösteren performans reytingini (PR) görürsün. Küp kararlarını ve en kötü hamlelerini inceleyerek somut şekilde gelişirsin.',
    ]),
    h2('Online tavla stratejisi ve ipuçları'),
    pText(
      'Online tavlada başarı, sadece iyi zar atmakla ilgili değildir; zarın verdiğini en iyi şekilde değerlendirmekle ilgilidir. İyi bir oyuncu, taşlarını güvende tutar, açıkta tek (blot) bırakmamaya çalışır ve rakibinin evine giriş kapılarını kapatarak onu barda bekletmeyi hedefler. Kilit noktaları (özellikle kendi 5 ve 7 haneni) yapmak, hem savunmanı güçlendirir hem de rakibinin ilerlemesini yavaşlatır.',
    ),
    pText(
      "Küp (doubling cube) kullanımı da online tavlada oyunun kaderini belirleyen kritik bir karardır. Kazanma yüzden yüksekken küpü teklif etmek, rakibini ya riskli bir devam ya da puan kaybıyla çekilme arasında bırakır. TavlaTV'nin oyun içi küp danışmanı, kazanma oranına göre katla, kabul et veya çekil önerileriyle bu kararları öğrenmene yardımcı olur. Zamanla pip sayımı, yarış (race) ile tutma (holding) oyunlarını ayırt etmeyi ve pozisyona göre strateji değiştirmeyi kavrarsın.",
    ),
    h2('Neden TavlaTV?'),
    pText(
      'Piyasada birçok tavla sitesi var; ancak TavlaTV, adil oyun ve gelişim odaklı yaklaşımıyla ayrışır. Zarların kanıtlanabilir şekilde rastgele üretilmesi, hile ve manipülasyona karşı güven verir. Ücretsiz olması, oynamak için cebinden para çıkmayacağı anlamına gelir; reklamların dengeli kullanımı ise oyun akışını bozmaz. En önemlisi, oynadıkça öğrenmeni sağlayan analiz araçları sayesinde tavlan gerçekten ilerler. Modern ve mobil uyumlu arayüzü, hem masaüstünde hem telefonda akıcı bir deneyim sunar; böylece nerede olursan ol online tavla oynayabilirsin.',
    ),
    pText(
      'Ayrıca canlı maçlarda süre kontrolü, puanlı (rating) eşleşmeler ve maç sonu analizler bir arada sunulur. Rating sistemi, seni kendi seviyene yakın rakiplerle eşleştirir; böylece ne sürekli ezilir ne de kolay maçlarda sıkılırsın. Lider tablosunda yükselmek, rozet ve başarımlar kazanmak ise oynamaya devam etmen için ekstra motivasyon sağlar.',
    ),
    pText(
      "Kısacası TavlaTV; hızlı bir maç arayan sıradan oyuncudan, PR'ını düşürmeye çalışan ciddi rakibe kadar herkes için tasarlanmıştır. İster molada tek oyunluk keyif ister uzun soluklu puanlı maçlar dilersin, hepsi burada.",
    ),
    h2('Tavla türleri ve maç modları'),
    pText(
      'Online tavlada tek bir oynanış yoktur; keyfine ve zamanına göre farklı formatlar seçebilirsin. Tek oyunluk (money game) maçlar hızlıdır: bir oyun oynar, sonucu alır ve devam edersin. Puanlı maçlarda ise belirli bir hedef puana (örneğin 3, 5 veya 7 puan) ilk ulaşan kazanır; bu format küpün ve stratejinin çok daha önemli olduğu, daha derin bir deneyim sunar.',
    ),
    pText(
      'Süre kontrolü de deneyimini şekillendirir. Hızlı süre limitleri tempoyu yükseltir ve seni çabuk karar vermeye zorlar; daha uzun süreler ise her hamleyi enine boyuna düşünmene imkân tanır. Bunların yanında geleneksel tavlanın mars (gammon) ve backgammon gibi ekstra puanlı kazanma türleri de tam olarak uygulanır — yani rakibini iyice geride bırakırsan tek maçta birden fazla puan alabilirsin. Tüm bu ayarları maç kurulumundan kendine göre belirlersin.',
    ),
    h2('Sık sorulan sorular'),
    h3('Online tavla ücretsiz mi?'),
    pText(
      "Evet. TavlaTV'de online tavla tamamen ücretsizdir ve oynamaya başlamak için ödeme yapmana gerek yoktur. Dilersen Premium üyelikle gelişmiş analiz ve reklamsız deneyim gibi ekstralara sahip olabilirsin.",
    ),
    h3('Kayıt olmadan online tavla oynayabilir miyim?'),
    pText(
      'Evet, misafir olarak anında oynayabilirsin. Ancak rating, maç geçmişi ve turnuvalar gibi özelliklerden yararlanmak için ücretsiz bir hesap oluşturman önerilir.',
    ),
    h3('Zarlar adil mi?'),
    pText(
      'Zar atışları sunucu tarafında güvenli rastgelelik (CSPRNG) ile üretilir ve kanıtlanabilir adildir. Hiçbir oyuncu zar sonuçlarını değiştiremez.',
    ),
    h3('Mobil cihazdan oynanır mı?'),
    pText(
      'Kesinlikle. TavlaTV mobil uyumludur; telefon ve tabletlerde tarayıcı üzerinden herhangi bir uygulama indirmeden çalışır.',
    ),
  )
}

function tavlaOynaBody() {
  return join(
    pText(
      'Ücretsiz, kayıt gerektirmeyen ve tarayıcıda anında açılan bir platformda tavla oyna. TavlaTV; yeni başlayanlar için sade bir başlangıç, tecrübeli oyuncular için ise puanlı maçlar, turnuvalar ve derin analiz sunan bir bedava tavla oyunudur.',
    ),
    h2('Tavla nasıl bir oyun?'),
    pText(
      "Tavla, iki oyuncunun on beşer taşla oynadığı, hem şans hem stratejinin birlikte belirleyici olduğu klasik bir masa oyunudur. Amaç, tüm taşlarını kendi ev bölgene getirip tahtadan ilk toplayan (bear off) oyuncu olmaktır. Zarlar şansı; hangi taşı nasıl oynayacağın ise stratejiyi temsil eder. İşte bu denge, tavlayı yüzyıllardır sevilen ve her oyunu farklı kılan bir oyun yapar. TavlaTV'de tahta otomatik kurulur, kurallar oyunun içinde uygulanır; sen yalnızca zarını atıp en iyi hamleyi düşünmeye odaklanırsın.",
    ),
    pText(
      'Tavlanın en güzel yanı, hem çabuk öğrenilmesi hem de ustalaşmasının uzun yıllar almasıdır. Kuralları birkaç dakikada kavrarsın; ama zar olasılıklarını hesaplamayı, doğru anda risk almayı ve rakibinin planını bozmayı öğrenmek bir ömür sürebilir. Her maç yeni bir bulmaca gibidir: aynı zar, farklı pozisyonlarda tamamen farklı hamleler gerektirir. Bu yüzden tavla asla sıkıcı gelmez; her oyunda öğrenecek yeni bir şey bulursun.',
    ),
    h2('Nasıl tavla oynanır?'),
    pText('Tavla oynamaya başlamak sandığından çok daha kolaydır. Temel akış şöyle işler:'),
    ul([
      'Sıra sende iki zar atarsın; her zar bir taşın kaç hane ilerleyeceğini gösterir.',
      'İki farklı taşı ayrı ayrı oynayabilir ya da uygunsa tek taşı iki zarın toplamı kadar ilerletebilirsin.',
      'Aynı sayıyı atarsan (çift) o değeri dört kez oynarsın.',
      'Rakibin tek taşı olan haneye gelirsen onu vurursun; vurulan taş bara gider ve yeniden girmesi gerekir.',
      'Tüm taşların evine ulaşınca toplamaya başlarsın; hepsini ilk toplayan oyunu kazanır.',
    ]),
    pHtml(
      'Daha ayrıntılı bir anlatım için <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberimize göz atabilirsin. Orada açılış dizilimi, küp (doubling cube), mars/gammon ve backgammon gibi kazanma türleri örneklerle açıklanır.',
    ),
    h2('Nerede ve kime karşı oynayabilirsin?'),
    pText('TavlaTV birden fazla oyun modu sunar; ruh hâline ve hedefine göre seçim yaparsın.'),
    ul([
      '<strong>Yapay zekâya karşı:</strong> Sinir ağı tabanlı <a href="/yz-ile-oyna">tavla botuyla</a> pratik yap. Seviyeyi ayarlayarak kendini yavaş yavaş zorlayabilirsin.',
      '<strong>Gerçek rakiplerle:</strong> <a href="/online-tavla">Online tavla</a> maçlarında dünyanın dört bir yanından oyuncularla eşleş, puanlı karşılaşmalar yap.',
      '<strong>Arkadaşınla:</strong> <a href="/arkadasinla-oyna">Özel oda</a> kur, davet kodunu paylaş ve dilediğin ayarlarla keyifli maçlar oyna.',
      '<strong>Turnuvalarda:</strong> <a href="/online-turnuvalar">Turnuvalara</a> katılıp eleme tablolarında yükselerek rekabetin tadını çıkar.',
    ]),
    h2('Tavlanı geliştir'),
    pText(
      'Tavla oynamak keyifli olduğu kadar gelişime de açıktır. TavlaTV, oynadığın her maçtan bir ders çıkarmanı sağlayan araçlar sunar. Maç sonunda gördüğün performans reytingi (PR), hamlelerinin en iyi oynanışa ne kadar yakın olduğunu ölçer; düşük PR daha iyi oyun demektir. Küp kararlarını, en kritik hamlelerini ve şans-beceri dengesini inceleyerek nerede geliştiğini somut olarak görürsün. Böylece tavla, sadece bir eğlence değil, üzerinde çalıştıkça ilerlediğin gerçek bir beceri hâline gelir.',
    ),
    pText(
      'Kendi oyununu analiz etmenin yanında, güçlü tavla botuna karşı düzenli pratik yapmak da beceri kazanmanın en etkili yollarından biridir. Botun seviyesini kademeli olarak artırarak kendini zorlar, farklı pozisyonlarda doğru hamleleri içgüdüsel hâle getirirsin. Zamanla pip sayımı yapmayı, yarış ile temas oyunlarını ayırt etmeyi ve küpü doğru anda kullanmayı öğrenirsin. Rating sistemi ise gelişimini rakamlarla takip etmeni sağlar; puanının yükseldiğini görmek, çalışmanın karşılığını aldığını hissettiren güçlü bir motivasyondur.',
    ),
    h2('Yeni başlayanlar için tavla ipuçları'),
    pText(
      'Tavlaya yeni başlıyorsan birkaç basit prensip oyununu hızla iyileştirir. Öncelikle taşlarını yalnız (blot) bırakmamaya çalış; açıkta kalan tek taş, rakip tarafından vurulabilir ve baştan girmek zorunda kalırsın. İkinci olarak, kendi ev bölgende kilit noktalar (özellikle 5 hane) kurmaya öncelik ver; bu hem savunmanı güçlendirir hem rakibi zorlar.',
    ),
    pText(
      "Zarını attıktan sonra acele etme; iki farklı hamle kombinasyonunu kafanda deneyip hangisinin seni daha güvenli bir pozisyona taşıdığını düşün. Yarıştaysan (her iki taraf da birbirini geçmişse) hız önemlidir, taşlarını hızla eve taşırsın; ama temas varken güvenlik ön plandadır. En önemlisi, kaybettiğin maçlardan ders çıkar: TavlaTV'nin maç analizi, hangi hamlenin daha iyi olacağını sana açıkça gösterir. Bu geri bildirim döngüsü, gelişimin en hızlı yoludur.",
    ),
    h2("Neden TavlaTV'de tavla oynamalısın?"),
    pText(
      'Bedava tavla oynamak isteyen herkes için TavlaTV güçlü bir seçenektir. Ücretsizdir; oynamak için para ödemez, kredi kartı bilgisi girmezsin. Kayıt zorunlu değildir; misafir olarak anında başlayabilir, istersen sonradan ücretsiz hesap açarsın. Zarlar kanıtlanabilir şekilde adildir, arayüz modern ve mobil uyumludur, kurallar oyunun içinde otomatik uygulanır. Kısaca hem yeni başlayanlar hem de deneyimli oyuncular için doğru adres burasıdır.',
    ),
    h2('Kazanma türleri: tekli, mars ve backgammon'),
    pText(
      'Tavlada her galibiyet aynı değerde değildir; ne kadar üstün bittiğine göre puan değişir. Rakip en az bir taşını toplayabildiyse normal (tekli) galibiyet alırsın ve oyun bir puan değerindedir. Rakip hiç taş toplayamadan oyunu bitirirsen bu bir mars (gammon) olur ve iki puan kazanırsın.',
    ),
    pText(
      "En görkemli sonuç ise backgammon'dur: rakip hiç taş toplayamadığı gibi, hâlâ barda ya da senin ev bölgende taşı varsa, üç puanlık bir zafer elde edersin. Bir de küp (doubling cube) devreye girdiğinde bu puanlar katlanır. İşte tam da bu yüzden tavlada yalnızca kazanmak değil, ne kadar farkla kazandığın da önemlidir. TavlaTV bu türlerin hepsini otomatik olarak hesaplar; sen sadece en iyi sonucu kovalamaya odaklanırsın.",
    ),
    h2('Sık sorulan sorular'),
    h3('Tavla oynamak ücretsiz mi?'),
    pText(
      "Evet. TavlaTV'de tavla oynamak tamamen bedavadır. Dilersen Premium üyelikle ekstra analiz ve reklamsız deneyim gibi ayrıcalıklara sahip olabilirsin.",
    ),
    h3('Yeni başlayanlar için uygun mu?'),
    pHtml(
      'Kesinlikle. Kurallar oyunun içinde uygulandığı için hata yapmadan öğrenirsin. Ayrıca <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberimiz her adımı sade bir dille anlatır.',
    ),
    h3('Tek başıma tavla oynayabilir miyim?'),
    pText(
      'Evet. Yapay zekâ botuna karşı tek başına oynayarak pratik yapabilir, açılışları ve farklı stratejileri deneyebilirsin.',
    ),
    h3('İnternet olmadan tavla oynanır mı?'),
    pText(
      'TavlaTV canlı maçlar, turnuvalar ve analiz için internet bağlantısı gerektirir. Botla oynamak için de tarayıcıda çevrimiçi olman yeterlidir.',
    ),
  )
}

// ---- Turnuva organizasyonu servis sayfalari (ServiceLanding.tsx ile birebir metin) ----
// NOT: govde YALNIZ makale icerigidir; iletisim formu ServiceLanding'de ayrica render edilir.
function hubBody() {
  return join(
    pText(
      'TavlaTV olarak; kurumlar, belediyeler, alışveriş merkezleri ve festivaller için <strong>anahtar teslim tavla turnuvası organizasyonu</strong> yapıyoruz. Fikir aşamasından ödül törenine kadar tüm süreci biz kurguluyoruz: format tasarımı, katılımcı kaydı, hakemlik, dijital eşleşme tabloları, canlı skor ekranları ve ödüllendirme. Siz yalnızca etkinliğin tadını çıkarın.',
    ),
    h2('Tavla organizasyonu neyi kapsar?'),
    pText(
      'Başarılı bir tavla turnuvası, sadece masaları dizmekten ibaret değildir. Doğru format, adil hakemlik, akıcı bir eşleşme sistemi ve seyirciyi içine çeken bir sahne kurgusu gerekir. Biz bu bileşenlerin hepsini tek elden yönetiyoruz; böylece etkinliğiniz profesyonel, şeffaf ve akılda kalıcı olur.',
    ),
    ul([
      '<strong>Format ve kurgu:</strong> Katılımcı sayısına göre eleme, İsviçre sistemi veya gruplu tablo; süre kontrolü ve puanlı maç ayarları.',
      '<strong>Kayıt ve organizasyon:</strong> Katılımcı kaydı, kura çekimi, program akışı ve sunuculuk.',
      '<strong>Hakemlik:</strong> Deneyimli hakemler ve resmî <a href="/turnuva-kurallari">tavla turnuva kuralları</a> (WBF) ile anlaşmazlıksız maçlar.',
      '<strong>Dijital altyapı:</strong> Canlı eşleşme tabloları, skor ekranları ve dilerseniz maç analizleri (PR).',
      '<strong>Ödül ve tören:</strong> Kupalar, madalyalar, sertifikalar ve markanıza uygun ödül töreni.',
    ]),
    h2('Kimler için tavla turnuvası düzenliyoruz?'),
    pText(
      'Her etkinliğin amacı farklıdır; biz de organizasyonu o amaca göre tasarlarız. Öne çıkan üç alanda özel çözümler sunuyoruz:',
    ),
    ul([
      '<strong><a href="/kurumsal-tavla-turnuvasi">Kurumsal tavla turnuvası</a>:</strong> Şirket içi motivasyon, takım ruhu ve çalışan bağlılığı için ideal etkinlik.',
      '<strong><a href="/belediye-tavla-turnuvasi">Belediye tavla turnuvası</a>:</strong> Kitlesel katılımlı, geleneği yaşatan kültür etkinlikleri.',
      '<strong><a href="/avm-tavla-turnuvasi">AVM tavla turnuvası</a>:</strong> Ziyaretçi trafiği ve marka etkileşimi yaratan aktivasyonlar.',
    ]),
    h2('Neden TavlaTV ile çalışmalısınız?'),
    pHtml(
      'Biz aynı zamanda Türkiye’nin dijital tavla platformuyuz. Bu, organizasyonunuza rakiplerin sunamadığı bir teknik derinlik katar. Kanıtlanabilir adil zar motoru, saniyesinde güncellenen eşleşme tabloları ve isteğe bağlı maç analizleriyle turnuvanız hem şeffaf hem de görsel olarak etkileyici olur. Dilerseniz etkinliği <a href="/online-turnuvalar">online turnuva</a> ayağıyla birleştirip hibrit bir formata dönüştürür, katılımı fiziksel salonun ötesine taşırız.',
    ),
    h2('Nasıl ilerliyoruz?'),
    pText(
      'Süreç sizin için olabildiğince basit: aşağıdaki formu doldurup etkinlik amacınızı, yaklaşık tarihi ve katılımcı sayısını iletin. Ekibimiz kısa sürede sizinle iletişime geçsin, ihtiyacınıza özel bir kurgu ve teklif hazırlasın. İster tek günlük bir etkinlik, ister sezon boyu sürecek bir turnuva serisi olsun; ölçeğe uygun bir çözüm üretiriz.',
    ),
  )
}

function kurumsalBody() {
  return join(
    pText(
      '<strong>Kurumsal tavla turnuvası</strong>, çalışanları rahat bir ortamda bir araya getiren, rekabeti eğlenceyle harmanlayan güçlü bir etkinlik formatıdır. TavlaTV olarak şirketiniz için ofiste, otelde ya da hibrit online düzende anahtar teslim kurumsal turnuvalar düzenliyoruz.',
    ),
    h2('Neden kurumsal tavla turnuvası?'),
    pText(
      'Tavla, her yaştan ve her departmandan çalışanın kolayca katılabildiği ender oyunlardandır. Kısa sürede öğrenilir, ama ustalık gerektirir; bu denge, hem yeni başlayanların hem de tecrübeli oyuncuların keyif almasını sağlar. Bir turnuva boyunca farklı ekiplerden insanlar aynı masada buluşur, gündelik hiyerarşi çözülür ve doğal bir kaynaşma oluşur.',
    ),
    ul([
      '<strong>Takım ruhu:</strong> Departmanlar arası tanışma ve iş birliği.',
      '<strong>Motivasyon:</strong> Rekabetçi ama stressiz, keyifli bir mola.',
      '<strong>Kapsayıcılık:</strong> Yaş ve pozisyon fark etmeksizin herkes oynayabilir.',
      '<strong>Marka içi etkinlik:</strong> Şirket değerlerinizle uyumlu, akılda kalıcı bir gün.',
    ]),
    h2('Etkinliği sizin için kurguluyoruz'),
    pHtml(
      'Katılımcı sayınıza göre eleme veya gruplu tablo tasarlar, süre kontrolünü ofis gününüze göre ayarlarız. Deneyimli hakemlerimiz resmî <a href="/turnuva-kurallari">tavla turnuva kurallarını</a> uygular; canlı eşleşme ekranları turnuvayı herkes için takip edilebilir kılar. Kupalar, sertifikalar ve ödül töreniyle etkinliği tamamlarız.',
    ),
    h2('Hibrit ve online seçenek'),
    pHtml(
      'Farklı şehirlerdeki ofisleriniz mi var? Etkinliği <a href="/online-turnuvalar">online turnuva</a> ayağıyla birleştirerek uzaktaki ekipleri de aynı tabloya dahil edebiliriz. Böylece kurumsal turnuvanız coğrafyadan bağımsız, gerçekten kapsayıcı bir hâle gelir.',
    ),
    h2('Teklif alın'),
    pHtml(
      'Şirketiniz için bir <a href="/tavla-turnuvasi-organizasyonu">tavla turnuvası organizasyonu</a> planlıyorsanız, aşağıdaki formu doldurun. Çalışan sayınıza ve beklentilerinize uygun bir kurgu ve teklifle en kısa sürede size dönelim.',
    ),
  )
}

function belediyeBody() {
  return join(
    pText(
      '<strong>Belediye tavla turnuvası</strong>, geleneği yaşatan, mahalleyi bir araya getiren ve yüksek katılım sağlayan bir kültür etkinliğidir. TavlaTV olarak belediyeler için festivallerde, Ramazan etkinliklerinde ve kültür günlerinde kitlesel tavla turnuvaları düzenliyoruz.',
    ),
    h2('Halkı buluşturan bir gelenek'),
    pText(
      'Tavla, Türkiye’nin en köklü sosyal oyunlarından biridir; kahvehaneden meydana kadar her yerde oynanır. Bir belediye turnuvası, bu geleneği modern bir organizasyonla buluşturur: gençten yaşlıya herkesin katılabildiği, mahalle sakinlerini kaynaştıran, şehre değer katan bir etkinlik ortaya çıkar.',
    ),
    ul([
      '<strong>Yüksek katılım:</strong> Yüzlerce katılımcılı, kitlesel tablo yönetimi.',
      '<strong>Kapsayıcılık:</strong> Her yaştan hemşehrinin katılabileceği format.',
      '<strong>Kültürel değer:</strong> Geleneksel oyunu genç kuşaklara taşıma.',
      '<strong>Sosyal etki:</strong> Meydanları ve etkinlik alanlarını canlandırma.',
    ]),
    h2('Kitlesel organizasyonda tecrübe'),
    pHtml(
      'Yüksek katılımlı turnuvalar özel bir altyapı ister. Dijital kayıt ve kura sistemimiz, yüzlerce katılımcıyı hatasız eşleştirir; canlı skor ekranları meydandaki herkesin turnuvayı takip etmesini sağlar. Deneyimli hakemlerimiz ve resmî <a href="/turnuva-kurallari">turnuva kuralları</a> ile maçlar adil ve tartışmasız ilerler.',
    ),
    h2('Festival ve özel dönem etkinlikleri'),
    pHtml(
      'Ramazan sokakları, şehir festivalleri, gençlik haftası ya da kültür günleri — hangi dönem olursa olsun etkinliği o atmosfere uygun kurgularız. Sahne, ses ve ödül töreni dahil tüm organizasyonu üstlenerek belediyenize anahtar teslim bir <a href="/tavla-turnuvasi-organizasyonu">tavla organizasyonu</a> sunarız.',
    ),
    h2('Teklif alın'),
    pText(
      'Belediyeniz için bir tavla turnuvası planlıyorsanız aşağıdaki formu doldurun; beklenen katılımcı sayısına ve etkinlik takviminize uygun bir teklifle size dönelim.',
    ),
  )
}

function avmBody() {
  return join(
    pText(
      '<strong>AVM tavla turnuvası</strong>, alışveriş merkezinize ziyaretçi çeken, ziyaret süresini uzatan ve markanıza etkileşim kazandıran güçlü bir aktivasyondur. TavlaTV olarak AVM’ler için sahne kurulumundan canlı skor ekranlarına kadar tam kapsamlı tavla etkinlikleri düzenliyoruz.',
    ),
    h2('Ziyaretçi çeken bir etkinlik'),
    pText(
      'Tavla, izlemesi de oynaması da keyifli bir oyundur; bir turnuva anında kalabalık toplar. AVM’nizde kurulan bir tavla etkinliği, ziyaretçilerin daha uzun kalmasını, sosyal medyada paylaşım yapmasını ve mağazalarınızla daha çok etkileşime girmesini sağlar. Doğru kurguyla turnuva, hem eğlence hem de pazarlama aracına dönüşür.',
    ),
    ul([
      '<strong>Yaya trafiği:</strong> Etkinlik günlerinde artan ziyaretçi sayısı.',
      '<strong>Marka etkileşimi:</strong> Sponsor markalar için görünürlük ve deneyim alanı.',
      '<strong>Sosyal paylaşım:</strong> Fotoğraflanabilir sahne ve canlı skor ekranları.',
      '<strong>Aile dostu:</strong> Her yaştan ziyaretçinin katılabileceği format.',
    ]),
    h2('Sahne, sponsorluk ve prodüksiyon'),
    pHtml(
      'Etkinlik alanınızı bir turnuva sahnesine dönüştürüyoruz: markalı masalar, canlı skor ekranları, sunuculuk ve ödül töreni dahil. Sponsorluk entegrasyonlarıyla etkinliği gelir modeline bağlayabilir; dilerseniz <a href="/online-turnuvalar">online turnuva</a> ayağıyla katılımı AVM dışına da taşıyabiliriz.',
    ),
    h2('Adil ve şeffaf turnuva'),
    pHtml(
      'Deneyimli hakemlerimiz ve resmî <a href="/turnuva-kurallari">tavla turnuva kuralları</a> ile maçlar tartışmasız ilerler. Dijital eşleşme sistemimiz, kalabalık katılımı bile akıcı biçimde yönetir; ziyaretçiler turnuvayı büyük ekranlardan canlı izler.',
    ),
    h2('Teklif alın'),
    pHtml(
      'AVM’niz için bir <a href="/tavla-turnuvasi-organizasyonu">tavla turnuvası organizasyonu</a> planlıyorsanız, aşağıdaki formu doldurun; etkinlik tarihinize ve alanınıza uygun bir kurgu ve teklifle size dönelim.',
    ),
  )
}

function iletisimBody() {
  return join(
    pText(
      'TavlaTV ile iletişime geçmek çok kolay. Turnuva organizasyonu, sponsorluk, iş birliği ya da her türlü sorunuz için aşağıdaki formu doldurmanız yeterli; en kısa sürede size dönüş yaparız.',
    ),
    h2('Ne için yazabilirsiniz?'),
    ul([
      '<strong><a href="/tavla-turnuvasi-organizasyonu">Tavla turnuvası organizasyonu</a></strong> — kurumsal, belediye, AVM ve festival etkinlikleri.',
      '<strong>İş birliği ve sponsorluk</strong> — marka iş birlikleri ve etkinlik sponsorlukları.',
      '<strong>Kulüp ve topluluk</strong> — tavla kulüpleri ve turnuva takvimi için öneriler.',
      '<strong>Destek</strong> — platformla ilgili soru ve geri bildirimler.',
    ]),
    h2('Turnuva mı düzenlemek istiyorsunuz?'),
    pText(
      'Bir etkinlik planlıyorsanız, talep türünü “Kurumsal / Belediye / AVM” olarak seçip etkinlik amacınızı ve yaklaşık katılımcı sayısını yazın. Böylece size en uygun kurgu ve teklifle daha hızlı dönüş yapabiliriz.',
    ),
  )
}

// ---- nasil-oynanir (Rules.tsx CONTENT.tr ile birebir) ----------------------------
// intro + her section (h + p[]). Bazi section'lar (SSS) alt-basliklardir -> h3 uretiyoruz.
const RULES_TR = {
  intro:
    'Tavla, iki oyuncunun 15’er taşla oynadığı, hem şans hem stratejinin belirleyici olduğu klasik bir masa oyunudur. Amaç tüm taşlarını kendi evine getirip tahtadan ilk toplayan oyuncu olmaktır.',
  sections: [
    { h: 'Amaç', level: 2, p: [
      'Tahtada 24 üçgen (hane) vardır. Her oyuncu taşlarını saat yönünde/tersine kendi ev bölgesine (son çeyrek) taşır.',
      'Tüm 15 taşını kendi evine getiren oyuncu taşları tahtadan “toplamaya” (bear off) başlar. Tüm taşlarını ilk toplayan oyunu kazanır.',
    ] },
    { h: 'Kurulum', level: 2, p: [
      'Başlangıç dizilişi standarttır: her oyuncunun 6-noktasında 5, 8-noktasında 3, 13-noktasında 5 ve 24-noktasında 2 taşı bulunur.',
      'TavlaTv’de tahta otomatik kurulur; sadece oynamaya odaklan.',
    ] },
    { h: 'Zar ve Hareket', level: 2, p: [
      'Sıra sende iki zar atarsın. Her zar bir taşın kaç hane ilerleyeceğini gösterir.',
      'İki farklı taşı ayrı ayrı oynayabilir ya da tek taşı iki zar toplamı kadar (ara nokta uygunsa) ilerletebilirsin.',
      'Çift (aynı zar) atarsan o değeri dört kez oynarsın.',
      'Rakibin iki veya daha fazla taşının olduğu haneye giremezsin (kapalı hane).',
    ] },
    { h: 'Vurma ve Girme', level: 2, p: [
      'Rakibin tek taşı olan haneye gelirsen o taşı “vurursun”; taş bara gider.',
      'Barda taşın varken başka hamle yapamazsın; önce rakibin ev bölgesinden tahtaya girmen gerekir.',
      'Giriş için attığın zarın gösterdiği hane açık (rakibin 2+ taşı yok) olmalıdır.',
    ] },
    { h: 'Toplama (Bear Off)', level: 2, p: [
      '15 taşının tamamı kendi ev bölgendeyse taş toplamaya başlarsın.',
      'Attığın zar değerine karşılık gelen haneden taş toplarsın. O hanede taş yoksa daha ileri haneden oynayabilir/toplayabilirsin.',
      'Toplama sırasında vurulursan taşın bara gider ve tekrar girmen gerekir.',
    ] },
    { h: 'Kazanma: Tekli, Mars (Gammon), Backgammon', level: 2, p: [
      'Rakip en az bir taş topladıysa: normal (1 puan) galibiyet.',
      'Rakip hiç taş toplayamadıysa: Mars/Gammon (2 puan).',
      'Rakip hiç toplayamadığı gibi barda veya senin evinde taşı kaldıysa: Backgammon (3 puan).',
    ] },
    { h: 'Küp (Doubling Cube)', level: 2, p: [
      'Küp, oyunun puan değerini yükseltmek için kullanılır. Sıran gelince ve zar atmadan önce rakibe küp teklif edebilirsin (2 kat).',
      'Rakip kabul ederse (take) oyun iki katına çıkar ve küp ona geçer; reddederse (drop) mevcut puanı sana verip el biter.',
      'Crawford kuralı: biri maçı kazanmaya 1 puan kala, sonraki tek elde küp kullanılamaz.',
      'TavlaTv’de oyun içi “Küp danışmanı”, kazanma yüzdene göre katla/kabul et/kaç önerisi verir.',
    ] },
    { h: 'PR ve Puan (TavlaTv)', level: 2, p: [
      'PR (Performans Reytingi): hamlelerinin en iyi oynanışa ne kadar yakın olduğunu ölçer; düşük PR daha iyidir.',
      'Rating (Elo): maç sonuçlarına göre değişen beceri puanın. Kayıtta başlangıç seviyeni sen seçersin.',
      'Maç sonunda “Analiz” ile en kötü hamlelerini ve küp kararlarını görebilirsin.',
    ] },
    { h: 'Açılış Zarı ve Kim Başlar', level: 2, p: [
      'Oyunun başında her iki oyuncu birer zar atar. Büyük sayıyı atan oyuncu ilk hamleyi yapar; ilk hamlede kendi attığı zarla rakibin attığı zarı birlikte oynar.',
      'İki oyuncu da aynı sayıyı atarsa (beraberlik) zarlar yeniden atılır; bu durum genellikle küpü de otomatik olarak yükseltir (isteğe bağlı kural). TavlaTv’de açılış zarı otomatik atılır ve kimin başlayacağı ekranda gösterilir.',
      'Açılış hamlesinde çift atılamaz; en yüksek tek atış oyuna başlar. Bu yüzden ilk hamlede her zaman iki farklı sayıyla oynarsın.',
    ] },
    { h: 'Vurma ve Bardan Giriş (Detay)', level: 2, p: [
      'Bir hanede rakibin yalnızca tek taşı (blot) varsa, o haneye gelerek taşı vurabilirsin. Vurulan taş “bar”a (orta çubuğa) konur ve rakip onu yeniden oyuna sokmak zorundadır.',
      'Barda taşı olan oyuncu, tüm taşlarını bardan sokmadan tahtadaki başka hiçbir taşını oynayamaz. Giriş, rakibin ev bölgesindeki (senin için 1–6 haneleri) açık noktalardan yapılır.',
      'Attığın zar, girmeye çalıştığın haneye denk gelmeli ve o hane açık olmalı (rakibin 2+ taşı bulunmamalı). İki zarın da denk geldiği haneler kapalıysa giriş yapamaz, sıranı kaybedersin.',
      'Birden fazla taşın bardaysa hepsini teker teker sokman gerekir; hepsi girene kadar başka hamle yapamazsın. Bu yüzden rakibin ev bölgesini kapatmak (prime kurmak) güçlü bir savunmadır.',
    ] },
    { h: 'Toplama (Bear Off) Detayları', level: 2, p: [
      '15 taşının tamamı kendi ev bölgene girdiğinde toplamaya başlayabilirsin. Ev bölgesi senin son çeyreğindir (1–6 haneleri).',
      'Attığın zar değeri kadar uzaklıktaki haneden taş toplarsın: 5 attıysan 5-hanedeki taşı tahtadan çıkarırsın. O hanede taş yoksa, daha yüksek bir haneden taşı öne oynayabilirsin.',
      'Attığın sayıdan daha ileride hiç taşın yoksa, o zarla en yakın (daha düşük) dolu haneden toplama yapabilirsin. Örneğin 6 attın ama 6-hanen boşsa ve en yüksek dolu hanen 4 ise, 4-haneden toplarsın.',
      'Toplama aşamasında bir taşın açıkta kalır ve rakibinle hâlâ temas varsa, vurulma riski vardır. Vurulan taş bara döner ve baştan girmen gerekir — bu, kazanılmış görünen oyunları bile çevirebilir.',
    ] },
    { h: 'Küp (Doubling Cube) Kullanımı', level: 2, p: [
      'Küp, oyunun puan değerini katlamak için kullanılan altı yüzlü (2, 4, 8, 16, 32, 64) özel bir zardır. Oyun 1 değerinde başlar.',
      'Sıran geldiğinde ve zar atmadan önce, konumun iyiyse rakibe küp teklif edebilirsin. Rakip iki seçenekle karşı karşıya kalır: kabul et (take) — oyun iki katına çıkar ve küp artık ona geçer, bir sonraki teklifi o yapar; ya da pas geç (drop) — mevcut değeri sana kaptırıp eli bitirir.',
      'Doğru küp teklifi genellikle kazanma ihtimalin belirgin biçimde arttığında yapılır; çok erken teklif rakibe kolay “take”, çok geç teklif ise kazandığın puanı küçültür.',
      'Crawford kuralı: bir oyuncu maçı kazanmaya 1 puan kala, hemen sonraki tek elde küp kullanılamaz. Bu elden sonra küp yeniden devreye girer.',
      'TavlaTv’nin oyun içi “Küp danışmanı”, kazanma yüzdene göre katla / kabul et / pas geç önerileri sunarak doğru kararı öğrenmene yardımcı olur.',
    ] },
    { h: 'Mars (Gammon) ve Backgammon Puanlaması', level: 2, p: [
      'Tavlada kazanmanın değeri, rakibi ne kadar geride bıraktığına göre değişir ve varsa küp çarpanıyla çarpılır.',
      'Tekli (normal) galibiyet: rakip en az bir taşını toplayabilmişse, oyun 1 puan × küp değerindedir.',
      'Mars (Gammon): rakip hiç taş toplayamadan oyunu bitirirsen 2 puan × küp değeri kazanırsın.',
      'Backgammon: rakip hiç taş toplayamadığı gibi hâlâ barda ya da senin ev bölgende taşı kaldıysa, 3 puan × küp değeriyle en yüksek galibiyeti alırsın.',
      'Örnek: küp 2’deyken bir mars yaparsan 2 (mars) × 2 (küp) = 4 puan kazanırsın. TavlaTv tüm bu çarpanları otomatik hesaplar.',
    ] },
    { h: 'Temel Strateji', level: 2, p: [
      'Açıkta tek taş (blot) bırakmamaya çalış; her blot rakip için bir vurma fırsatıdır. Zorunlu kaldığında blotu, vurulması en zor olan yere bırak.',
      'Kilit (point) yap: bir haneye iki taş koyarak orayı rakibe kapatırsın. Özellikle kendi 5-noktan (“altın nokta”) ve bar-noktan (7-nokta) en değerli kilitlerdir.',
      'Prime kurmaya çalış: yan yana kapatılmış hanelerden oluşan bir duvar, rakibin taşlarını arkanda hapseder. Altı ardışık kapalı hane (full prime) rakibin hiçbir taşının geçmesine izin vermez.',
      'Yarış (race) durumunu tanı: iki taraf birbirini geçmiş ve temas kalmamışsa, artık strateji değil hız önemlidir; taşlarını en verimli şekilde eve taşı. Temas varken ise güvenlik ve zamanlama ön plandadır.',
      'Pip sayımını öğren: her iki tarafın bitişe kaç adım uzakta olduğunu hesaplamak, yarışta önde misin geride misin bilmeni ve küp kararlarını doğru vermeni sağlar.',
    ] },
    { h: 'Sık Kullanılan Terimler', level: 2, p: [
      'Pip: bir taşın bitiş çizgisine olan uzaklığı (adım sayısı). Tüm taşların pip toplamı, bitişe ne kadar kaldığını gösterir.',
      'Blot: bir hanede tek başına duran, vurulmaya açık taş.',
      'Point (kilit): bir oyuncunun iki veya daha fazla taşıyla tuttuğu, rakibe kapalı hane.',
      'Prime: yan yana yapılmış birden fazla kilitin oluşturduğu, rakibi geride tutan duvar.',
      'Anchor (çapa): rakibin ev bölgesinde tuttuğun kilit; hem güvenli bir sığınak hem de sonradan vurma fırsatı sağlar.',
      'Bar: vurulan taşların konduğu, tahtayı ikiye ayıran orta çubuk.',
      'Bear off (toplama): tüm taşları eve topladıktan sonra tahtadan çıkarma aşaması.',
    ] },
    { h: 'Sık Sorulan Sorular', level: 2, p: [] },
    { h: 'Zar atınca hiç oynayamazsam ne olur?', level: 3, p: [
      'Attığın zarların hiçbiriyle geçerli bir hamle yapamıyorsan (tüm haneler kapalı ya da barda taşın giremiyor), sıra kayıpsız şekilde rakibe geçer. Yalnızca bir zarı oynayabiliyorsan, mümkün olanı oynaman zorunludur.',
    ] },
    { h: 'Çift attığımda kaç hamle yaparım?', level: 3, p: [
      'Aynı sayıyı atarsan (örneğin 5-5) o değeri dört kez oynarsın: dört ayrı taşla ya da aynı taşı dört kez ilerleterek. Mümkünse dört hamleyi de yapmak zorundasın.',
    ] },
    { h: 'Küpü ne zaman teklif etmeliyim?', level: 3, p: [
      'Kesin bir kural yoktur ama genel olarak kazanma ihtimalin belirgin biçimde arttığında (yaklaşık %70’in üzerinde ama rakibin hâlâ kabul edebileceği bir aralıkta) küp teklif etmek mantıklıdır. TavlaTv’nin küp danışmanı bu kararı öğrenmene yardımcı olur.',
    ] },
  ],
}

function nasilOynanirBody() {
  const parts = [pText(RULES_TR.intro)]
  for (const s of RULES_TR.sections) {
    parts.push(s.level === 3 ? h3(s.h) : h2(s.h))
    for (const para of s.p) parts.push(pText(para))
  }
  return join(...parts)
}

// ---- Rehber yazilari (guides.ts) -------------------------------------------------
function guideBody(guide) {
  const parts = []
  for (const sec of guide.sections) {
    parts.push(h2(sec.h))
    for (const para of sec.body) parts.push(pHtml(para)) // para HTML (a/strong/em)
  }
  return join(...parts)
}

// ---- Turnuva kurallari (tournamentRules.ts) --------------------------------------
function tournamentRulesBody() {
  const parts = [
    pText(
      'Dünya Tavla Federasyonu (WBF) Uluslararası Turnuva Kural ve Prosedürleri — turnuva formatı, süre, zar ve küp kuralları, kural dışı hareketler ve anlaşmazlıkların çözümü. Aşağıdaki metin resmî ve eksiksiz Türkçe kural metnidir.',
    ),
  ]
  for (const g of TOURNAMENT_RULES) {
    parts.push(h2(`${g.num} ${g.title}`))
    for (const s of g.sections) {
      parts.push(h3(`${s.num} ${s.title}`))
      for (const para of s.body) parts.push(pText(para))
    }
  }
  // Yorumlar bolumu
  if (RULE_COMMENTS && RULE_COMMENTS.length) {
    parts.push(h2('Yorumlar'))
    for (const c of RULE_COMMENTS) {
      parts.push(pText(`${c.ref}: ${c.text}`))
    }
  }
  // Edisyon altbilgisi
  parts.push(pText(RULE_EDITION))
  return join(...parts)
}

// ---- Cikti dizisini kur ----------------------------------------------------------
const rows = []
let sort = 0
function add(slug, body) {
  rows.push({
    slug,
    title: PAGE_TITLES[slug],
    seo_title: SEO_TITLES[slug],
    seo_description: SEO_DESCS[slug],
    body,
    sort: sort++,
  })
}

add('online-tavla', onlineTavlaBody())
add('tavla-oyna', tavlaOynaBody())
add('tavla-turnuvasi-organizasyonu', hubBody())
add('kurumsal-tavla-turnuvasi', kurumsalBody())
add('belediye-tavla-turnuvasi', belediyeBody())
add('avm-tavla-turnuvasi', avmBody())
add('iletisim', iletisimBody())
add('nasil-oynanir', nasilOynanirBody())
add('turnuva-kurallari', tournamentRulesBody())
for (const g of GUIDES) {
  add('tavla-rehberi/' + g.slug, guideBody(g))
}

const outPath = resolve(ROOT, 'backend/database/data/seo-pages.json')
writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n', 'utf8')

// Ozet
console.log(`seo-pages.json yazildi: ${outPath}`)
console.log(`Toplam ${rows.length} giris:`)
for (const r of rows) {
  console.log(`  • ${r.slug.padEnd(48)} body=${r.body.length} krk`)
}
