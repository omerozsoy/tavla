/**
 * SeoAppSection — uygulama/kurulum sayfalarının (yeni-oyun, yz-ile-oyna, arkadaşınla-oyna)
 * ALTINA gömülen kompakt, taranabilir SEO içerik kartı. Amaç: bu sayfalar etkileşimli
 * kurulum ekranları olduğundan özgün metin azdı ve Google "taranan ama indekslenmiyor"
 * diyordu; görünür bir tanıtım + kısa Q&A + iç linkler ekleyerek benzersiz içerik sağlarız.
 *
 * Tasarım: SeoContent 'home' varyantıyla aynı kart (.seo-content-home). H1 YOK (sayfa
 * başlığı/meta + noscript H1 başkadır); görünür başlık H2. İç linkler normal <a href>
 * (SPA fallback 200 döner, taranabilir gerçek bağlantı). Sunucu tarafı karşılığı: SeoMeta
 * LANDING (noscript) — ikisi birlikte JS'li/JS'siz tüm botları kapsar.
 */

import { IS_NATIVE_APP } from '../appEnv'

export type SeoAppPage =
  | 'yeni-oyun'
  | 'yz-ile-oyna'
  | 'arkadasinla-oyna'
  | 'turkiye-online-tavla-ligi'
  | 'takimlar-ligi'

function YeniOyun() {
  return (
    <div className="info-rich rich">
      <h2>Online Tavla Maçı Oyna</h2>
      <p>
        Yeni Oyun ekranından gerçek rakiplere karşı puanlı bir <a href="/online-tavla">online tavla</a>{' '}
        maçı başlatabilirsin. Maç uzunluğunu (1, 3, 5, 7…) ve süre kontrolünü seçer, eşleşmeni
        bulur ve canlı olarak oynarsın. Maç bitince hamlelerinin ne kadar isabetli olduğunu
        gösteren performans reytingini (PR) ve rating değişimini görürsün.
      </p>
      <ul>
        <li><strong>Maç ayarları:</strong> Uzunluk ve süre kontrolünü kendine göre seç.</li>
        <li><strong>Canlı ve puanlı:</strong> Gerçek oyuncularla eşleş, rating kazan.</li>
        <li><strong>Analiz:</strong> Maç sonunda PR ile gelişimini takip et.</li>
      </ul>
      <h3>Online tavla oynamak için üye olmam gerekir mi?</h3>
      <p>
        Misafir olarak da oynayabilirsin; ancak rating, maç geçmişi ve{' '}
        <a href="/online-turnuvalar">turnuvalar</a> için ücretsiz üyelik önerilir. Kuralları
        hatırlamak istersen <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberine göz at,
        istersen önce <a href="/yz-ile-oyna">yapay zekâya karşı</a> pratik yapıp sonra canlı maça çık.
      </p>
    </div>
  )
}

function YzIleOyna() {
  return (
    <div className="info-rich rich">
      <h2>Yapay Zekâya Karşı Tavla Oyna</h2>
      <p>
        Sinir ağı tabanlı güçlü tavla botuna karşı oynayarak istediğin an pratik yapabilirsin.
        Zorluk seviyesini seçer, rakip beklemeden antrenman yaparsın. Bot tamamen tarayıcında
        çalışır; sunucuya ihtiyaç duymadan, çevrimdışıyken bile oyun akışın bozulmaz.
      </p>
      <ul>
        <li><strong>Seviye seçimi:</strong> Yeni başlayandan ustaya zorluğu ayarla.</li>
        <li><strong>Anında oyun:</strong> Eşleşme beklemeden hemen başla.</li>
        <li><strong>Gelişim:</strong> Hamlelerini <a href="/pozisyon-analizi">pozisyon analizi</a> ile incele.</li>
      </ul>
      <h3>Tavla botu ne kadar güçlü?</h3>
      <p>
        Bot, milyonlarca oyunla eğitilmiş bir sinir ağı kullanır; ileri seviyelerde ciddi bir
        rakiptir. Daha iyi oynamak için <a href="/tavla-rehberi">tavla strateji rehberini</a> okuyabilir,
        temel kurallar için <a href="/nasil-oynanir">tavla kurallarına</a> bakabilirsin.
      </p>
    </div>
  )
}

function ArkadasinlaOyna() {
  return (
    <div className="info-rich rich">
      <h2>Arkadaşınla Tavla Oyna</h2>
      <p>
        Arkadaşını davet ederek özel bir tavla maçı kurabilirsin. Maç türünü, uzunluğunu ve süre
        kontrolünü birlikte belirler, davet bağlantısıyla rakibini çağırır ve baş başa keyifli bir
        karşılaşma yaparsınız. İster puanlı ister dostluk maçı yapın; seçim sizin.
      </p>
      <ul>
        <li><strong>Özel davet:</strong> Arkadaşını bağlantı ile maça çağır.</li>
        <li><strong>Esnek ayarlar:</strong> Maç türü, uzunluk ve süreyi birlikte seç.</li>
        <li><strong>Baş başa:</strong> Puanlı ya da rahat bir dostluk maçı yapın.</li>
      </ul>
      <h3>Rakip bulamazsam ne yapabilirim?</h3>
      <p>
        Arkadaşın müsait değilse <a href="/yeni-oyun">online eşleşmeyle</a> gerçek rakip bulabilir,{' '}
        <a href="/yz-ile-oyna">yapay zekâya karşı</a> pratik yapabilir ya da{' '}
        <a href="/online-turnuvalar">online turnuvalara</a> katılabilirsin.
      </p>
    </div>
  )
}

