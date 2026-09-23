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

export type SeoAppPage = 'yeni-oyun' | 'yz-ile-oyna' | 'arkadasinla-oyna'

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

const PAGES: Record<SeoAppPage, () => React.JSX.Element> = {
  'yeni-oyun': YeniOyun,
  'yz-ile-oyna': YzIleOyna,
  'arkadasinla-oyna': ArkadasinlaOyna,
}

export default function SeoAppSection({ page }: { page: SeoAppPage }) {
  const Body = PAGES[page]
  if (!Body) return null
  return (
    <section className="seo-content seo-content-home" aria-label="Sayfa hakkında">
      <Body />
    </section>
  )
}
