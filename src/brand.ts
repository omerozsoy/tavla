// Çoklu marka / çoklu domain — istemci tarafı TEK kaynak.
//
// tavlatv.com  -> Türkçe, "TavlaTv" markası + mevcut logo
// gammontv.com -> İngilizce, "GammonTV" markası + ayrı logo (opsiyonel resim slotu)
//
// İki domain AYNI uygulamayı/DB'yi paylaşır; yalnız sunulan DİL + MARKA host'tan belirlenir.
// Bu modül i18n'den HİÇBİR ŞEY import ETMEZ (i18n bundan import eder → tek yönlü bağımlılık).
//
// Dil kuralı (gereksinim): marka açılış dilini belirler; tarayıcı dili veya eski kayıtlı
// tercih bunu DEĞİŞTİRMEZ (bkz. i18n LangProvider başlangıç durumu). localStorage origin'e
// özel olduğundan iki domain arasında tercih/çerez SIZMAZ.

export type BrandKey = 'tavla' | 'gammon'
export type BrandLocale = 'tr' | 'en'

export interface Brand {
  key: BrandKey
  name: string // marka adı (logo aria-label, başlık son eki, e-posta)
  locale: BrandLocale // açılış dili
  origin: string // kanonik origin (mutlak URL üretimi)
  /** Wordmark harfleri. 'A'→yukarı üçgen, 'V'→aşağı üçgen; diğer harfler düz. */
  logoText: string
  /** Gerçek logo görseli gelince doldurulur; verilirse wordmark yerine <img> kullanılır. */
  logoSrc?: string
  /** PWA manifest yolu (host'a göre). */
  manifest: string
  /** Cep telefonu zorunlu mu + sorulsun mu? TavlaTv (TR) evet; GammonTV (yabancı) hayır. */
  requirePhone: boolean
}

const BRANDS: Record<BrandKey, Brand> = {
  tavla: {
    key: 'tavla',
    name: 'TavlaTv',
    locale: 'tr',
    origin: 'https://www.tavlatv.com',
    logoText: 'TAVLATV',
    manifest: '/manifest.webmanifest',
    requirePhone: true,
  },
  gammon: {
    key: 'gammon',
    name: 'GammonTV',
    locale: 'en',
    origin: 'https://www.gammontv.com',
    logoText: 'GAMMONTV',
    // logoSrc: '/gammontv-logo.svg',  // gerçek GammonTV logosu eklenince aç (tasarım hazır olunca)
    manifest: '/manifest.en.webmanifest',
    requirePhone: false, // yabancı kullanıcıdan telefon istenmez
  },
}

/** Host dizesinden marka çöz (eşleşme yoksa tavla). SSR/test için host verilebilir. */
export function resolveBrand(hostname?: string): Brand {
  const h = (hostname ?? (typeof location !== 'undefined' ? location.hostname : '')).toLowerCase()
  if (h.includes('gammontv')) return BRANDS.gammon
  return BRANDS.tavla
}

/** Geçerli host'un markası (modül yüklenirken bir kez çözülür). */
export const BRAND: Brand = resolveBrand()
