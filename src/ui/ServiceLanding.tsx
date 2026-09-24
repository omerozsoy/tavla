/**
 * ServiceLanding — turnuva organizasyonu SEO servis sayfalari + /iletisim.
 *
 * 5 slug:
 *  - tavla-turnuvasi-organizasyonu (HUB)  → "Tavla Turnuvası Organizasyonu", "Tavla Organizasyonu"
 *  - kurumsal-tavla-turnuvasi             → "Kurumsal Tavla Turnuvası"
 *  - belediye-tavla-turnuvasi             → "Belediye Tavla Turnuvası"
 *  - avm-tavla-turnuvasi                  → "AVM Tavla Turnuvası"
 *  - iletisim                             → genel iletişim sayfası (footer)
 *
 * SeoContent (online-tavla/tavla-oyna) ile ayni page-host + hero deseni; CTA yerine
 * ContactForm. Govde admin-duzenlenebilir: DB'de body varsa (InfoPage) onu, yoksa
 * buradaki hardcoded fallback'i render eder (sayfa asla bos kalmaz). Ic linkler
 * hub↔alt sayfalar (hub-and-spoke). Bkz [[seo-online-tavla-tavla-oyna-landing]].
 */

import { Icon, type IconName } from './Icon'
import { useEscape } from './useEscape'
import { useInfoPage } from './useInfoPage'
import { InfoPane } from './Info'
import ContactForm from './ContactForm'
import { useT } from '../i18n'
import Breadcrumb, { homeCrumb } from './Breadcrumb'

interface Props {
  slug: string
  onClose?: () => void
}

interface Meta {
  eyebrow: string
  h1: string
  heroSub: string
  subject: string // ContactForm varsayilan talep turu
  formHeading: string
}

const META: Record<string, Meta> = {
  'tavla-turnuvasi-organizasyonu': {
    eyebrow: 'Anahtar Teslim Organizasyon',
    h1: 'Tavla Turnuvası Organizasyonu',
    heroSub:
      'Kurumlar, belediyeler ve AVM’ler için anahtar teslim tavla turnuvası organizasyonu: kurgu, hakemlik, dijital eşleşme tabloları ve ödül töreni dahil.',
    subject: 'genel',
    formHeading: 'Turnuva organizasyonu için teklif alın',
  },
  'kurumsal-tavla-turnuvasi': {
    eyebrow: 'Kurumsal Etkinlik',
    h1: 'Kurumsal Tavla Turnuvası',
    heroSub:
      'Şirketiniz için takım ruhunu güçlendiren, çalışan bağlılığını artıran kurumsal tavla turnuvası organizasyonu. Ofiste, otelde veya hibrit online.',
    subject: 'kurumsal',
    formHeading: 'Kurumsal turnuvanız için teklif alın',
  },
  'belediye-tavla-turnuvasi': {
    eyebrow: 'Kültür & Etkinlik',
    h1: 'Belediye Tavla Turnuvası',
    heroSub:
      'Belediyeler için kitlesel katılımlı, geleneksel tavla turnuvası organizasyonu. Festival, Ramazan etkinlikleri ve mahalle turnuvaları için uçtan uca kurgu.',
    subject: 'belediye',
    formHeading: 'Belediye turnuvanız için teklif alın',
  },
  'avm-tavla-turnuvasi': {
    eyebrow: 'Marka Etkinliği',
    h1: 'AVM Tavla Turnuvası',
    heroSub:
      'AVM’ler için ziyaretçi çeken, markaya değer katan tavla turnuvası organizasyonu. Sponsorluk, sahne kurulumu ve canlı skor ekranlarıyla tam etkinlik.',
    subject: 'avm',
    formHeading: 'AVM etkinliğiniz için teklif alın',
  },
  iletisim: {
    eyebrow: 'Bize Ulaşın',
    h1: 'İletişim',
    heroSub:
      'Turnuva organizasyonu, iş birliği ve her türlü sorunuz için bize yazın. En kısa sürede size dönüş yapalım.',
    subject: 'genel',
    formHeading: 'Bize mesaj gönderin',
  },
}

// ---- Hardcoded fallback govdeler (DB body yoksa) --------------------------------

