/**
 * SeoContent — taranabilir, özgün Türkçe SEO içeriği. Üç varyant:
 *  - 'home': ana sayfanın altına gömülen kompakt tanıtım bloğu (H1 YOK; sayfa H1'i
 *    başka yerdedir). İç linkler + kısa Q&A.
 *  - 'online-tavla' / 'tavla-oyna': tam landing sayfası (H1 var, ~700-900 kelime,
 *    H2 bölümleri, kısa Q&A ve "Hemen Oyna" CTA). page-host içinde render edilir.
 *
 * İçerik doğrudan JSX (Rules.tsx deseni): H2/paragraf/liste. Q&A gerçek H3+paragraf
 * (FAQPage schema KULLANILMAZ — Google 2026'da rich sonucu kaldırdı). İç linkler
 * normal <a href> (SPA fallback web.php ile 200 döner); tam-yenileme kabul edilebilir
 * ve taranabilir gerçek bağlantı sağlar.
 */

import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'

export type SeoVariant = 'home' | 'online-tavla' | 'tavla-oyna'

interface Props {
  variant: SeoVariant
  onClose?: () => void // yalnız landing varyantlarında (page-host kapatma)
}

// Ana sayfa altı kompakt blok: kısa tanıtım + iç linkler + 2 kısa Q&A.
function HomeContent() {
  return (
    <section className="seo-content seo-content-home" aria-label="TavlaTV hakkında">
      <div className="info-rich rich">
        <h2>Ücretsiz Online Tavla Oyna</h2>
        <p>
          TavlaTV, tarayıcında hiçbir kurulum gerektirmeden{' '}
          <a href="/yeni-oyun">online tavla</a> oynayabileceğin ücretsiz bir platformdur.
          Bilgisayarında, telefonunda ya da tabletinde açar açmaz oyuna başlarsın; ne indirme
          ne de karmaşık ayar vardır. İster gerçek rakiplerle canlı maç yap, ister{' '}
          <a href="/yz-ile-oyna">yapay zekâya karşı</a> pratik et.
        </p>
        <p>
          Tavlayı yeni öğreniyorsan <a href="/nasil-oynanir">tavla nasıl oynanır</a>{' '}
          rehberimizle başlayabilir, kuralları ve açılış dizilimini adım adım kavrayabilirsin.
          Kendine güvendiğinde <a href="/tavla-oyna">tavla oyna</a> sayfasından ilk maçına
          çıkabilir, arkadaşlarını davet ederek keyifli karşılaşmalar düzenleyebilirsin.
        </p>

        <h2>Neden TavlaTV?</h2>
        <ul>
          <li>
            <strong>Ücretsiz ve kayıtsız:</strong> Bedava tavla oynamak için üye olmana bile
            gerek yok; misafir olarak hemen başlayabilirsin.
          </li>
          <li>
            <strong>Güçlü tavla botu:</strong> Sinir ağı tabanlı yapay zekâya karşı oyna,
            seviyeni seç ve gelişimini takip et.
          </li>
          <li>
            <strong>Canlı maçlar ve turnuvalar:</strong> Gerçek oyuncularla puanlı maçlar yap,{' '}
            <a href="/online-turnuvalar">online tavla turnuvalarına</a> katıl.
          </li>
          <li>
            <strong>Detaylı analiz (PR):</strong> Maç sonunda hamlelerinin ne kadar isabetli
            olduğunu gösteren performans reytingini gör, hatalarından öğren.
          </li>
        </ul>

        <h2>Sık Sorulan Sorular</h2>
        <h3>Tavla oynamak için üye olmam gerekir mi?</h3>
        <p>
          Hayır. Bedava tavla oynamaya misafir olarak hemen başlayabilirsin. Üyelik ise
          rating, maç geçmişi ve turnuvalar gibi ek özellikleri açar.
        </p>
        <h3>Telefondan tavla oynanır mı?</h3>
        <p>
          Evet. TavlaTV mobil uyumludur; telefon ve tabletlerde tarayıcı üzerinden sorunsuz
          çalışır. Uygulama indirmene gerek yoktur.
        </p>
      </div>
    </section>
  )
}

