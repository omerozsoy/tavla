// Ulkeler ISO 3166-1 alpha-2 kodlariyla tutulur; GORUNEN isim uygulama diline gore
// Intl.DisplayNames ile uretilir (TR/EN/ES/DE/FR... hepsi otomatik). Boylece dil
// degisince ulke adlari da degisir. Kayitli deger = kod (or. 'TR').
export const COUNTRY_CODES: string[] = [
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BT',
  'BO','BA','BW','BR','BN','BG','BF','BI','KH','CM','CA','CV','CF','TD','CL','CN','CO','KM','CG','CD',
  'CR','CI','HR','CU','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI',
  'FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HU','IS','IN','ID','IR','IQ',
  'IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI',
  'LT','LU','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM',
  'NA','NR','NP','NL','NZ','NI','NE','NG','KP','NO','OM','PK','PW','PA','PG','PY','PE','PH','PL','PT',
  'QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO',
  'ZA','SS','ES','LK','SD','SR','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM',
  'TV','UG','UA','AE','GB','US','UY','UZ','VU','VA','VE','VN','YE','ZM','ZW','MK','XK','PS',
  // KKTC: ISO 3166-1'de yok. Kosova'nin ozel-kullanim 'XK' kodu gibi 'XT' ile temsil
  // edilir. Intl ismi uretemez -> countryName ozel-durum; bayragi Flag.tsx'te gomulu SVG.
  'XT',
]

// KKTC pseudo-kodu (tek yerden). ISO'da olmayan tek ulke; ismi ve bayragi ozel ele alinir.
export const TRNC_CODE = 'XT'
const TRNC_NAMES: Record<string, string> = {
  tr: 'Kuzey Kıbrıs (KKTC)',
  en: 'Northern Cyprus',
  es: 'Chipre del Norte',
  de: 'Nordzypern',
  fr: 'Chypre du Nord',
}

const dnCache: Record<string, Intl.DisplayNames> = {}
function dn(lang: string): Intl.DisplayNames {
  return (dnCache[lang] ??= new Intl.DisplayNames([lang], { type: 'region' }))
}

// Kodun verilen dildeki ulke adi (Intl yoksa/bulamazsa kodu dondurur).
export function countryName(code: string, lang: string): string {
  if (!code) return ''
  if (code === TRNC_CODE) return TRNC_NAMES[lang] ?? TRNC_NAMES.en
  try {
    return dn(lang).of(code) ?? code
  } catch {
    return code
  }
}

// Dile gore sirali {code, name} listesi (datalist/select icin).
export function countryOptions(lang: string): { code: string; name: string }[] {
  return [...new Set(COUNTRY_CODES)]
    .map((code) => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang))
}

// Legacy: kayitli deger kod mu isim mi? Isimse kod'a cevir (eslesmezse aynen dondur).
let reverse: Record<string, string> | null = null
function buildReverse(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const code of COUNTRY_CODES) {
    for (const lang of ['en', 'tr', 'de', 'fr', 'es']) {
      const n = countryName(code, lang)
      if (n && n !== code) map[n.toLowerCase()] = code
    }
  }
  // yaygin kisaltmalar / eski degerler
  Object.assign(map, {
    usa: 'US', uk: 'GB', turkey: 'TR', türkiye: 'TR', 'türki̇ye': 'TR',
    // KKTC serbest-metin eski degerleri -> pseudo-kod
    kktc: TRNC_CODE, trnc: TRNC_CODE, 'kuzey kıbrıs': TRNC_CODE,
    'kuzey kibris': TRNC_CODE, 'kuzey kıbrıs türk cumhuriyeti': TRNC_CODE,
    'northern cyprus': TRNC_CODE,
  })
  return map
}
export function normalizeCountry(value: string | null | undefined): string {
  if (!value) return ''
  const v = value.trim()
  if (COUNTRY_CODES.includes(v)) return v // zaten kod
  reverse ??= buildReverse()
  return reverse[v.toLowerCase()] ?? v
}