function HubBody() {
  return (
    <>
      <p className="rules-intro">
        TavlaTV olarak; kurumlar, belediyeler, alışveriş merkezleri ve festivaller için{' '}
        <strong>anahtar teslim tavla turnuvası organizasyonu</strong> yapıyoruz. Fikir aşamasından
        ödül törenine kadar tüm süreci biz kurguluyoruz: format tasarımı, katılımcı kaydı, hakemlik,
        dijital eşleşme tabloları, canlı skor ekranları ve ödüllendirme. Siz yalnızca etkinliğin
        tadını çıkarın.
      </p>

      <h2>Tavla organizasyonu neyi kapsar?</h2>
      <p>
        Başarılı bir tavla turnuvası, sadece masaları dizmekten ibaret değildir. Doğru format,
        adil hakemlik, akıcı bir eşleşme sistemi ve seyirciyi içine çeken bir sahne kurgusu gerekir.
        Biz bu bileşenlerin hepsini tek elden yönetiyoruz; böylece etkinliğiniz profesyonel,
        şeffaf ve akılda kalıcı olur.
      </p>
      <ul>
        <li>
          <strong>Format ve kurgu:</strong> Katılımcı sayısına göre eleme, İsviçre sistemi veya
          gruplu tablo; süre kontrolü ve puanlı maç ayarları.
        </li>
        <li>
          <strong>Kayıt ve organizasyon:</strong> Katılımcı kaydı, kura çekimi, program akışı ve
          sunuculuk.
        </li>
        <li>
          <strong>Hakemlik:</strong> Deneyimli hakemler ve resmî{' '}
          <a href="/turnuva-kurallari">tavla turnuva kuralları</a> (WBF) ile anlaşmazlıksız maçlar.
        </li>
        <li>
          <strong>Dijital altyapı:</strong> Canlı eşleşme tabloları, skor ekranları ve dilerseniz
          maç analizleri (PR).
        </li>
        <li>
          <strong>Ödül ve tören:</strong> Kupalar, madalyalar, sertifikalar ve markanıza uygun ödül
          töreni.
        </li>
      </ul>

      <h2>Kimler için tavla turnuvası düzenliyoruz?</h2>
      <p>
        Her etkinliğin amacı farklıdır; biz de organizasyonu o amaca göre tasarlarız. Öne çıkan üç
        alanda özel çözümler sunuyoruz:
      </p>
      <ul>
        <li>
          <strong><a href="/kurumsal-tavla-turnuvasi">Kurumsal tavla turnuvası</a>:</strong> Şirket
          içi motivasyon, takım ruhu ve çalışan bağlılığı için ideal etkinlik.
        </li>
        <li>
          <strong><a href="/belediye-tavla-turnuvasi">Belediye tavla turnuvası</a>:</strong> Kitlesel
          katılımlı, geleneği yaşatan kültür etkinlikleri.
        </li>
        <li>
          <strong><a href="/avm-tavla-turnuvasi">AVM tavla turnuvası</a>:</strong> Ziyaretçi trafiği
          ve marka etkileşimi yaratan aktivasyonlar.
        </li>
      </ul>

      <h2>Neden TavlaTV ile çalışmalısınız?</h2>
      <p>
        Biz aynı zamanda Türkiye’nin dijital tavla platformuyuz. Bu, organizasyonunuza rakiplerin
        sunamadığı bir teknik derinlik katar. Kanıtlanabilir adil zar motoru, saniyesinde güncellenen
        eşleşme tabloları ve isteğe bağlı maç analizleriyle turnuvanız hem şeffaf hem de görsel olarak
        etkileyici olur. Dilerseniz etkinliği <a href="/online-turnuvalar">online turnuva</a> ayağıyla
        birleştirip hibrit bir formata dönüştürür, katılımı fiziksel salonun ötesine taşırız.
      </p>

      <h2>Nasıl ilerliyoruz?</h2>
      <p>
        Süreç sizin için olabildiğince basit: aşağıdaki formu doldurup etkinlik amacınızı,
        yaklaşık tarihi ve katılımcı sayısını iletin. Ekibimiz kısa sürede sizinle iletişime geçsin,
        ihtiyacınıza özel bir kurgu ve teklif hazırlasın. İster tek günlük bir etkinlik, ister sezon
        boyu sürecek bir turnuva serisi olsun; ölçeğe uygun bir çözüm üretiriz.
      </p>
    </>
  )
}