function LigContent() {
  return (
    <div className="info-rich rich">
      <h2>TavlaTV Süper Lig Nedir?</h2>
      <p>
        TavlaTV Süper Lig, turnuvalardan bağımsız olarak sezonluk lig formatında oynanan
        bir rekabet modülüdür. Belirlenen sezon boyunca oyuncular her turda birer rakiple eşleşir;
        alınan sonuçlar bir puan tablosuna işlenir. Sezon sonunda üst sıradaki oyuncular eleme
        ağacında (play-off) karşılaşarak lig şampiyonunu belirler. Amaç, tek bir maçın değil, tüm
        sezona yayılan istikrarlı performansın ödüllendirildiği uzun soluklu bir yarış sunmaktır.
      </p>
      <ul>
        <li><strong>Sezonluk format:</strong> Her tur yeni bir eşleşme, güncel puan tablosu ve play-off.</li>
        <li><strong>Rating’ten ayrı:</strong> Lig puanı, normal <a href="/online-tavla">online tavla</a> rating’inden ayrı tutulur; ligdeki sonuç günlük rating’ini doğrudan değiştirmez.</li>
        <li><strong>Adil eşleşme:</strong> Her turda daha önce karşılaşmadığın rakiplerle eşleşmeye çalışılır.</li>
        <li><strong>Şampiyonluk:</strong> Sezon sonu play-off’larıyla lig birincisi belirlenir.</li>
      </ul>
      <h3>Lig, turnuvadan ne farklı?</h3>
      <p>
        Turnuva genellikle tek seferde tamamlanan bir elemeyken, lig tüm sezona yayılır: istikrar
        ödüllendirilir, kötü bir maç her şeyi bitirmez. Dilersen aynı anda{' '}
        <a href="/online-turnuvalar">online tavla turnuvalarına</a> da katılmaya devam edebilirsin.
      </p>
      <h3>Lige nasıl katılırım?</h3>
      <p>
        Aktif sezon açıkken lig sayfasından katılır, turların geldikçe maçlarını zamanında oynarsın.
        Güncel sıralamanı buradan, genel sıralamayı ise <a href="/lider-tablosu">lider tablosundan</a>{' '}
        takip edebilirsin. Oyununu geliştirmek için <a href="/tavla-rehberi">tavla stratejileri</a>{' '}
        rehberimize göz atabilirsin.
      </p>
    </div>
  )
}

function TakimlarContent() {
  return (
    <div className="info-rich rich">
      <h2>Takımlar Ligi: Takımınla Rekabetçi Online Tavla</h2>
      <p>
        Takımlar Ligi, oyuncuların takım kurup düellolarla puan toplayarak yarıştığı, bireysel lig ve
        turnuvalardan bağımsız bir takım modülüdür. Kendi takımını kurabilir ya da mevcut bir takıma
        katılabilirsin. Çevrimiçi başka bir takımlı oyuncuya düello açarsın; kazandığın maç uzunluğu
        kadar düello puanı hem sana hem takımına eklenir. Takımlar iki ayrı listede sıralanır: toplam
        düello puanı ve üye <a href="/lider-tablosu">rating</a> ortalaması.
      </p>
      <ul>
        <li><strong>Takım kur veya katıl:</strong> Premium üyelik + en az 20 tamamlanmış puanlı maç + 10.000 coin ile takım kurabilir ya da hazır bir takıma katılabilirsin. Bir takım en fazla 12 üye alır (1 kurucu + 2 yardımcı).</li>
        <li><strong>Düello puanı:</strong> Üyeler çevrimiçi takımlı oyunculara 1v1 düello açar (1, 3 veya 5 puanlık); kazanan, maç uzunluğu kadar puanı takımına kazandırır.</li>
        <li><strong>Rating ortalaması:</strong> Takım, yeterli üyeye ulaştığında üyelerinin <a href="/lider-tablosu">rating</a> ortalamasıyla da sıralanır.</li>
        <li><strong>Gerçek maçlar:</strong> Düellolar canlı <a href="/online-tavla">online tavla</a> maçlarıyla oynanır; coin veya bahis yoktur, bireysel rating etkilenmez.</li>
      </ul>
      <h3>Takım sıralaması nasıl belirlenir?</h3>
      <p>
        İki ayrı liste tutulur: üyelerin topladığı toplam düello puanı ve takımın üye rating ortalaması.
        Böylece hem düzenli düello yapmak hem de güçlü bir kadro kurmak önem kazanır.
      </p>
      <h3>Takım kurmak ücretli mi?</h3>
      <p>
        Takım kurmak için Premium üyelik, en az 20 tamamlanmış puanlı maç ve 10.000 coin gerekir; coin
        yalnız kuruluş başarılı olursa bir kez kesilir. Ad ve etiket değişikliği kurucuya ücretsizdir.
        Tavlanı geliştirmek istersen <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberiyle
        temelleri tazeleyebilirsin.
      </p>
    </div>
  )
}

const PAGES: Record<SeoAppPage, () => React.JSX.Element> = {
  'yeni-oyun': YeniOyun,
  'yz-ile-oyna': YzIleOyna,
  'arkadasinla-oyna': ArkadasinlaOyna,
  'turkiye-online-tavla-ligi': LigContent,
  'takimlar-ligi': TakimlarContent,
}

export default function SeoAppSection({ page }: { page: SeoAppPage }) {
  if (IS_NATIVE_APP) return null // kurulu APK'da SEO içeriği gösterme (arama motoru için)
  const Body = PAGES[page]
  if (!Body) return null
  return (
    <section className="seo-content seo-content-home" aria-label="Sayfa hakkında">
      <Body />
    </section>
  )
}
