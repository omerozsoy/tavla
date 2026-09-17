// Board tema tanimlari — App.tsx'ten cikarildi (God-component kucultme, #10).
// Saf veri + saf yardimci (hexLum); React/state bagimliligi YOK.

export interface BoardTheme {
  id: string
  name: string
  panel: string
  a: string
  b: string
  checker: string // koyu pul rengi (temaya uyar)
  frame?: string // cerceve/orta bar rengi (--bar). yoksa varsayilan koyu
  light?: string // acik pul rengi (--cream). yoksa varsayilan krem
  price?: number // coin ile acilan premium tema (yoksa ucretsiz)
  rarity?: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'club' | 'country' | 'tavlatv' // nadirlik/kategori (kart cercevesi + gruplama)
  flag?: string // ulke boardlari icin kart bayrak emojisi (🇹🇷 vb.) — gorsel etiket, boarda BASILMAZ
  // Kulup temalari icin ozel zar/kup renkleri (yoksa marka varsayilanina duser).
  // dice1 = acik zar (beyaz oyuncu), dice2 = koyu zar (siyah oyuncu).
  d1Bg?: string
  d1Pip?: string
  d2Bg?: string
  d2Pip?: string
  cubeBg?: string
  cubeText?: string
  watermark?: string // board ortasindaki cok soluk takim adi (logo/arma DEGIL)
  // Pul stili: referans board'un pul karakteri (flat disk / parlak / buz-kristal /
  // halka / neon). Renkler yine --cream/--navy'den gelir; stil sadece finish/efekt.
  checkerStyle?: 'flat' | 'gloss' | 'ice' | 'ring' | 'neon'
  // Yuzey finish'i: duz / dikey gradyan derinlik / kumas (felt) / AGAC DAMARI (wood) dokusu.
  surface?: 'plain' | 'gradient' | 'felt' | 'wood'
  // Hane (point) sekli: 'sharp' = klasik sivri ucgen (varsayilan); 'rounded' = ucu yuvarlak
  // uzun damla (teardrop) — ahsap referans boardu icin (TavlaTV Özel).
  pointStyle?: 'sharp' | 'rounded'
}
// UI/UX Pro Max renk paletlerinden 20 tahta. Isimler paletlerden alindi.
// id 'tavla' varsayilan capa olarak kalir (eski kayitlar/geri uyumluluk).
export const BOARD_THEMES: BoardTheme[] = [
  // Standart — site TEMA renkleri (Terracotta): sicak sand zemin, kiremit (brick) +
  // krem noktalar, espresso koyu pul + krem acik pul, kiremit kup/zar. Varsayilan.
  { id: 'standart', name: 'Standart', panel: '#d8c6ac', a: '#a83a2b', b: '#f2ead9', checker: '#241a12', light: '#f7f1e6', frame: '#3a2a1c', cubeBg: '#a83a2b', cubeText: '#f7f1e6', d1Bg: '#f7f1e6', d1Pip: '#241a12', d2Bg: '#a83a2b', d2Pip: '#f7f1e6' },
  { id: 'tavla', name: 'Latte', panel: '#e6e9ef', a: '#dd7878', b: '#ccd0da', checker: '#4c4f69' },
  // Varsayilan premium mavi tavla (Galaxy tarzi turnuva paleti). Tum renkler burada
  // merkezidir; App.css --panel/--tri-a/--tri-b/--navy/--cream/--bar'a yansir.
  { id: 'galaxy', name: 'Galaxy', panel: '#3568c8', a: '#72a0ea', b: '#244da7', checker: '#18286e', frame: '#080d2d', light: '#f2f3f7' },
  // --- Galaksi koleksiyonu: referans screenshot'lardan yeniden uretilen boardlar.
  // Her biri kendi pul stili (flat/gloss/ice) + yuzey finish'i (felt/plain) tasir. ---
  { id: 'frostfall', name: 'Frostfall', rarity: 'rare', panel: '#12224a', a: '#2f7d5e', b: '#1f5f45', checker: '#d32f2f', light: '#dbeeff', frame: '#5b3a1e', checkerStyle: 'ice', d1Bg: '#cfe6ff', d1Pip: '#1c3a6b', d2Bg: '#d32f2f', d2Pip: '#ffffff', cubeBg: '#d32f2f', cubeText: '#ffffff' },
  { id: 'pumpkin', name: 'Pumpkin Night', rarity: 'common', panel: '#3a2352', a: '#e8822a', b: '#4a2f5e', checker: '#241533', light: '#f0e2c8', frame: '#241436', cubeBg: '#e8822a', cubeText: '#241533' },
  { id: 'marrakesh', name: 'Marrakesh', rarity: 'common', panel: '#efe4d0', a: '#c97b3c', b: '#6e4a2f', checker: '#1c140e', light: '#f6efe2', frame: '#3a281a' },
  { id: 'bosphorus', name: 'Bosphorus', rarity: 'common', panel: '#7a5230', a: '#9a6a3e', b: '#5f3f24', checker: '#1a120a', light: '#efe6d6', frame: '#3a2616' },
  { id: 'manhattan', name: 'Manhattan', rarity: 'common', panel: '#0f5c3a', a: '#8fae90', b: '#0c4a2e', checker: '#111111', light: '#f4f4f0', frame: '#3a2a1a', checkerStyle: 'gloss', surface: 'felt' },
  { id: 'worldmasters', name: 'World Masters', rarity: 'rare', panel: '#5b3f86', a: '#c2a15a', b: '#4a3270', checker: '#161016', light: '#f2f2f6', frame: '#120c1e', cubeBg: '#6b4aa0', cubeText: '#ffffff' },
  { id: 'retroclub', name: 'Retro Club', rarity: 'rare', panel: '#0b0b0b', a: '#e0821f', b: '#2f7d3f', checker: '#c0392b', light: '#e8ddc0', frame: '#3a2a1e', checkerStyle: 'gloss', d1Bg: '#e8ddc0', d1Pip: '#2a2a2a', d2Bg: '#c0392b', d2Pip: '#ffffff' },
  { id: 'redplanet', name: 'Red Planet', rarity: 'common', panel: '#b5482f', a: '#cf6a48', b: '#7c2a1c', checker: '#5a1a12', light: '#f0dcc8', frame: '#141026', cubeBg: '#e0632f', cubeText: '#ffffff' },
  { id: 'glacier', name: 'Glacier', rarity: 'common', panel: '#9fc0e4', a: '#bcd6f0', b: '#7ea6d8', checker: '#35597f', light: '#f4f9fd', frame: '#0e1830' },
  { id: 'atlantis', name: 'Atlantis', rarity: 'common', panel: '#2f9c94', a: '#46b1a7', b: '#1f7d76', checker: '#0d4a45', light: '#eafaf7', frame: '#0a2a28' },
  { id: 'amethyst', name: 'Amethyst', rarity: 'common', panel: '#9a5fb8', a: '#b985d0', b: '#7a4596', checker: '#3f2360', light: '#f2e7f8', frame: '#160b24' },
  { id: 'radioactive', name: 'Radioactive', rarity: 'common', panel: '#a6b24a', a: '#c2cf64', b: '#8a963c', checker: '#3a4818', light: '#f2f6d8', frame: '#1e260c' },
  { id: 'gaia', name: 'Gaia', rarity: 'common', panel: '#3f8f6a', a: '#5aa583', b: '#2f7a58', checker: '#123527', light: '#eafaf1', frame: '#2a1f16' },
  { id: 'lunar', name: 'Lunar', rarity: 'common', panel: '#7e8aa0', a: '#9aa4b8', b: '#6a7688', checker: '#2f3646', light: '#eef1f7', frame: '#10131f' },
  { id: 'monaco', name: 'Monaco', rarity: 'common', panel: '#1f6b40', a: '#c0392b', b: '#d9c9a3', checker: '#141414', light: '#f0ead6', frame: '#5a3b1e', checkerStyle: 'gloss', surface: 'felt' },
  { id: 'violetstorm', name: 'Violet Storm', rarity: 'common', panel: '#7a4fb0', a: '#9265c6', b: '#5f3f96', checker: '#3a2560', light: '#efe7f6', frame: '#0d0a16' },
  { id: 'blueorbit', name: 'Blue Orbit', rarity: 'common', panel: '#3f66cc', a: '#6f93e6', b: '#2f52b8', checker: '#16227a', light: '#eef2fb', frame: '#0a0e1c' },
  { id: 'crimsonash', name: 'Crimson Ash', rarity: 'rare', panel: '#4a4d55', a: '#5e626b', b: '#3a3d44', checker: '#8e2a26', light: '#d9cdbc', frame: '#141622', cubeBg: '#b5382f', cubeText: '#ffffff' },
  { id: 'ion', name: 'Ion', rarity: 'rare', panel: '#33363e', a: '#40434c', b: '#26282f', checker: '#6b3fc0', light: '#e88a3a', frame: '#14161e' },
  { id: 'reddwarf', name: 'Red Dwarf', panel: '#5f1c16', a: '#c0402a', b: '#8c2a1e', checker: '#280c08', frame: '#1a0806', light: '#e8ded0' },
  { id: 'eclipse', name: 'Eclipse', panel: '#8a3626', a: '#a44a34', b: '#722a1e', checker: '#e6b64a', frame: '#1e0c08', light: '#f2e6cc' },
  { id: 'nord', name: 'Nord', panel: '#3b4252', a: '#88c0d0', b: '#2e3440', checker: '#4c566a' },
  { id: 'dracula', name: 'Dracula', panel: '#282a36', a: '#bd93f9', b: '#44475a', checker: '#6272a4' },
  { id: 'gruvbox', name: 'Gruvbox', panel: '#3c3836', a: '#d79921', b: '#282828', checker: '#504945' },
  { id: 'solarized', name: 'Solarized', panel: '#073642', a: '#b58900', b: '#002b36', checker: '#586e75' },
  { id: 'tokyonight', name: 'Tokyo Night', panel: '#24283b', a: '#7aa2f7', b: '#1a1b26', checker: '#414868' },
  { id: 'rosepine', name: 'Rosé Pine', panel: '#26233a', a: '#ebbcba', b: '#1f1d2e', checker: '#6e6a86' },
  { id: 'mocha', name: 'Mocha', panel: '#313244', a: '#f5c2e7', b: '#1e1e2e', checker: '#585b70' },
  { id: 'monokai', name: 'Monokai', panel: '#3e3d32', a: '#a6e22e', b: '#272822', checker: '#75715e' },
  { id: 'everforest', name: 'Everforest', panel: '#374145', a: '#a7c080', b: '#2b3339', checker: '#4f5b58' },
  { id: 'ayu', name: 'Ayu', panel: '#1f2430', a: '#ffcc66', b: '#171b24', checker: '#444a55' },
  { id: 'onedark', name: 'One Dark', panel: '#3a3f4b', a: '#61afef', b: '#282c34', checker: '#4b5263' },
  { id: 'nightowl', name: 'Night Owl', panel: '#1d3b53', a: '#82aaff', b: '#011627', checker: '#365069' },
  { id: 'synthwave', name: 'Synthwave', panel: '#2b1a4a', a: '#ff5bd0', b: '#1a1030', checker: '#00d4e8', light: '#ff7be0', frame: '#0f0820', checkerStyle: 'neon', surface: 'gradient' },
  { id: 'horizon', name: 'Horizon', panel: '#3a2a5e', a: '#7a4fd0', b: '#241a40', checker: '#e0553a', light: '#c0a8e8', frame: '#0f0820', checkerStyle: 'gloss', surface: 'gradient' },
  { id: 'palenight', name: 'Palenight', panel: '#292d3e', a: '#c792ea', b: '#1c1f2b', checker: '#4a4f66' },
  { id: 'oceanic', name: 'Oceanic', panel: '#263238', a: '#6699cc', b: '#1b2b34', checker: '#405860' },
  { id: 'gruvlight', name: 'Gruvbox Light', panel: '#ebdbb2', a: '#d79921', b: '#bdae93', checker: '#504945' },
  { id: 'sollight', name: 'Solarized Light', panel: '#eee8d5', a: '#268bd2', b: '#93a1a1', checker: '#586e75' },
  { id: 'dawn', name: 'Dawn', panel: '#faf4ed', a: '#d7827e', b: '#dfdad9', checker: '#575279' },
]
// Premium tahta temalari (coin ile acilir). id 'gold' -> magaza 'theme.gold'
export const PREMIUM_THEMES: BoardTheme[] = [
  { id: 'ocean', name: 'Okyanus', panel: '#1f6f8b', a: '#3fa9c9', b: '#144f63', checker: '#0e5a70', price: 300 },
  { id: 'gold', name: 'Altın', panel: '#b8912f', a: '#e8c14a', b: '#8a6a1a', checker: '#7a5f14', price: 500 },
  { id: 'sunset', name: 'Sunset', panel: '#c25a3a', a: '#f0894f', b: '#8f3a22', checker: '#a3401f', light: '#ffe6c8', frame: '#3a1810', price: 600, checkerStyle: 'gloss', surface: 'gradient' },
  { id: 'neon', name: 'Neon', panel: '#2a2a4a', a: '#18e0c0', b: '#7a1fb0', checker: '#00b0ff', price: 800 },
]
// Rarity koleksiyonu (plan kilidiyle acilir; coin fiyati yok). Alan eslemesi:
// panel=Board Background, a=Point A, b=Point B, light=Checker Light, checker=Checker Dark, frame=Frame/Bar.
// Preview ve gercek oyun tahtasi ayni config'i kullanir (App.css --panel/--tri-a/--tri-b/--navy/--cream/--bar).
export const RARITY_THEMES: BoardTheme[] = [
  // --- COMMON ---
  { id: 'sahara', name: 'Sahara', rarity: 'common', panel: '#c79a5b', a: '#e0b878', b: '#8a5e38', light: '#f6ecd6', checker: '#4a3324', frame: '#141026', cubeBg: '#d17a2f', cubeText: '#ffffff' },
  { id: 'emerald', name: 'Emerald', rarity: 'common', panel: '#0f6b52', a: '#1f9d78', b: '#0a4d3b', light: '#dff7ec', checker: '#08352a', frame: '#052620', checkerStyle: 'ice', surface: 'gradient' },
  { id: 'arctic', name: 'Arctic', rarity: 'common', panel: '#8db8d0', a: '#c4dfea', b: '#5688a5', light: '#f7fbff', checker: '#294b68', frame: '#101b2a', checkerStyle: 'ice', surface: 'gradient' },
  { id: 'coral', name: 'Coral', rarity: 'common', panel: '#D66F61', a: '#F4A17F', b: '#A9474A', light: '#FFF0D5', checker: '#62313B', frame: '#24141D' },
  { id: 'jade', name: 'Jade', rarity: 'common', panel: '#438C72', a: '#78B99A', b: '#24604E', light: '#E7E6CE', checker: '#173D35', frame: '#18231F' },
  { id: 'ocean2', name: 'Ocean', rarity: 'common', panel: '#086D8B', a: '#22A3BA', b: '#06465F', light: '#D8F3F5', checker: '#082E48', frame: '#031727' },
  { id: 'lagoon', name: 'Lagoon', rarity: 'common', panel: '#158A8A', a: '#5AB9A8', b: '#0B5A65', light: '#E5F3D6', checker: '#083D43', frame: '#062127' },
  { id: 'lavender', name: 'Lavender', rarity: 'common', panel: '#8064A8', a: '#B18AC5', b: '#584378', light: '#F0E8F4', checker: '#3C285C', frame: '#171126' },
  // --- RARE ---
  { id: 'ruby', name: 'Ruby', rarity: 'rare', panel: '#8F2635', a: '#D14B52', b: '#5A1728', light: '#F6D7C9', checker: '#35121B', frame: '#190A10' },
  { id: 'royal', name: 'Royal Gold', rarity: 'rare', panel: '#182a5e', a: '#e8c14a', b: '#0f1c42', light: '#f6e6b0', checker: '#0a1330', frame: '#0a1330', checkerStyle: 'gloss', surface: 'gradient', cubeBg: '#e8c14a', cubeText: '#0f1c42' },
  { id: 'cherry', name: 'Cherry', rarity: 'rare', panel: '#771E3A', a: '#BC3156', b: '#44152B', light: '#F5D8D5', checker: '#27111C', frame: '#140811' },
  { id: 'copper', name: 'Copper', rarity: 'rare', panel: '#9B593D', a: '#CE8356', b: '#633827', light: '#F3D6AE', checker: '#42251C', frame: '#21130E' },
  { id: 'midnight', name: 'Midnight', rarity: 'rare', panel: '#121B42', a: '#253D82', b: '#10102B', light: '#BFCDF2', checker: '#090A18', frame: '#03040C' },
  { id: 'gold2', name: 'Gold', rarity: 'rare', panel: '#9C7528', a: '#D8B653', b: '#604318', light: '#FFF0BC', checker: '#382712', frame: '#1B1209' },
  // --- EPIC ---
  { id: 'volcano', name: 'Volcano', rarity: 'epic', panel: '#55272A', a: '#C54A31', b: '#29171B', light: '#E5B76D', checker: '#160D10', frame: '#090608' },
  { id: 'tokyo', name: 'Tokyo', rarity: 'epic', panel: '#26283A', a: '#E0526A', b: '#6676C5', light: '#F1E9DE', checker: '#202131', frame: '#0D0E18' },
  { id: 'aurora2', name: 'Aurora II', rarity: 'epic', panel: '#174B50', a: '#31A48D', b: '#7046A0', light: '#C7F2DE', checker: '#22265D', frame: '#081B24' },
  { id: 'imperial', name: 'Imperial', rarity: 'epic', panel: '#492354', a: '#9B467D', b: '#C29145', light: '#F1DFB1', checker: '#31152E', frame: '#160A19' },
  // --- LEGENDARY ---
  { id: 'obsidian', name: 'Obsidian', rarity: 'legendary', panel: '#1a1b20', a: '#3a3d47', b: '#0e0f13', light: '#e6e8ec', checker: '#050608', frame: '#000000', checkerStyle: 'gloss', surface: 'gradient' },
  { id: 'samurai', name: 'Samurai', rarity: 'legendary', panel: '#161616', a: '#b12a2a', b: '#0c0c0c', light: '#e8dcc0', checker: '#8a1f1f', frame: '#050505', checkerStyle: 'gloss', cubeBg: '#c8a13a', cubeText: '#161616' },
  { id: 'blackdiamond', name: 'Black Diamond', rarity: 'legendary', panel: '#20222a', a: '#4a4f5e', b: '#14161c', light: '#eef1f7', checker: '#0a0b0f', frame: '#000000', checkerStyle: 'ice', surface: 'gradient' },
  // --- MYTHIC ---
  { id: 'cyber', name: 'Cyberpunk', rarity: 'mythic', panel: '#160f2e', a: '#ff2e97', b: '#0e0a24', light: '#ff4fb0', checker: '#0bb8d8', frame: '#07051c', checkerStyle: 'neon', surface: 'gradient' },
  { id: 'inferno', name: 'Inferno', rarity: 'mythic', panel: '#1a0e0a', a: '#e8541f', b: '#7c1e10', light: '#ffd9a8', checker: '#ff6a2a', frame: '#0a0504', checkerStyle: 'neon', surface: 'gradient', cubeBg: '#e8541f', cubeText: '#ffffff' },
]
// Mevcut (rarity alani olmayan) temalarin nadirlik siniflandirmasi. id -> rarity.
// Not: rarity alani tasiyan temalar (RARITY_THEMES) kendi degerini kullanir; bu harita
// sadece BOARD_THEMES + PREMIUM_THEMES icin. Tanimsiz kalan 'common' varsayilir.
export const THEME_RARITY: Record<string, NonNullable<BoardTheme['rarity']>> = {
  // BOARD_THEMES — Common (sade / editor paletleri)
  standart: 'common', tavla: 'common', moon: 'common', pluto: 'common', nord: 'common', gruvbox: 'common',
  solarized: 'common', mocha: 'common', monokai: 'common', everforest: 'common', ayu: 'common',
  onedark: 'common', palenight: 'common', oceanic: 'common', gruvlight: 'common', sollight: 'common', dawn: 'common',
  // BOARD_THEMES — Rare (zengin tonal + populer paletler)
  neptune: 'rare', nebula: 'rare', earth: 'rare', toxic: 'rare', uranus: 'rare',
  dracula: 'rare', tokyonight: 'rare', rosepine: 'rare', nightowl: 'rare', horizon: 'rare',
  // BOARD_THEMES — Epic (carpici / dramatik)
  montecarlo: 'epic', reddwarf: 'epic', eclipse: 'epic', synthwave: 'epic',
  // PREMIUM_THEMES
  ocean: 'epic', gold: 'legendary', sunset: 'legendary', neon: 'mythic',
}
// Kulup takimi temalari: SADECE isim + renk paleti. Logo/arma/yildiz/maskot/monogram
// KULLANILMAZ. Renklerden turetilmis ozgun tavla + cok soluk takim adi watermark'i.
export const CLUB_THEMES: BoardTheme[] = [
  {
    id: 'fenerbahce', name: 'Fenerbahçe', rarity: 'club',
    panel: '#F3D428', a: '#102A72', b: '#E6BC15', checker: '#173B8F', light: '#F7D72C', frame: '#091B52',
    d1Bg: '#F4D12B', d1Pip: '#102A72', d2Bg: '#15377F', d2Pip: '#FFFFFF',
    cubeBg: '#102A72', cubeText: '#F6D42A', watermark: 'FENERBAHÇE',
  },
  {
    id: 'galatasaray', name: 'Galatasaray', rarity: 'club',
    panel: '#A91B32', a: '#F2B900', b: '#7F1024', checker: '#A71930', light: '#F4BB16', frame: '#6D0B1B',
    d1Bg: '#F2BC18', d1Pip: '#8D1026', d2Bg: '#A71930', d2Pip: '#F7D344',
    cubeBg: '#95142B', cubeText: '#F4C01A', watermark: 'GALATASARAY',
  },
  {
    id: 'besiktas', name: 'Beşiktaş', rarity: 'club',
    panel: '#D9D9D9', a: '#171717', b: '#A3A3A3', checker: '#111111', light: '#F4F4F4', frame: '#111111',
    d1Bg: '#F3F3F3', d1Pip: '#111111', d2Bg: '#121212', d2Pip: '#FFFFFF',
    cubeBg: '#111111', cubeText: '#FFFFFF', watermark: 'BEŞİKTAŞ',
  },
  {
    // Trabzonspor: bordo-mavi (isim+renk, logo yok — eski kulup kurallari)
    id: 'trabzonspor', name: 'Trabzonspor', rarity: 'club',
    panel: '#7A1E33', a: '#0E4C92', b: '#5F1728', checker: '#0E4C92', light: '#F5DCE2', frame: '#40101D',
    d1Bg: '#7A1E33', d1Pip: '#F5DCE2', d2Bg: '#0E4C92', d2Pip: '#FFFFFF',
    cubeBg: '#0E4C92', cubeText: '#F5DCE2', watermark: 'TRABZONSPOR',
  },
]
// Ulke Temali Board Koleksiyonu: her ulkenin RESMI BAYRAK RENKLERINDEN turetilmis sade tavla.
// KURAL: renkler o bayragin RESMI hex degerleridir; zemin (panel) = bayragin baskin/alan rengi,
// iki ucgen (a, b) = diger iki bayrak rengi -> ucu de yuzeyde. Koyu pul (checker) = bayragin EN
// KOYU tonu; acik pul (light) = oynanabilirlik icin beyaz/krem (2-renkli bayrakta zorunlu). Bayrak
// gorseli KULLANILMAZ; orta yazi=watermark (ulke adi). Resmi hex kaynaklari asagida yorumda.
export const COUNTRY_THEMES: BoardTheme[] = [
  {
    // Türkiye 🇹🇷 — Resmi: Kırmızı #E30A17 + Beyaz (siyah YOK). Koyu pul = koyu kırmızı tonu.
    id: 'turkey', name: 'Türkiye', rarity: 'country', flag: '🇹🇷', watermark: 'TÜRKİYE',
    panel: '#E30A17', a: '#F4EDDF', b: '#B70810', checker: '#6E0910', light: '#FFFFFF', frame: '#4A060B',
    d1Bg: '#FFFFFF', d1Pip: '#E30A17', d2Bg: '#E30A17', d2Pip: '#FFFFFF', cubeBg: '#E30A17', cubeText: '#FFFFFF',
  },
  {
    // USA 🇺🇸 — Resmi: Old Glory Blue #0A3161, Old Glory Red #B31942, Beyaz #FFFFFF.
    id: 'usa', name: 'USA', rarity: 'country', flag: '🇺🇸', watermark: 'USA',
    panel: '#0A3161', a: '#B31942', b: '#F4F5FA', checker: '#0A1F45', light: '#FFFFFF', frame: '#071733',
    d1Bg: '#FFFFFF', d1Pip: '#0A3161', d2Bg: '#B31942', d2Pip: '#FFFFFF', cubeBg: '#0A3161', cubeText: '#FFFFFF',
  },
  {
    // UK 🇬🇧 — Resmi: Mavi #012169, Kırmızı #C8102E, Beyaz #FFFFFF.
    id: 'uk', name: 'United Kingdom', rarity: 'country', flag: '🇬🇧', watermark: 'UNITED KINGDOM',
    panel: '#012169', a: '#C8102E', b: '#F4F6FB', checker: '#011543', light: '#FFFFFF', frame: '#010F30',
    d1Bg: '#FFFFFF', d1Pip: '#012169', d2Bg: '#C8102E', d2Pip: '#FFFFFF', cubeBg: '#012169', cubeText: '#FFFFFF',
  },
  {
    // Almanya 🇩🇪 — Resmi: Siyah #000000, Kırmızı #DD0000, Altın #FFCE00.
    id: 'germany', name: 'Deutschland', rarity: 'country', flag: '🇩🇪', watermark: 'DEUTSCHLAND',
    panel: '#151515', a: '#DD0000', b: '#FFCE00', checker: '#0A0A0A', light: '#F4EFDD', frame: '#000000',
    d1Bg: '#FFCE00', d1Pip: '#111111', d2Bg: '#DD0000', d2Pip: '#FFFFFF', cubeBg: '#000000', cubeText: '#FFCE00',
  },
  {
    // Yunanistan 🇬🇷 — Resmi: Mavi #0D5EAF + Beyaz #FFFFFF.
    id: 'greece', name: 'Ελλάδα', rarity: 'country', flag: '🇬🇷', watermark: 'ΕΛΛΑΔΑ',
    panel: '#0D5EAF', a: '#F4F6FB', b: '#0A4E93', checker: '#062A50', light: '#FFFFFF', frame: '#04223F',
    d1Bg: '#FFFFFF', d1Pip: '#0D5EAF', d2Bg: '#0D5EAF', d2Pip: '#FFFFFF', cubeBg: '#0D5EAF', cubeText: '#FFFFFF',
  },
  {
    // İtalya 🇮🇹 — Resmi: Yeşil #008C45, Beyaz #F1F2F1, Kırmızı #CD212A. Koyu pul = koyu yeşil.
    id: 'italy', name: 'Italia', rarity: 'country', flag: '🇮🇹', watermark: 'ITALIA',
    panel: '#008C45', a: '#CD212A', b: '#F1F2F1', checker: '#054F29', light: '#FFFFFF', frame: '#053C20',
    d1Bg: '#FFFFFF', d1Pip: '#008C45', d2Bg: '#CD212A', d2Pip: '#FFFFFF', cubeBg: '#008C45', cubeText: '#FFFFFF',
  },
  {
    // Fransa 🇫🇷 — Resmi: Mavi #0055A4, Beyaz #FFFFFF, Kırmızı #EF4135. Koyu pul = koyu mavi.
    id: 'france', name: 'France', rarity: 'country', flag: '🇫🇷', watermark: 'FRANCE',
    panel: '#0055A4', a: '#EF4135', b: '#F4F6FB', checker: '#00306A', light: '#FFFFFF', frame: '#00234A',
    d1Bg: '#FFFFFF', d1Pip: '#0055A4', d2Bg: '#EF4135', d2Pip: '#FFFFFF', cubeBg: '#0055A4', cubeText: '#FFFFFF',
  },
  {
    // İspanya 🇪🇸 — Resmi: Kırmızı #AA151B, Altın #F1BF00 (rojigualda). Koyu pul = koyu kırmızı.
    id: 'spain', name: 'España', rarity: 'country', flag: '🇪🇸', watermark: 'ESPAÑA',
    panel: '#AA151B', a: '#F1BF00', b: '#8E1116', checker: '#4E080C', light: '#FBF3DA', frame: '#2A0507',
    d1Bg: '#FBF3DA', d1Pip: '#AA151B', d2Bg: '#AA151B', d2Pip: '#F1BF00', cubeBg: '#F1BF00', cubeText: '#AA151B',
  },
  {
    // Japonya 🇯🇵 — Resmi: Beyaz #FFFFFF + Kırmızı #BC002D. Koyu pul = koyu kırmızı (siyah YOK).
    id: 'japan', name: '日本', rarity: 'country', flag: '🇯🇵', watermark: '日本',
    panel: '#F2EFEA', a: '#BC002D', b: '#E7CDD1', checker: '#7A0018', light: '#FFFFFF', frame: '#7A0A1E',
    d1Bg: '#BC002D', d1Pip: '#FFFFFF', d2Bg: '#F2EFEA', d2Pip: '#BC002D', cubeBg: '#BC002D', cubeText: '#FFFFFF',
  },
  {
    // Brezilya 🇧🇷 — Resmi: Yeşil #009C3B, Altın #FFDF00, Mavi #002776. Koyu pul = koyu yeşil.
    id: 'brazil', name: 'Brasil', rarity: 'country', flag: '🇧🇷', watermark: 'BRASIL',
    panel: '#009C3B', a: '#FFDF00', b: '#002776', checker: '#064A22', light: '#F5F8EE', frame: '#05341A',
    checkerStyle: 'gloss',
    d1Bg: '#FFDF00', d1Pip: '#009C3B', d2Bg: '#002776', d2Pip: '#FFDF00', cubeBg: '#FFDF00', cubeText: '#002776',
  },
]
// TavlaTV Özel: ahsap kutu tavla referansindan (kullanici gorseli) birebir palet — ebony
// (koyu abanoz) oyun alani, turuncu + acik akcaagac ucgenler, ceviz cerceve/bar, koyu ceviz
// (deri) + fildisi pullar. TEK ozel board; en alt kademe (mythic'ten sonra).
export const TAVLATV_THEMES: BoardTheme[] = [
  {
    id: 'tavlatv-special', name: 'TavlaTV Özel', rarity: 'tavlatv',
    panel: '#2b2824', a: '#e08a2e', b: '#d8c5a0', checker: '#5a3d26', light: '#efe6cc', frame: '#6d4a2c',
    checkerStyle: 'gloss', surface: 'wood', pointStyle: 'rounded',
    d1Bg: '#efe6cc', d1Pip: '#5a3d26', d2Bg: '#5a3d26', d2Pip: '#efe6cc', cubeBg: '#6d4a2c', cubeText: '#efe6cc',
  },
  {
    // Citrus Wood — Timber Biscuit tarzı açık akçaağaç (maple) referansından: sıcak kırık-beyaz
    // ahsap zemin, YEŞİL+LİME+SARI+ALTIN+TURUNCU çok katmanlı geometrik haneler (çift-ton çapraz
    // bölme, per-kolon renk döngüsü — bespoke CSS [data-board='citrus-wood']), açık ahşap çerçeve/bar,
    // fildişi ahşap çerçeveli yeşil (oyuncu1) + turuncu (oyuncu2) pullar. Haneler standart SİVRİ
    // üçgen (pointStyle 'sharp'); a/b yalnız fallback/önizleme rengidir (gerçek boardda 6 renk).
    id: 'citrus-wood', name: 'Citrus Wood', rarity: 'tavlatv',
    panel: '#E8D7BC', a: '#4E9B45', b: '#F39A0A', checker: '#FF9800', light: '#3F9146', frame: '#DDC59E',
    surface: 'wood', pointStyle: 'sharp', checkerStyle: 'flat',
    d1Bg: '#3F9146', d1Pip: '#ffffff', d2Bg: '#F39A0A', d2Pip: '#ffffff', cubeBg: '#4E9B45', cubeText: '#ffffff',
  },
  {
    // Maritime (Denizci) — açık ceviz ahşap zemin + 12 uluslararası deniz SİNYAL FLAMASI hanelerde
    // (tek-sayılı haneler boş doğal ahşap; çift-sayılı haneler bayraklı, distort YOK — üst/alt
    // varyant). Bespoke: [data-board='nautical'] (App.css) + src/nauticalFlags.ts. Lacivert + fildişi
    // pullar. TavlaTV Özel kademesi (citrus-wood / tavlatv-special ile aynı bespoke grup).
    id: 'nautical', name: 'Maritime', rarity: 'tavlatv',
    panel: '#a6824f', a: '#b08c56', b: '#946f43', light: '#f4eeda', checker: '#1e3a5f', frame: '#7a5c37',
    surface: 'wood', pointStyle: 'sharp', checkerStyle: 'gloss',
    d1Bg: '#f4eeda', d1Pip: '#1e3a5f', d2Bg: '#1e3a5f', d2Pip: '#f4eeda', cubeBg: '#1e3a5f', cubeText: '#f4eeda',
  },
]
// Galaksi koleksiyonu — ek referans boardlar (rename listesi disi). Screenshot'lardan
// yeniden uretildi; pul stili + yuzey finish referansa gore. Plan kilidiyle acilir.
export const GALAXY_EXTRA_THEMES: BoardTheme[] = [
  // --- RARE ---
  { id: 'gamma', name: 'Gamma', rarity: 'rare', panel: '#2f8a80', a: '#4fb0a2', b: '#1f6b63', checker: '#0d3d38', light: '#d9f5ee', frame: '#0a2422', checkerStyle: 'ice' },
  { id: 'cosmos', name: 'Cosmos', rarity: 'rare', panel: '#0e1230', a: '#232a5a', b: '#0a0e24', checker: '#3a46c0', light: '#eef0ff', frame: '#05060f' },
  { id: 'titan', name: 'Titan', rarity: 'rare', panel: '#6a5a3a', a: '#8a7548', b: '#4e4228', checker: '#c85a1f', light: '#9aa2e6', frame: '#141026' },
  { id: 'jupiter', name: 'Jupiter', rarity: 'rare', panel: '#6e6a3e', a: '#8a8550', b: '#4e4a28', checker: '#c98a5a', light: '#eae6d0', frame: '#141026' },
  { id: 'helix', name: 'Helix', rarity: 'rare', panel: '#2f7a80', a: '#469b8f', b: '#3a4a7a', checker: '#5a3f96', light: '#bff0e6', frame: '#0a2226', checkerStyle: 'ice' },
  { id: 'solaris', name: 'Solaris', rarity: 'rare', panel: '#e0642f', a: '#f0864f', b: '#b5451f', checker: '#2a2a2a', light: '#f0e2c8', frame: '#141026' },
  { id: 'orion', name: 'Orion', rarity: 'rare', panel: '#4a4d58', a: '#6a5a80', b: '#3a3d46', checker: '#2f56d0', light: '#eef1f7', frame: '#0e1018' },
  { id: 'kepler', name: 'Kepler', rarity: 'rare', panel: '#3a5f4a', a: '#4f7a5f', b: '#2a4a38', checker: '#7a4a2f', light: '#bff0d8', frame: '#0e1a14', checkerStyle: 'ice' },
  // --- EPIC ---
  { id: 'andromeda', name: 'Andromeda', rarity: 'epic', panel: '#4a2a6a', a: '#8a3a7a', b: '#3a2258', checker: '#8a9a4a', light: '#f0a17f', frame: '#160b24' },
  { id: 'orbit', name: 'Orbit', rarity: 'epic', panel: '#1a1c22', a: '#2a2d36', b: '#141519', checker: '#c0392b', light: '#c8ccd4', frame: '#000000', checkerStyle: 'ring' },
  { id: 'cassio', name: 'Cassio', rarity: 'epic', panel: '#2a3d40', a: '#6a5a4a', b: '#3a4a4d', checker: '#e0623a', light: '#3fb598', frame: '#0e1618', cubeBg: '#6b4aa0', cubeText: '#ffffff' },
  { id: 'quasar', name: 'Quasar', rarity: 'epic', panel: '#5a4a3a', a: '#6a5a48', b: '#3a4a6a', checker: '#d0392b', light: '#3ac0e0', frame: '#141026' },
  { id: 'polaris', name: 'Polaris', rarity: 'epic', panel: '#5a5d66', a: '#6a6d78', b: '#4a4d55', checker: '#6b3fc0', light: '#bcd6f0', frame: '#0e1018' },
  { id: 'apollo', name: 'Apollo', rarity: 'epic', panel: '#6a6258', a: '#7f766a', b: '#4e4a5a', checker: '#1f2a5a', light: '#eae2d0', frame: '#141026' },
  { id: 'aurora', name: 'Aurora', rarity: 'epic', panel: '#1a2258', a: '#2f3a8a', b: '#141a44', checker: '#7a3fd0', light: '#3fe0d0', frame: '#080a1c', checkerStyle: 'neon' },
  // --- LEGENDARY ---
  { id: 'gutenberg', name: 'Gutenberg', rarity: 'legendary', panel: '#c8cdd4', a: '#dfe3e8', b: '#a8afb8', checker: '#1a1c22', light: '#f4f6f9', frame: '#0e0f13', surface: 'gradient' },
  { id: 'krypton', name: 'Krypton', rarity: 'legendary', panel: '#1f5a44', a: '#2f8a5f', b: '#144a34', checker: '#0c3526', light: '#9ff0c8', frame: '#08160f', checkerStyle: 'ice', surface: 'gradient' },
  { id: 'infinity', name: 'Infinity', rarity: 'legendary', panel: '#3a1a6a', a: '#7a3fd0', b: '#241040', checker: '#00d4e8', light: '#ff5bd0', frame: '#0f0820', checkerStyle: 'neon', surface: 'gradient' },
  { id: 'vega', name: 'Vega', rarity: 'legendary', panel: '#3a4a9a', a: '#5a6ad0', b: '#8a5aa8', checker: '#2f6ad0', light: '#7fe0f0', frame: '#0a0f2a', checkerStyle: 'ice', surface: 'gradient' },
  { id: 'quantum', name: 'Quantum', rarity: 'legendary', panel: '#123a3f', a: '#1f6f7a', b: '#0c2429', checker: '#57ffc8', light: '#b07bff', frame: '#06171a', checkerStyle: 'neon', surface: 'gradient' },
  { id: 'singularity', name: 'Singularity', rarity: 'legendary', panel: '#1f3fd0', a: '#3f6ae8', b: '#152f9a', checker: '#00cfe8', light: '#ff5bb0', frame: '#060a28', checkerStyle: 'neon', surface: 'gradient' },
  // --- COMMON ---
  { id: 'bazaar', name: 'Bazaar', rarity: 'common', panel: '#7a4a30', a: '#9a5a3a', b: '#5a3420', checker: '#1a120a', light: '#e8d8c0', frame: '#3a2414' },
  { id: 'miami', name: 'Miami', rarity: 'common', panel: '#e8709a', a: '#f0a84a', b: '#4fd0c0', checker: '#2f5ad0', light: '#f0e8d8', frame: '#18d0e8', checkerStyle: 'gloss' },
]
export const ALL_THEMES: BoardTheme[] = [...BOARD_THEMES, ...PREMIUM_THEMES, ...RARITY_THEMES, ...CLUB_THEMES, ...COUNTRY_THEMES, ...TAVLATV_THEMES, ...GALAXY_EXTRA_THEMES]