function KurumsalBody() {
  return (
    <>
      <p className="rules-intro">
        <strong>Kurumsal tavla turnuvası</strong>, çalışanları rahat bir ortamda bir araya getiren,
        rekabeti eğlenceyle harmanlayan güçlü bir etkinlik formatıdır. TavlaTV olarak şirketiniz için
        ofiste, otelde ya da hibrit online düzende anahtar teslim kurumsal turnuvalar düzenliyoruz.
      </p>

      <h2>Neden kurumsal tavla turnuvası?</h2>
      <p>
        Tavla, her yaştan ve her departmandan çalışanın kolayca katılabildiği ender oyunlardandır.
        Kısa sürede öğrenilir, ama ustalık gerektirir; bu denge, hem yeni başlayanların hem de
        tecrübeli oyuncuların keyif almasını sağlar. Bir turnuva boyunca farklı ekiplerden insanlar
        aynı masada buluşur, gündelik hiyerarşi çözülür ve doğal bir kaynaşma oluşur.
      </p>
      <ul>
        <li><strong>Takım ruhu:</strong> Departmanlar arası tanışma ve iş birliği.</li>
        <li><strong>Motivasyon:</strong> Rekabetçi ama stressiz, keyifli bir mola.</li>
        <li><strong>Kapsayıcılık:</strong> Yaş ve pozisyon fark etmeksizin herkes oynayabilir.</li>
        <li><strong>Marka içi etkinlik:</strong> Şirket değerlerinizle uyumlu, akılda kalıcı bir gün.</li>
      </ul>

      <h2>Etkinliği sizin için kurguluyoruz</h2>
      <p>
        Katılımcı sayınıza göre eleme veya gruplu tablo tasarlar, süre kontrolünü ofis gününüze göre
        ayarlarız. Deneyimli hakemlerimiz resmî{' '}
        <a href="/turnuva-kurallari">tavla turnuva kurallarını</a> uygular; canlı eşleşme ekranları
        turnuvayı herkes için takip edilebilir kılar. Kupalar, sertifikalar ve ödül töreniyle
        etkinliği tamamlarız.
      </p>

      <h2>Hibrit ve online seçenek</h2>
      <p>
        Farklı şehirlerdeki ofisleriniz mi var? Etkinliği{' '}
        <a href="/online-turnuvalar">online turnuva</a> ayağıyla birleştirerek uzaktaki ekipleri de
        aynı tabloya dahil edebiliriz. Böylece kurumsal turnuvanız coğrafyadan bağımsız, gerçekten
        kapsayıcı bir hâle gelir.
      </p>

      <h2>Teklif alın</h2>
      <p>
        Şirketiniz için bir <a href="/tavla-turnuvasi-organizasyonu">tavla turnuvası organizasyonu</a>{' '}
        planlıyorsanız, aşağıdaki formu doldurun. Çalışan sayınıza ve beklentilerinize uygun bir
        kurgu ve teklifle en kısa sürede size dönelim.
      </p>
    </>
  )
}

function BelediyeBody() {
  return (
    <>
      <p className="rules-intro">
        <strong>Belediye tavla turnuvası</strong>, geleneği yaşatan, mahalleyi bir araya getiren ve
        yüksek katılım sağlayan bir kültür etkinliğidir. TavlaTV olarak belediyeler için festivallerde,
        Ramazan etkinliklerinde ve kültür günlerinde kitlesel tavla turnuvaları düzenliyoruz.
      </p>

      <h2>Halkı buluşturan bir gelenek</h2>
      <p>
        Tavla, Türkiye’nin en köklü sosyal oyunlarından biridir; kahvehaneden meydana kadar her yerde
        oynanır. Bir belediye turnuvası, bu geleneği modern bir organizasyonla buluşturur: gençten
        yaşlıya herkesin katılabildiği, mahalle sakinlerini kaynaştıran, şehre değer katan bir etkinlik
        ortaya çıkar.
      </p>
      <ul>
        <li><strong>Yüksek katılım:</strong> Yüzlerce katılımcılı, kitlesel tablo yönetimi.</li>
        <li><strong>Kapsayıcılık:</strong> Her yaştan hemşehrinin katılabileceği format.</li>
        <li><strong>Kültürel değer:</strong> Geleneksel oyunu genç kuşaklara taşıma.</li>
        <li><strong>Sosyal etki:</strong> Meydanları ve etkinlik alanlarını canlandırma.</li>
      </ul>

      <h2>Kitlesel organizasyonda tecrübe</h2>
      <p>
        Yüksek katılımlı turnuvalar özel bir altyapı ister. Dijital kayıt ve kura sistemimiz,
        yüzlerce katılımcıyı hatasız eşleştirir; canlı skor ekranları meydandaki herkesin turnuvayı
        takip etmesini sağlar. Deneyimli hakemlerimiz ve resmî{' '}
        <a href="/turnuva-kurallari">turnuva kuralları</a> ile maçlar adil ve tartışmasız ilerler.
      </p>

      <h2>Festival ve özel dönem etkinlikleri</h2>
      <p>
        Ramazan sokakları, şehir festivalleri, gençlik haftası ya da kültür günleri — hangi dönem
        olursa olsun etkinliği o atmosfere uygun kurgularız. Sahne, ses ve ödül töreni dahil tüm
        organizasyonu üstlenerek belediyenize anahtar teslim bir{' '}
        <a href="/tavla-turnuvasi-organizasyonu">tavla organizasyonu</a> sunarız.
      </p>

      <h2>Teklif alın</h2>
      <p>
        Belediyeniz için bir tavla turnuvası planlıyorsanız aşağıdaki formu doldurun; beklenen
        katılımcı sayısına ve etkinlik takviminize uygun bir teklifle size dönelim.
      </p>
    </>
  )
}