// "Online Tavla Oyna" landing (H1 + ~700-900 kelime).
function OnlineTavlaContent() {
  return (
    <div className="info-rich rich seo-landing-body">
      <p className="rules-intro">
        Bilgisayarını ya da telefonunu aç, tarayıcıdan gir ve saniyeler içinde online tavla
        oynamaya başla. TavlaTV; gerçek rakiplere karşı canlı maçlar, güçlü yapay zekâ botu,
        turnuvalar ve maç analizi sunan ücretsiz bir online tavla platformudur.
      </p>

      <h2>Online tavla nedir?</h2>
      <p>
        Online tavla, klasik masa tavlasının internet üzerinden, uzaktaki oyuncularla veya
        bilgisayara karşı oynanan halidir. Fiziksel bir tahtaya, zara ya da karşında oturan
        bir rakibe ihtiyaç duymadan, dünyanın her yerinden insanlarla eşleşebilirsin. Zar
        atışları sunucu tarafında güvenli rastgelelikle (CSPRNG) üretilir; yani atışlar
        şeffaf ve adildir. Tahta otomatik kurulur, kurallar oyunun içinde uygulanır ve geçersiz
        hamlelere izin verilmez — bu sayede kurallara boğulmadan yalnızca oyuna odaklanırsın.
      </p>
      <p>
        Geleneksel tavlanın tüm heyecanı korunur: aynı on beş taş, aynı zarlar, aynı ev ve bar
        mantığı. Değişen tek şey mekân; kahvehane masası yerine ekranın var. Bu da tavlayı her
        zamankinden daha erişilebilir kılar. İşte molasında, akşam evinde ya da yolda beklerken
        birkaç dakikanı ayırıp keyifli bir maç oynayabilir; canın istediğinde uzun, puanlı bir
        karşılaşmaya girişebilirsin. Rakip bulmak için kimseyi ikna etmene gerek yoktur; her an
        çevrimiçi onlarca oyuncu seninle eşleşmeyi bekler.
      </p>

      <h2>Nasıl başlanır?</h2>
      <p>
        TavlaTV'de online tavla oynamak için karmaşık bir sürece gerek yok. Uygulama indirmez,
        kurulum yapmazsın; her şey tarayıcında çalışır. Adımlar oldukça basittir:
      </p>
      <ul>
        <li>Siteye gir; misafir olarak dahi anında <a href="/yeni-oyun">yeni bir maç</a> kurabilirsin.</li>
        <li>Rakip tercihini yap: gerçek bir oyuncuya karşı canlı maç, yapay zekâya karşı pratik ya da arkadaşınla özel oda.</li>
        <li>Maç uzunluğunu (tek oyun veya hedef puan), süre kontrolünü ve küp (doubling) ayarını seç.</li>
        <li>Zarını at, taşlarını sürükle ve tüm pullarını evine getirip topla — ilk toplayan kazanır.</li>
      </ul>
      <p>
        Kuralları hatırlaman gerekiyorsa <a href="/nasil-oynanir">tavla nasıl oynanır</a>{' '}
        rehberimiz açılış dizilimini, zar hareketini, vurma-girme ve toplama (bear off)
        aşamalarını sade bir dille anlatır.
      </p>

      <h2>Öne çıkan özellikler</h2>
      <p>
        TavlaTV yalnızca bir oyun ekranı değil; tavlanı geliştirebileceğin kapsamlı bir
        ortamdır. Farklı oyun modları ve araçlar sayesinde hem eğlenir hem gelişirsin.
      </p>
      <ul>
        <li>
          <strong>Arkadaşınla oyna:</strong> Özel bir davet kodu oluştur, arkadaşını çağır ve{' '}
          <a href="/arkadasinla-oyna">birlikte online tavla</a> keyfi yaşa. Süre ve puan
          ayarlarını birlikte belirlersiniz.
        </li>
        <li>
          <strong>Yapay zekâya karşı:</strong> Sinir ağı tabanlı{' '}
          <a href="/yz-ile-oyna">tavla botuna karşı</a> oyna. Seviyeni ayarla, rakibin gücünü
          kendine göre belirle ve baskı altında oynamayı öğren.
        </li>
        <li>
          <strong>Turnuvalar:</strong> <a href="/online-turnuvalar">Online tavla turnuvalarına</a>{' '}
          katıl, eleme tablolarında ilerle ve ödüller için yarış.
        </li>
        <li>
          <strong>Analiz ve PR:</strong> Her maçtan sonra hamlelerinin en iyi oynanışa ne kadar
          yakın olduğunu gösteren performans reytingini (PR) görürsün. Küp kararlarını ve en
          kötü hamlelerini inceleyerek somut şekilde gelişirsin.
        </li>
      </ul>

      <h2>Online tavla stratejisi ve ipuçları</h2>
      <p>
        Online tavlada başarı, sadece iyi zar atmakla ilgili değildir; zarın verdiğini en iyi
        şekilde değerlendirmekle ilgilidir. İyi bir oyuncu, taşlarını güvende tutar, açıkta tek
        (blot) bırakmamaya çalışır ve rakibinin evine giriş kapılarını kapatarak onu barda
        bekletmeyi hedefler. Kilit noktaları (özellikle kendi 5 ve 7 haneni) yapmak, hem
        savunmanı güçlendirir hem de rakibinin ilerlemesini yavaşlatır.
      </p>
      <p>
        Küp (doubling cube) kullanımı da online tavlada oyunun kaderini belirleyen kritik bir
        karardır. Kazanma yüzden yüksekken küpü teklif etmek, rakibini ya riskli bir devam ya da
        puan kaybıyla çekilme arasında bırakır. TavlaTV'nin oyun içi küp danışmanı, kazanma
        oranına göre katla, kabul et veya çekil önerileriyle bu kararları öğrenmene yardımcı olur.
        Zamanla pip sayımı, yarış (race) ile tutma (holding) oyunlarını ayırt etmeyi ve pozisyona
        göre strateji değiştirmeyi kavrarsın.
      </p>

      <h2>Neden TavlaTV?</h2>
      <p>
        Piyasada birçok tavla sitesi var; ancak TavlaTV, adil oyun ve gelişim odaklı yaklaşımıyla
        ayrışır. Zarların kanıtlanabilir şekilde rastgele üretilmesi, hile ve manipülasyona karşı
        güven verir. Ücretsiz olması, oynamak için cebinden para çıkmayacağı anlamına gelir;
        reklamların dengeli kullanımı ise oyun akışını bozmaz. En önemlisi, oynadıkça öğrenmeni
        sağlayan analiz araçları sayesinde tavlan gerçekten ilerler. Modern ve mobil uyumlu
        arayüzü, hem masaüstünde hem telefonda akıcı bir deneyim sunar; böylece nerede olursan ol
        online tavla oynayabilirsin.
      </p>
      <p>
        Ayrıca canlı maçlarda süre kontrolü, puanlı (rating) eşleşmeler ve maç sonu analizler bir
        arada sunulur. Rating sistemi, seni kendi seviyene yakın rakiplerle eşleştirir; böylece ne
        sürekli ezilir ne de kolay maçlarda sıkılırsın. Lider tablosunda yükselmek, rozet ve
        başarımlar kazanmak ise oynamaya devam etmen için ekstra motivasyon sağlar.
      </p>
      <p>
        Kısacası TavlaTV; hızlı bir maç arayan sıradan oyuncudan, PR'ını düşürmeye çalışan ciddi
        rakibe kadar herkes için tasarlanmıştır. İster molada tek oyunluk keyif ister uzun
        soluklu puanlı maçlar dilersin, hepsi burada.
      </p>

      <h2>Tavla türleri ve maç modları</h2>
      <p>
        Online tavlada tek bir oynanış yoktur; keyfine ve zamanına göre farklı formatlar seçebilirsin.
        Tek oyunluk (money game) maçlar hızlıdır: bir oyun oynar, sonucu alır ve devam edersin. Puanlı
        maçlarda ise belirli bir hedef puana (örneğin 3, 5 veya 7 puan) ilk ulaşan kazanır; bu format
        küpün ve stratejinin çok daha önemli olduğu, daha derin bir deneyim sunar.
      </p>
      <p>
        Süre kontrolü de deneyimini şekillendirir. Hızlı süre limitleri tempoyu yükseltir ve seni
        çabuk karar vermeye zorlar; daha uzun süreler ise her hamleyi enine boyuna düşünmene imkân
        tanır. Bunların yanında geleneksel tavlanın mars (gammon) ve backgammon gibi ekstra puanlı
        kazanma türleri de tam olarak uygulanır — yani rakibini iyice geride bırakırsan tek maçta
        birden fazla puan alabilirsin. Tüm bu ayarları maç kurulumundan kendine göre belirlersin.
      </p>

      <h2>Sık sorulan sorular</h2>
      <h3>Online tavla ücretsiz mi?</h3>
      <p>
        Evet. TavlaTV'de online tavla tamamen ücretsizdir ve oynamaya başlamak için ödeme
        yapmana gerek yoktur. Dilersen Premium üyelikle gelişmiş analiz ve reklamsız deneyim
        gibi ekstralara sahip olabilirsin.
      </p>
      <h3>Kayıt olmadan online tavla oynayabilir miyim?</h3>
      <p>
        Evet, misafir olarak anında oynayabilirsin. Ancak rating, maç geçmişi ve turnuvalar gibi
        özelliklerden yararlanmak için ücretsiz bir hesap oluşturman önerilir.
      </p>
      <h3>Zarlar adil mi?</h3>
      <p>
        Zar atışları sunucu tarafında güvenli rastgelelik (CSPRNG) ile üretilir ve kanıtlanabilir
        adildir. Hiçbir oyuncu zar sonuçlarını değiştiremez.
      </p>
      <h3>Mobil cihazdan oynanır mı?</h3>
      <p>
        Kesinlikle. TavlaTV mobil uyumludur; telefon ve tabletlerde tarayıcı üzerinden herhangi
        bir uygulama indirmeden çalışır.
      </p>

      <div className="seo-cta">
        <Button asChild className="seo-cta-btn">
          <a href="/yeni-oyun">
            <Icon name="play" size={18} /> Hemen Online Tavla Oyna
          </a>
        </Button>
      </div>
    </div>
  )
}

