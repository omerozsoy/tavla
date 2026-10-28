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
// Turkiye (TR) her zaman en ustte, kalanlar alfabetik.
export function countryOptions(lang: string): { code: string; name: string }[] {
  return [...new Set(COUNTRY_CODES)]
    .map((code) => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => {
      if (a.code === 'TR') return -1
      if (b.code === 'TR') return 1
      return a.name.localeCompare(b.name, lang)
    })
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

// Ulke arama (dial) kodlari: ISO kodu -> uluslararasi cevirme kodu (basindaki + HARIC).
// Telefon alani yabanci uyeler icin "+<kod><numara>" uretir. KKTC (XT) +90'i paylasir.
export const DIAL_CODES: Record<string, string> = {
  AF: '93', AL: '355', DZ: '213', AD: '376', AO: '244', AG: '1', AR: '54', AM: '374', AU: '61', AT: '43',
  AZ: '994', BS: '1', BH: '973', BD: '880', BB: '1', BY: '375', BE: '32', BZ: '501', BJ: '229', BT: '975',
  BO: '591', BA: '387', BW: '267', BR: '55', BN: '673', BG: '359', BF: '226', BI: '257', KH: '855', CM: '237',
  CA: '1', CV: '238', CF: '236', TD: '235', CL: '56', CN: '86', CO: '57', KM: '269', CG: '242', CD: '243',
  CR: '506', CI: '225', HR: '385', CU: '53', CY: '357', CZ: '420', DK: '45', DJ: '253', DM: '1', DO: '1',
  EC: '593', EG: '20', SV: '503', GQ: '240', ER: '291', EE: '372', SZ: '268', ET: '251', FJ: '679', FI: '358',
  FR: '33', GA: '241', GM: '220', GE: '995', DE: '49', GH: '233', GR: '30', GD: '1', GT: '502', GN: '224',
  GW: '245', GY: '592', HT: '509', HN: '504', HU: '36', IS: '354', IN: '91', ID: '62', IR: '98', IQ: '964',
  IE: '353', IL: '972', IT: '39', JM: '1', JP: '81', JO: '962', KZ: '7', KE: '254', KI: '686', KP: '850',
  KR: '82', KW: '965', KG: '996', LA: '856', LV: '371', LB: '961', LS: '266', LR: '231', LY: '218', LI: '423',
  LT: '370', LU: '352', MG: '261', MW: '265', MY: '60', MV: '960', ML: '223', MT: '356', MH: '692', MR: '222',
  MU: '230', MX: '52', FM: '691', MD: '373', MC: '377', MN: '976', ME: '382', MA: '212', MZ: '258', MM: '95',
  NA: '264', NR: '674', NP: '977', NL: '31', NZ: '64', NI: '505', NE: '227', NG: '234', NO: '47', OM: '968',
  PK: '92', PW: '680', PA: '507', PG: '675', PY: '595', PE: '51', PH: '63', PL: '48', PT: '351', QA: '974',
  RO: '40', RU: '7', RW: '250', KN: '1', LC: '1', VC: '1', WS: '685', SM: '378', ST: '239', SA: '966',
  SN: '221', RS: '381', SC: '248', SL: '232', SG: '65', SK: '421', SI: '386', SB: '677', SO: '252', ZA: '27',
  SS: '211', ES: '34', LK: '94', SD: '249', SR: '597', SE: '46', CH: '41', SY: '963', TW: '886', TJ: '992',
  TZ: '255', TH: '66', TL: '670', TG: '228', TO: '676', TT: '1', TN: '216', TR: '90', TM: '993', TV: '688',
  UG: '256', UA: '380', AE: '971', GB: '44', US: '1', UY: '598', UZ: '998', VU: '678', VA: '39', VE: '58',
  VN: '84', YE: '967', ZM: '260', ZW: '263', MK: '389', XK: '383', PS: '970', XT: '90',
}

// ISO kodunun dial kodu (yoksa '').
export function dialCode(iso: string): string {
  return DIAL_CODES[(iso || '').toUpperCase()] ?? ''
}

// Dile gore sirali dial-kod secenekleri (TR en ustte). Telefon alani dropdown'i kullanir.
export function dialOptions(lang: string): { code: string; name: string; dial: string }[] {
  return countryOptions(lang)
    .filter((o) => DIAL_CODES[o.code])
    .map((o) => ({ code: o.code, name: o.name, dial: DIAL_CODES[o.code] }))
}

// Saklanan "+<dial><numara>" degerinden ISO kodu coz (en UZUN eslesen dial kazanir; esitlikte
// preferIso'yu tercih et). Bulunamazsa ''. Duzenleme ekraninda bayrak/dial'i geri yuklemek icin.
export function isoFromDial(stored: string, preferIso?: string): string {
  const digits = (stored || '').replace(/[^\d]/g, '')
  if (!digits) return ''
  // Tercih edilen ulkenin dial'i onek ise onu kullan (1/7/39/90 gibi paylasimlilarda dogru bayrak).
  const pref = (preferIso || '').toUpperCase()
  if (pref && DIAL_CODES[pref] && digits.startsWith(DIAL_CODES[pref])) return pref
  let best = ''
  let bestLen = 0
  for (const [iso, dial] of Object.entries(DIAL_CODES)) {
    if (digits.startsWith(dial) && dial.length > bestLen) {
      best = iso
      bestLen = dial.length
    }
  }
  return best
}
