import type { IconName } from './ui/Icon'

/**
 * MERKEZI SAYFA KAYDI — tek kaynak. Menu ogeleri, URL slug'lari, aktif vurgu ve
 * derin-link parse'i HEP buradan turetilir. Yeni menu sayfasi eklemek: buraya bir
 * giris + App'te ilgili state binding'i (open/isOpen) — slug/menu/vurgu otomatik.
 *
 * NOT: Oyun akisi (home/setup/online/game) BURAYA GIRMEZ — onlar sayfa degil, oyun durumu.
 */

export type MenuGroup = 'play' | 'compete' | 'account' | 'content' | 'tools' | 'info'

export interface PageDef {
  key: string // aktif-vurgu + binding anahtari
  slug: string // URL yolu (/slug)
  labelKey: string // i18n anahtari (menu etiketi)
  icon: IconName
  group: MenuGroup
  gate?: 'user' | 'premium' // menude gorunurluk kosulu (yoksa herkese)
  hideInGame?: boolean // oyun ekraninda menude gizle
}

// Sira = menude gorunum sirasi. Grup basliklari CSS'te .menu-group ile ayrilir.
export const PAGES: PageDef[] = [
  // --- Oyun baslatma ---
  { key: 'solo', slug: 'tek-oyun', labelKey: 'menu.solo', icon: 'coins', group: 'play', hideInGame: true },
  { key: 'match', slug: 'yeni-oyun', labelKey: 'menu.match', icon: 'ranking', group: 'play', hideInGame: true },
  { key: 'aiGame', slug: 'yz-ile-oyna', labelKey: 'menu.aiGame', icon: 'robot', group: 'play', hideInGame: true },
  { key: 'playFriend', slug: 'arkadasinla-oyna', labelKey: 'menu.playFriend', icon: 'users', group: 'play', hideInGame: true },

  // --- Rekabet + sosyal ---
  { key: 'tournaments', slug: 'online-turnuvalar', labelKey: 'menu.tournaments', icon: 'trophy', group: 'compete' },
  { key: 'leaderboard', slug: 'lider-tablosu', labelKey: 'menu.leaderboard', icon: 'crown', group: 'compete' },
  { key: 'friends', slug: 'arkadaslar', labelKey: 'menu.friends', icon: 'users', group: 'compete', gate: 'user' },

  // --- Hesap ---
  { key: 'membership', slug: 'uyelik', labelKey: 'mem.menu', icon: 'star', group: 'account' },

  // --- Bilgi / icerik (herkese acik) ---
  { key: 'calendar', slug: 'turnuva-takvimi', labelKey: 'menu.calendar', icon: 'calendar-dots', group: 'content', hideInGame: true },
  { key: 'clubs', slug: 'kulupler', labelKey: 'menu.clubs', icon: 'building-office', group: 'content', hideInGame: true },
  { key: 'news', slug: 'haberler', labelKey: 'menu.news', icon: 'newspaper', group: 'content', hideInGame: true },
  { key: 'magazine', slug: 'tavla-magazin', labelKey: 'menu.magazine', icon: 'monitor-play', group: 'content', hideInGame: true },

  // --- Araclar ---
  { key: 'analyzer', slug: 'pozisyon-analizi', labelKey: 'pa.title', icon: 'search', group: 'tools' },
  { key: 'achievements', slug: 'basarimlar', labelKey: 'ach.title', icon: 'medal', group: 'tools' },
  { key: 'blunders', slug: 'hata-gunlugu', labelKey: 'menu.blunders', icon: 'warning-circle', group: 'tools' },
  { key: 'matchHistory', slug: 'mac-analizleri', labelKey: 'menu.matchHistory', icon: 'chart-line', group: 'tools' },

  // --- Bilgi (en altta) ---
  { key: 'info', slug: 'bilgi', labelKey: 'menu.info', icon: 'info', group: 'info' },
]

export const PAGE_BY_KEY: Record<string, PageDef> = Object.fromEntries(PAGES.map((p) => [p.key, p]))
export const PAGE_BY_SLUG: Record<string, PageDef> = Object.fromEntries(PAGES.map((p) => [p.slug, p]))
export const MENU_GROUP_ORDER: MenuGroup[] = ['play', 'compete', 'account', 'content', 'tools', 'info']