function AvmBody() {
  return (
    <>
      <p className="rules-intro">
        <strong>AVM tavla turnuvası</strong>, alışveriş merkezinize ziyaretçi çeken, ziyaret süresini
        uzatan ve markanıza etkileşim kazandıran güçlü bir aktivasyondur. TavlaTV olarak AVM’ler için
        sahne kurulumundan canlı skor ekranlarına kadar tam kapsamlı tavla etkinlikleri düzenliyoruz.
      </p>

      <h2>Ziyaretçi çeken bir etkinlik</h2>
      <p>
        Tavla, izlemesi de oynaması da keyifli bir oyundur; bir turnuva anında kalabalık toplar.
        AVM’nizde kurulan bir tavla etkinliği, ziyaretçilerin daha uzun kalmasını, sosyal medyada
        paylaşım yapmasını ve mağazalarınızla daha çok etkileşime girmesini sağlar. Doğru kurguyla
        turnuva, hem eğlence hem de pazarlama aracına dönüşür.
      </p>
      <ul>
        <li><strong>Yaya trafiği:</strong> Etkinlik günlerinde artan ziyaretçi sayısı.</li>
        <li><strong>Marka etkileşimi:</strong> Sponsor markalar için görünürlük ve deneyim alanı.</li>
        <li><strong>Sosyal paylaşım:</strong> Fotoğraflanabilir sahne ve canlı skor ekranları.</li>
        <li><strong>Aile dostu:</strong> Her yaştan ziyaretçinin katılabileceği format.</li>
      </ul>

      <h2>Sahne, sponsorluk ve prodüksiyon</h2>
      <p>
        Etkinlik alanınızı bir turnuva sahnesine dönüştürüyoruz: markalı masalar, canlı skor ekranları,
        sunuculuk ve ödül töreni dahil. Sponsorluk entegrasyonlarıyla etkinliği gelir modeline
        bağlayabilir; dilerseniz <a href="/online-turnuvalar">online turnuva</a> ayağıyla katılımı
        AVM dışına da taşıyabiliriz.
      </p>

      <h2>Adil ve şeffaf turnuva</h2>
      <p>
        Deneyimli hakemlerimiz ve resmî <a href="/turnuva-kurallari">tavla turnuva kuralları</a> ile
        maçlar tartışmasız ilerler. Dijital eşleşme sistemimiz, kalabalık katılımı bile akıcı biçimde
        yönetir; ziyaretçiler turnuvayı büyük ekranlardan canlı izler.
      </p>

      <h2>Teklif alın</h2>
      <p>
        AVM’niz için bir <a href="/tavla-turnuvasi-organizasyonu">tavla turnuvası organizasyonu</a>{' '}
        planlıyorsanız, aşağıdaki formu doldurun; etkinlik tarihinize ve alanınıza uygun bir kurgu ve
        teklifle size dönelim.
      </p>
    </>
  )
}

// /iletisim sayfasi ust bilgi kartlari: e-posta, GSM, Instagram, YouTube. Sadece
// iletisim slug'inda hero altinda (ust) render edilir; form asagida kalir.
const CHANNELS: { icon: IconName; label: string; value: string; href: string; ext?: boolean }[] = [
  { icon: 'mail', label: 'E-posta', value: 'bilgi@tavlatv.com', href: 'mailto:bilgi@tavlatv.com' },
  { icon: 'phone', label: 'GSM', value: '+90 537 389 1907', href: 'tel:+905373891907' },
  {
    icon: 'instagram',
    label: 'Instagram',
    value: 'instagram.com/tavlatv',
    href: 'https://instagram.com/tavlatv',
    ext: true,
  },
  {
    icon: 'youtube',
    label: 'YouTube',
    value: 'youtube.com/@TavlaTV',
    href: 'https://www.youtube.com/@TavlaTV',
    ext: true,
  },
]