// "Tavla Oyna" landing (H1 + ~700-900 kelime).
function TavlaOynaContent() {
  return (
    <div className="info-rich rich seo-landing-body">
      <p className="rules-intro">
        Ücretsiz, kayıt gerektirmeyen ve tarayıcıda anında açılan bir platformda tavla oyna.
        TavlaTV; yeni başlayanlar için sade bir başlangıç, tecrübeli oyuncular için ise puanlı
        maçlar, turnuvalar ve derin analiz sunan bir bedava tavla oyunudur.
      </p>

      <h2>Tavla nasıl bir oyun?</h2>
      <p>
        Tavla, iki oyuncunun on beşer taşla oynadığı, hem şans hem stratejinin birlikte
        belirleyici olduğu klasik bir masa oyunudur. Amaç, tüm taşlarını kendi ev bölgene getirip
        tahtadan ilk toplayan (bear off) oyuncu olmaktır. Zarlar şansı; hangi taşı nasıl
        oynayacağın ise stratejiyi temsil eder. İşte bu denge, tavlayı yüzyıllardır sevilen ve her
        oyunu farklı kılan bir oyun yapar. TavlaTV'de tahta otomatik kurulur, kurallar oyunun
        içinde uygulanır; sen yalnızca zarını atıp en iyi hamleyi düşünmeye odaklanırsın.
      </p>
      <p>
        Tavlanın en güzel yanı, hem çabuk öğrenilmesi hem de ustalaşmasının uzun yıllar almasıdır.
        Kuralları birkaç dakikada kavrarsın; ama zar olasılıklarını hesaplamayı, doğru anda risk
        almayı ve rakibinin planını bozmayı öğrenmek bir ömür sürebilir. Her maç yeni bir bulmaca
        gibidir: aynı zar, farklı pozisyonlarda tamamen farklı hamleler gerektirir. Bu yüzden tavla
        asla sıkıcı gelmez; her oyunda öğrenecek yeni bir şey bulursun.
      </p>

      <h2>Nasıl tavla oynanır?</h2>
      <p>
        Tavla oynamaya başlamak sandığından çok daha kolaydır. Temel akış şöyle işler:
      </p>
      <ul>
        <li>Sıra sende iki zar atarsın; her zar bir taşın kaç hane ilerleyeceğini gösterir.</li>
        <li>İki farklı taşı ayrı ayrı oynayabilir ya da uygunsa tek taşı iki zarın toplamı kadar ilerletebilirsin.</li>
        <li>Aynı sayıyı atarsan (çift) o değeri dört kez oynarsın.</li>
        <li>Rakibin tek taşı olan haneye gelirsen onu vurursun; vurulan taş bara gider ve yeniden girmesi gerekir.</li>
        <li>Tüm taşların evine ulaşınca toplamaya başlarsın; hepsini ilk toplayan oyunu kazanır.</li>
      </ul>
      <p>
        Daha ayrıntılı bir anlatım için <a href="/nasil-oynanir">tavla nasıl oynanır</a>{' '}
        rehberimize göz atabilirsin. Orada açılış dizilimi, küp (doubling cube), mars/gammon ve
        backgammon gibi kazanma türleri örneklerle açıklanır.
      </p>

      <h2>Nerede ve kime karşı oynayabilirsin?</h2>
      <p>
        TavlaTV birden fazla oyun modu sunar; ruh hâline ve hedefine göre seçim yaparsın.
      </p>
      <ul>
        <li>
          <strong>Yapay zekâya karşı:</strong> Sinir ağı tabanlı{' '}
          <a href="/yz-ile-oyna">tavla botuyla</a> pratik yap. Seviyeyi ayarlayarak kendini yavaş
          yavaş zorlayabilirsin.
        </li>
        <li>
          <strong>Gerçek rakiplerle:</strong> <a href="/online-tavla">Online tavla</a> maçlarında
          dünyanın dört bir yanından oyuncularla eşleş, puanlı karşılaşmalar yap.
        </li>
        <li>
          <strong>Arkadaşınla:</strong> <a href="/arkadasinla-oyna">Özel oda</a> kur, davet kodunu
          paylaş ve dilediğin ayarlarla keyifli maçlar oyna.
        </li>
        <li>
          <strong>Turnuvalarda:</strong> <a href="/online-turnuvalar">Turnuvalara</a> katılıp
          eleme tablolarında yükselerek rekabetin tadını çıkar.
        </li>
      </ul>

      <h2>Tavlanı geliştir</h2>
      <p>
        Tavla oynamak keyifli olduğu kadar gelişime de açıktır. TavlaTV, oynadığın her maçtan bir
        ders çıkarmanı sağlayan araçlar sunar. Maç sonunda gördüğün performans reytingi (PR),
        hamlelerinin en iyi oynanışa ne kadar yakın olduğunu ölçer; düşük PR daha iyi oyun demektir.
        Küp kararlarını, en kritik hamlelerini ve şans-beceri dengesini inceleyerek nerede
        geliştiğini somut olarak görürsün. Böylece tavla, sadece bir eğlence değil, üzerinde
        çalıştıkça ilerlediğin gerçek bir beceri hâline gelir.
      </p>
      <p>
        Kendi oyununu analiz etmenin yanında, güçlü tavla botuna karşı düzenli pratik yapmak da
        beceri kazanmanın en etkili yollarından biridir. Botun seviyesini kademeli olarak artırarak
        kendini zorlar, farklı pozisyonlarda doğru hamleleri içgüdüsel hâle getirirsin. Zamanla pip
        sayımı yapmayı, yarış ile temas oyunlarını ayırt etmeyi ve küpü doğru anda kullanmayı
        öğrenirsin. Rating sistemi ise gelişimini rakamlarla takip etmeni sağlar; puanının yükseldiğini
        görmek, çalışmanın karşılığını aldığını hissettiren güçlü bir motivasyondur.
      </p>

      <h2>Yeni başlayanlar için tavla ipuçları</h2>
      <p>
        Tavlaya yeni başlıyorsan birkaç basit prensip oyununu hızla iyileştirir. Öncelikle taşlarını
        yalnız (blot) bırakmamaya çalış; açıkta kalan tek taş, rakip tarafından vurulabilir ve baştan
        girmek zorunda kalırsın. İkinci olarak, kendi ev bölgende kilit noktalar (özellikle 5 hane)
        kurmaya öncelik ver; bu hem savunmanı güçlendirir hem rakibi zorlar.
      </p>
      <p>
        Zarını attıktan sonra acele etme; iki farklı hamle kombinasyonunu kafanda deneyip hangisinin
        seni daha güvenli bir pozisyona taşıdığını düşün. Yarıştaysan (her iki taraf da birbirini
        geçmişse) hız önemlidir, taşlarını hızla eve taşırsın; ama temas varken güvenlik ön plandadır.
        En önemlisi, kaybettiğin maçlardan ders çıkar: TavlaTV'nin maç analizi, hangi hamlenin daha
        iyi olacağını sana açıkça gösterir. Bu geri bildirim döngüsü, gelişimin en hızlı yoludur.
      </p>

      <h2>Neden TavlaTV'de tavla oynamalısın?</h2>
      <p>
        Bedava tavla oynamak isteyen herkes için TavlaTV güçlü bir seçenektir. Ücretsizdir; oynamak
        için para ödemez, kredi kartı bilgisi girmezsin. Kayıt zorunlu değildir; misafir olarak
        anında başlayabilir, istersen sonradan ücretsiz hesap açarsın. Zarlar kanıtlanabilir şekilde
        adildir, arayüz modern ve mobil uyumludur, kurallar oyunun içinde otomatik uygulanır. Kısaca
        hem yeni başlayanlar hem de deneyimli oyuncular için doğru adres burasıdır.
      </p>

      <h2>Kazanma türleri: tekli, mars ve backgammon</h2>
      <p>
        Tavlada her galibiyet aynı değerde değildir; ne kadar üstün bittiğine göre puan değişir. Rakip
        en az bir taşını toplayabildiyse normal (tekli) galibiyet alırsın ve oyun bir puan değerindedir.
        Rakip hiç taş toplayamadan oyunu bitirirsen bu bir mars (gammon) olur ve iki puan kazanırsın.
      </p>
      <p>
        En görkemli sonuç ise backgammon'dur: rakip hiç taş toplayamadığı gibi, hâlâ barda ya da senin
        ev bölgende taşı varsa, üç puanlık bir zafer elde edersin. Bir de küp (doubling cube) devreye
        girdiğinde bu puanlar katlanır. İşte tam da bu yüzden tavlada yalnızca kazanmak değil, ne kadar
        farkla kazandığın da önemlidir. TavlaTV bu türlerin hepsini otomatik olarak hesaplar; sen sadece
        en iyi sonucu kovalamaya odaklanırsın.
      </p>

      <h2>Sık sorulan sorular</h2>
      <h3>Tavla oynamak ücretsiz mi?</h3>
      <p>
        Evet. TavlaTV'de tavla oynamak tamamen bedavadır. Dilersen Premium üyelikle ekstra
        analiz ve reklamsız deneyim gibi ayrıcalıklara sahip olabilirsin.
      </p>
      <h3>Yeni başlayanlar için uygun mu?</h3>
      <p>
        Kesinlikle. Kurallar oyunun içinde uygulandığı için hata yapmadan öğrenirsin. Ayrıca{' '}
        <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberimiz her adımı sade bir dille anlatır.
      </p>
      <h3>Tek başıma tavla oynayabilir miyim?</h3>
      <p>
        Evet. Yapay zekâ botuna karşı tek başına oynayarak pratik yapabilir, açılışları ve farklı
        stratejileri deneyebilirsin.
      </p>
      <h3>İnternet olmadan tavla oynanır mı?</h3>
      <p>
        TavlaTV canlı maçlar, turnuvalar ve analiz için internet bağlantısı gerektirir. Botla
        oynamak için de tarayıcıda çevrimiçi olman yeterlidir.
      </p>

      <div className="seo-cta">
        <Button asChild className="seo-cta-btn">
          <a href="/tavla-oyna">
            <Icon name="play" size={18} /> Hemen Tavla Oyna
          </a>
        </Button>
      </div>
    </div>
  )
}