// Tahta nadirlik -> coin fiyati (backend ShopController BOARD_RARITY ile BIREBIR).
export const BOARD_RARITY_PRICE: Record<'common' | 'rare' | 'epic' | 'legendary' | 'mythic', number> = {
  common: 50,
  rare: 90,
  epic: 150,
  legendary: 250,
  mythic: 400,
}
// Ucretsiz (her zaman sahip): SADECE 'standart'. Diger tum tahtalar (tavla/galaxy/kulup dahil) coin ile alinir.
export const FREE_BOARDS = new Set<string>(['standart'])
// Kulup temasi fiyati (nadirlik ladder'inda degil; sabit).
export const CLUB_BOARD_PRICE = 100
// Ulke boardu fiyati (nadirlik ladder'inda degil; sabit — kulup gibi kategori fiyati).
export const COUNTRY_BOARD_PRICE = 100
// TavlaTV Özel board fiyati (en ust kademe, tek özel board).
export const TAVLATV_BOARD_PRICE = 500
// Bir temanin etkin nadirligi (kendi alani -> THEME_RARITY -> 'common').
export function boardRarityOf(t: BoardTheme): NonNullable<BoardTheme['rarity']> {
  return t.rarity ?? THEME_RARITY[t.id] ?? 'common'
}
// Coin fiyati: 'standart' ucretsiz -> undefined; kulup/ulke -> sabit kategori fiyati; digerleri nadirlik fiyati.
export function boardPrice(t: BoardTheme): number | undefined {
  if (FREE_BOARDS.has(t.id)) return undefined
  const r = boardRarityOf(t)
  if (r === 'club') return CLUB_BOARD_PRICE
  if (r === 'country') return COUNTRY_BOARD_PRICE
  if (r === 'tavlatv') return TAVLATV_BOARD_PRICE
  return BOARD_RARITY_PRICE[r]
}

// Rename gecisi: eski board id'leri -> yeni Galaksi koleksiyonu id'leri.
// Eski temada olan kullanicilar otomatik yeni karsiligina tasinir.
export const BOARD_ID_MIGRATE: Record<string, string> = {
  neptune: 'blueorbit',
  nebula: 'violetstorm',
  montecarlo: 'monaco',
  earth: 'gaia',
  toxic: 'radioactive',
  moon: 'lunar',
  pluto: 'glacier',
  uranus: 'atlantis',
}

// #RRGGBB -> algilanan parlaklik (0-255). Watermark rengi board zeminine gore secilir
// (acik board -> koyu logo, koyu board -> acik logo).
export function hexLum(hex: string): number {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