function ContactChannels() {
  return (
    <div className="contact-channels" aria-label="İletişim kanalları">
      {CHANNELS.map((c) => (
        <a
          key={c.label}
          className="contact-channel"
          href={c.href}
          {...(c.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <span className="cc-icon">
            <Icon name={c.icon} size={20} />
          </span>
          <span className="cc-text">
            <span className="cc-label">{c.label}</span>
            <span className="cc-value">{c.value}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

function IletisimBody() {
  return (
    <>
      <p className="rules-intro">
        TavlaTV ile iletişime geçmek çok kolay. Turnuva organizasyonu, sponsorluk, iş birliği ya da
        her türlü sorunuz için aşağıdaki formu doldurmanız yeterli; en kısa sürede size dönüş yaparız.
      </p>

      <h2>Ne için yazabilirsiniz?</h2>
      <ul>
        <li>
          <strong><a href="/tavla-turnuvasi-organizasyonu">Tavla turnuvası organizasyonu</a></strong>{' '}
          — kurumsal, belediye, AVM ve festival etkinlikleri.
        </li>
        <li><strong>İş birliği ve sponsorluk</strong> — marka iş birlikleri ve etkinlik sponsorlukları.</li>
        <li><strong>Kulüp ve topluluk</strong> — tavla kulüpleri ve turnuva takvimi için öneriler.</li>
        <li><strong>Destek</strong> — platformla ilgili soru ve geri bildirimler.</li>
      </ul>

      <h2>Turnuva mı düzenlemek istiyorsunuz?</h2>
      <p>
        Bir etkinlik planlıyorsanız, talep türünü “Kurumsal / Belediye / AVM” olarak seçip etkinlik
        amacınızı ve yaklaşık katılımcı sayısını yazın. Böylece size en uygun kurgu ve teklifle daha
        hızlı dönüş yapabiliriz.
      </p>
    </>
  )
}

function fallbackBody(slug: string) {
  switch (slug) {
    case 'tavla-turnuvasi-organizasyonu':
      return <HubBody />
    case 'kurumsal-tavla-turnuvasi':
      return <KurumsalBody />
    case 'belediye-tavla-turnuvasi':
      return <BelediyeBody />
    case 'avm-tavla-turnuvasi':
      return <AvmBody />
    case 'iletisim':
      return <IletisimBody />
    default:
      return null
  }
}

export default function ServiceLanding({ slug, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const page = useInfoPage(slug)
  const dbBody = (page?.body ?? '').trim()
  const meta = META[slug] ?? META.iletisim

  return (
    // Standart alt sayfa formati (SeoContent/GuideView/TournamentRules ile birebir):
    // seo-landing-card = sola dayali 1400px seffaf zemin; desktop'ta KAPATMA (X) gizli
    // (footer/menu ile acilir), mobilde X geri gelir. service-landing = sola dayali baslik.
    <div className="register-card info-card seo-landing-card service-landing">
      {onClose && (
        <button className="modal-close" onClick={onClose} aria-label="Kapat" type="button">
          <Icon name="x" size={16} />
        </button>
      )}
      <Breadcrumb items={[homeCrumb(t), { name: meta.h1 }]} />
      <header className="service-landing-head">
        <h1 className="info-title service-landing-title">{meta.h1}</h1>
        <p className="service-landing-sub">{meta.heroSub}</p>
      </header>
      <div className="info-tab-pane seo-landing-body-wrap">
        {slug === 'iletisim' && <ContactChannels />}
        <div className="info-rich rich seo-landing-body">
          {/* DB gövdesi galeri-farkında render edilir (<resimgalerisi>/<ad> token'ları
              gerçek galeriye çevrilir — InfoPane; aksi halde token düz metin kalırdı). */}
          {dbBody ? <InfoPane page={page ?? undefined} /> : fallbackBody(slug)}

          <div className="service-form-anchor">
            <ContactForm
              sourcePage={slug}
              defaultSubject={meta.subject}
              heading={meta.formHeading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