export default function SeoContent({ variant, onClose }: Props) {
  useEscape(onClose)

  if (variant === 'home') {
    return <HomeContent />
  }

  const isOnline = variant === 'online-tavla'
  const h1 = isOnline ? 'Online Tavla Oyna' : 'Tavla Oyna'
  const heroSub = isOnline
    ? 'Gerçek rakiplere karşı canlı maçlar, güçlü yapay zekâ ve turnuvalar — hepsi tarayıcında, ücretsiz.'
    : 'Bedava, kayıtsız ve anında açılan tavla. Yeni başla ya da puanlı maçlarda ustalaş.'
  const heroCta = isOnline ? 'Hemen Online Tavla Oyna' : 'Hemen Tavla Oyna'

  return (
    <div className="register-card info-card seo-landing-card" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </Button>
      )}
      <header className="seo-hero">
        <span className="seo-eyebrow">Ücretsiz · Kayıtsız · Tarayıcıda</span>
        <h1 className="info-title seo-hero-title">{h1}</h1>
        <p className="seo-hero-sub">{heroSub}</p>
        <div className="seo-hero-cta">
          <Button asChild className="seo-cta-btn">
            <a href="/yeni-oyun">
              <Icon name="play" size={18} /> {heroCta}
            </a>
          </Button>
        </div>
      </header>
      <div className="info-tab-pane seo-landing-body-wrap">
        {isOnline ? <OnlineTavlaContent /> : <TavlaOynaContent />}
      </div>
    </div>
  )
}
