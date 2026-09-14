import type { IconName } from './ui/Icon'

/**
 * MERKEZI SAYFA KAYDI — tek kaynak. Menu ogeleri, URL slug'lari, aktif vurgu ve
 * derin-link parse'i HEP buradan turetilir. Yeni menu sayfasi eklemek: buraya bir
 * giris + App'te ilgili state binding'i (open/isOpen) — slug/menu/vurgu otomatik.
 *
 * NOT: Oyun akisi (home/setup/online/game) BURAYA GIRMEZ — onlar sayfa degil, oyun durumu.
 */

export type MenuGroup = 'play' | 'compete' | 'fun' | 'content' | 'tools' | 'account' | 'info'

export interface PageDef {
  key: string // aktif-vurgu + binding anahtari
  slug: string // URL yolu (/slug)
  labelKey: string // i18n anahtari (menu etiketi)
  icon: IconName
  group: MenuGroup
  gate?: 'user' | 'premium' // menude gorunurluk kosulu (yoksa herkese)
  hideInGame?: boolean // oyun ekraninda menude gizle
  inMenu?: boolean // false ise sol menude gorunmez (yalnizca routable). Varsayilan true.
}

// Sira = menude gorunum sirasi. Ardisik ayni-grup ogeleri tek blok olur; her blogun
// ustune MENU_GROUP_LABELS'tan gorunur baslik cizilir (SideMenu). Grup sirasi = OYNA,
// YARISMA, EGLENCE, KESFET, ARACLAR, HESAP, Bilgi.
export const PAGES: PageDef[] = [
  // --- OYNA: oyun baslatma ---
  { key: 'solo', slug: 'tek-oyun', labelKey: 'menu.solo', icon: 'coins', group: 'play', hideInGame: true },
  { key: 'match', slug: 'yeni-oyun', labelKey: 'menu.match', icon: 'ranking', group: 'play', hideInGame: true },
  { key: 'aiGame', slug: 'yz-ile-oyna', labelKey: 'menu.aiGame', icon: 'robot', group: 'play', hideInGame: true },
  { key: 'playFriend', slug: 'arkadasinla-oyna', labelKey: 'menu.playFriend', icon: 'users', group: 'play', hideInGame: true },

  // --- TURNUVALAR: rekabet + sosyal ---
  { key: 'tournaments', slug: 'online-turnuvalar', labelKey: 'menu.tournaments', icon: 'trophy', group: 'compete' },
  { key: 'leaderboard', slug: 'lider-tablosu', labelKey: 'menu.leaderboard', icon: 'crown', group: 'compete' },
  { key: 'friends', slug: 'arkadaslar', labelKey: 'menu.friends', icon: 'users', group: 'compete', gate: 'user' },
  // Mesajlar (Sohbet): sol menude gorunur + sag ust barda da chat ikonu var. /mesajlar'a gider.
  { key: 'messages', slug: 'mesajlar', labelKey: 'dm.title', icon: 'chat', group: 'compete', gate: 'user' },

  // --- EGLENCE: sans/ekonomi oyunlari — SAG UST bara tasindi (account-bar ikonlari);
  // sol menude GIZLI (inMenu:false) ama /sans-carki + /zar-slotu URL'leri + top-bar ikonlari calisir. ---
  { key: 'luckywheel', slug: 'sans-carki', labelKey: 'lw.menu', icon: 'spinner-ball', group: 'fun', hideInGame: true, inMenu: false },
  { key: 'diceslot', slug: 'zar-slotu', labelKey: 'ds.menu', icon: 'dice', group: 'fun', hideInGame: true, inMenu: false },

  // --- KESFET: bilgi / icerik (herkese acik) ---
  { key: 'calendar', slug: 'turnuva-takvimi', labelKey: 'menu.calendar', icon: 'calendar-dots', group: 'content', hideInGame: true },
  { key: 'clubs', slug: 'kulupler', labelKey: 'menu.clubs', icon: 'building-office', group: 'content', hideInGame: true },
  { key: 'news', slug: 'haberler', labelKey: 'menu.news', icon: 'newspaper', group: 'content', hideInGame: true },
  { key: 'magazine', slug: 'tavla-magazin', labelKey: 'menu.magazine', icon: 'monitor-play', group: 'content', hideInGame: true },
  // Ürünler sol menüde DEĞİL (Mağaza'nın "Ürünler" sekmesine taşındı); /urunler derin-link çalışır.
  { key: 'products', slug: 'urunler', labelKey: 'menu.products', icon: 'package', group: 'content', hideInGame: true, inMenu: false },

  // --- ARACLAR: analiz araclari ---
  { key: 'analyzer', slug: 'pozisyon-analizi', labelKey: 'pa.title', icon: 'search', group: 'tools' },
  // Mat Analiz: kullanici .mat maci yukler, motor tam analiz eder (ozet: PR/blunder/hata/kesinsizlik).
  { key: 'matAnalyzer', slug: 'mat-analiz', labelKey: 'ma.title', icon: 'file-magnifying-glass', group: 'tools' },
  { key: 'achievements', slug: 'basarimlar', labelKey: 'ach.title', icon: 'medal', group: 'tools', inMenu: false },
  { key: 'blunders', slug: 'hata-gunlugu', labelKey: 'menu.blunders', icon: 'warning-circle', group: 'tools' },
  { key: 'matchHistory', slug: 'mac-analizleri', labelKey: 'menu.matchHistory', icon: 'chart-line', group: 'tools' },

  // --- HESAP ---
  { key: 'membership', slug: 'uyelik', labelKey: 'mem.menu', icon: 'star', group: 'account' },
  // Mağaza: coin + fiziksel ürünler + tahta/çerçeve tek sayfada (Shop bileşeni, Ürünler sekmesi).
  { key: 'shop', slug: 'magaza', labelKey: 'shop.title', icon: 'shop', group: 'account', gate: 'user' },
  // Siparişlerim sol menüde DEĞİL; profil sayfasından açılır (inMenu:false -> /siparislerim yine çalışır).
  { key: 'myOrders', slug: 'siparislerim', labelKey: 'menu.myOrders', icon: 'package', group: 'account', gate: 'user', inMenu: false },

  // --- BİLGİ: sabit 6 alt sayfa (icerik admin-duzenlenebilir; /bilgi/<slug> derin-link).
  // Tek "Bilgi" ogesi yerine sayfalar TEK TEK "Bilgi" basligi altinda listelenir.
  // 'info' anahtari menude gizli (inMenu:false) ama /bilgi bare + onInfo handler icin kalir.
  { key: 'info', slug: 'bilgi', labelKey: 'menu.info', icon: 'info', group: 'info', inMenu: false },
  { key: 'info-about', slug: 'bilgi/hakkinda', labelKey: 'info.tab.about', icon: 'info', group: 'info', hideInGame: true },
  { key: 'info-services', slug: 'bilgi/hizmetler', labelKey: 'menu.services', icon: 'briefcase', group: 'info', hideInGame: true },
  { key: 'info-ranks', slug: 'bilgi/rutbeler', labelKey: 'menu.ranks', icon: 'ranking', group: 'info', hideInGame: true },
  { key: 'info-scoring', slug: 'bilgi/puanlama', labelKey: 'info.tab.scoring', icon: 'chart-line', group: 'info', hideInGame: true },
  { key: 'info-badges', slug: 'bilgi/basarilarim', labelKey: 'ach.title', icon: 'medal', group: 'info', hideInGame: true },
  { key: 'info-fair', slug: 'bilgi/adil-zar', labelKey: 'fair.title', icon: 'dice', group: 'info', hideInGame: true },
]

export const PAGE_BY_KEY: Record<string, PageDef> = Object.fromEntries(PAGES.map((p) => [p.key, p]))
export const PAGE_BY_SLUG: Record<string, PageDef> = Object.fromEntries(PAGES.map((p) => [p.slug, p]))
export const MENU_GROUP_ORDER: MenuGroup[] = ['play', 'compete', 'fun', 'content', 'tools', 'account', 'info']

// Grup basligi i18n anahtari (sol menude gorunur, silik buyuk-harf). null -> baslik cizilmez.
// NOT: bunlar VARSAYILAN; admin "Sol Menu" panelinden grup/ad/sira override edilebilir.
export const MENU_GROUP_LABELS: Record<MenuGroup, string | null> = {
  play: 'menu.group.play',
  compete: 'menu.group.compete',
  fun: 'menu.group.fun',
  content: 'menu.group.content',
  tools: 'menu.group.tools',
  account: 'menu.group.account',
  info: 'menu.info', // "Bilgi" basligi (altinda 6 alt sayfa)
}
