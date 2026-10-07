/**
 * TavlaTv ikon seti — Tabler Icons (@tabler/icons-react) ile render edilir.
 * `<Icon name="trophy" size={18} />` API'si KORUNUR; her `IconName` bir Tabler
 * bilesenine map'lenir (MAP). Tabler outline ikonlari `currentColor` + `stroke`
 * (cizgi kalinligi, varsayilan 2) kullanir -> temaya/dark-mode'a uyar; dekoratif
 * oldugu icin aria-hidden. `weight` (Phosphor mirasi) -> `stroke`e cevrilir; birkac
 * ikon icin `weight="fill"` istenince DOLU (`...Filled`) varyant kullanilir (FILLED).
 * (Tabler ~5900 ikon; build tree-shake eder.)
 */

import { useEffect, useState } from 'react'
import { type Icon as TablerIcon } from '@tabler/icons-react'
import {
  IconPlayerPlay,
  IconBroadcast,
  IconTrophy,
  IconMedal,
  IconRosette,
  IconRosetteFilled,
  IconCoins,
  IconBuildingStore,
  IconChartBar,
  IconUsers,
  IconUserPlus,
  IconTrendingUp,
  IconChartLine,
  IconDice5,
  IconFlame,
  IconSettings,
  IconDownload,
  IconFlag,
  IconSun,
  IconMoon,
  IconBook,
  IconBooks,
  IconZoomQuestion,
  IconQuestionMark,
  IconLogout,
  IconHome,
  IconStar,
  IconStarFilled,
  IconCreditCard,
  IconCash,
  IconGift,
  IconRotateClockwise2,
  IconCherry,
  IconVolume,
  IconVolumeOff,
  IconSchool,
  IconBulb,
  IconSearch,
  IconMessageCircle,
  IconUser,
  IconCrown,
  IconCrownFilled,
  IconTicket,
  IconBell,
  IconEye,
  IconCheck,
  IconChecks,
  IconX,
  IconPencil,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconArrowRight,
  IconArrowUp,
  IconCalendar,
  IconCalendarEvent,
  IconMapPin,
  IconPhone,
  IconRefresh,
  IconTarget,
  IconWorld,
  IconRobot,
  IconRobotFace,
  IconTrash,
  IconDotsVertical,
  IconBan,
  IconLock,
  IconLockAccess,
  IconLockOpen,
  IconCamera,
  IconMenu2,
  IconMaximize,
  IconMinimize,
  IconAlertTriangle,
  IconAlertCircle,
  IconAlertCircleFilled,
  IconWifi,
  IconWifiOff,
  IconBuilding,
  IconBuildingCommunity,
  IconBuildingBank,
  IconNews,
  IconBriefcase,
  IconArticle,
  IconPalette,
  IconInfoCircle,
  IconShieldCheck,
  IconClock,
  IconFingerprint,
  IconPackage,
  IconShoppingCart,
  IconTag,
  IconCode,
  IconCopy,
  IconFileSearch,
  IconDice1,
  IconDice2,
  IconDice3,
  IconDice4,
  IconDice6,
  IconDice1Filled,
  IconDice2Filled,
  IconDice3Filled,
  IconDice4Filled,
  IconDice5Filled,
  IconDice6Filled,
  IconBrandInstagram,
  IconBrandYoutube,
  IconBrandWhatsapp,
  IconMail,
  IconMoodSad,
  IconMoodSmile,
  IconSend,
  IconSpeakerphone,
  IconSword,
  IconHeart,
  IconHeartFilled,
} from '@tabler/icons-react'

export type IconName =
  | 'play'
  | 'live'
  | 'trophy'
  | 'medal'
  | 'ranking'
  | 'coins'
  | 'shop'
  | 'chart'
  | 'users'
  | 'user-plus'
  | 'analyze'
  | 'dice'
  | 'settings'
  | 'install'
  | 'flag'
  | 'sun'
  | 'moon'
  | 'book'
  | 'books'
  | 'zoom-question'
  | 'question-mark'
  | 'logout'
  | 'home'
  | 'star'
  | 'credit-card'
  | 'money'
  | 'gift'
  | 'spinner-ball'
  | 'slot'
  | 'volume'
  | 'mute'
  | 'graduation'
  | 'bulb'
  | 'search'
  | 'chat'
  | 'user'
  | 'coin'
  | 'banknotes'
  | 'crown'
  | 'crown-simple'
  | 'ticket'
  | 'bell'
  | 'eye'
  | 'check'
  | 'checks'
  | 'x'
  | 'pencil'
  | 'chevron'
  | 'caret-left'
  | 'caret-right'
  | 'arrow-right'
  | 'arrow-up'
  | 'calendar'
  | 'pin'
  | 'phone'
  | 'whatsapp'
  | 'refresh'
  | 'target'
  | 'globe'
  | 'robot'
  | 'robot-face'
  | 'trash'
  | 'dots-vertical'
  | 'ban'
  | 'lock'
  | 'camera'
  | 'menu'
  | 'maximize'
  | 'minimize'
  | 'alert'
  | 'calendar-dots'
  | 'building-office'
  | 'building-community'
  | 'newspaper'
  | 'briefcase'
  | 'monitor-play'
  | 'article'
  | 'palette'
  | 'warning-circle'
  | 'wifi'
  | 'wifi-off'
  | 'chart-line'
  | 'info'
  | 'smiley'
  | 'paper-plane-right'
  | 'shield-check'
  | 'clock'
  | 'lock-key'
  | 'lock-open'
  | 'fingerprint'
  | 'package'
  | 'cart'
  | 'tag'
  | 'code'
  | 'copy'
  | 'bank'
  | 'file-magnifying-glass'
  | 'die-1'
  | 'die-2'
  | 'die-3'
  | 'die-4'
  | 'die-5'
  | 'die-6'
  | 'flame'
  | 'instagram'
  | 'youtube'
  | 'mail'
  | 'smiley-sad'
  | 'megaphone'
  | 'sword'
  | 'heart'
  | 'chart-bar-popular'

// Isim -> Tabler outline bileseni (currentColor + stroke; weight -> stroke'a cevrilir).
const MAP: Record<IconName, TablerIcon> = {
  play: IconPlayerPlay,
  live: IconBroadcast,
  trophy: IconTrophy,
  medal: IconMedal,
  ranking: IconRosette,
  coins: IconCoins,
  shop: IconBuildingStore,
  chart: IconChartBar,
  users: IconUsers,
  'user-plus': IconUserPlus,
  analyze: IconTrendingUp,
  dice: IconDice5,
  flame: IconFlame,
  settings: IconSettings,
  install: IconDownload,
  flag: IconFlag,
  sun: IconSun,
  moon: IconMoon,
  book: IconBook,
  books: IconBooks,
  'zoom-question': IconZoomQuestion,
  'question-mark': IconQuestionMark,
  logout: IconLogout,
  home: IconHome,
  star: IconStar,
  'credit-card': IconCreditCard,
  money: IconCash,
  gift: IconGift,
  'spinner-ball': IconRotateClockwise2,
  slot: IconCherry,
  volume: IconVolume,
  mute: IconVolumeOff,
  graduation: IconSchool,
  bulb: IconBulb,
  search: IconSearch,
  chat: IconMessageCircle,
  user: IconUser,
  coin: IconCoins, // "$"'li IconCoin yerine dolar-sız yığın-coin (site genelinde dolar işareti istenmiyor)
  banknotes: IconCash,
  crown: IconCrown,
  'crown-simple': IconCrown,
  ticket: IconTicket,
  bell: IconBell,
  eye: IconEye,
  check: IconCheck,
  checks: IconChecks,
  x: IconX,
  pencil: IconPencil,
  chevron: IconChevronDown,
  'caret-left': IconChevronLeft,
  'caret-right': IconChevronRight,
  'arrow-right': IconArrowRight,
  'arrow-up': IconArrowUp,
  calendar: IconCalendar,
  pin: IconMapPin,
  phone: IconPhone,
  refresh: IconRefresh,
  target: IconTarget,
  globe: IconWorld,
  robot: IconRobot,
  'robot-face': IconRobotFace,
  trash: IconTrash,
  'dots-vertical': IconDotsVertical,
  ban: IconBan,
  lock: IconLock,
  camera: IconCamera,
  menu: IconMenu2,
  maximize: IconMaximize,
  minimize: IconMinimize,
  alert: IconAlertTriangle,
  'calendar-dots': IconCalendarEvent,
  'building-office': IconBuilding,
  'building-community': IconBuildingCommunity,
  newspaper: IconNews,
  briefcase: IconBriefcase,
  'monitor-play': IconBrandYoutube,
  article: IconArticle,
  palette: IconPalette,
  'warning-circle': IconAlertCircle,
  wifi: IconWifi,
  'wifi-off': IconWifiOff,
  'chart-line': IconChartLine,
  info: IconInfoCircle,
  'shield-check': IconShieldCheck,
  clock: IconClock,
  'lock-key': IconLockAccess,
  'lock-open': IconLockOpen,
  fingerprint: IconFingerprint,
  package: IconPackage,
  cart: IconShoppingCart,
  tag: IconTag,
  code: IconCode,
  copy: IconCopy,
  bank: IconBuildingBank,
  'file-magnifying-glass': IconFileSearch,
  'die-1': IconDice1,
  'die-2': IconDice2,
  'die-3': IconDice3,
  'die-4': IconDice4,
  'die-5': IconDice5,
  'die-6': IconDice6,
  instagram: IconBrandInstagram,
  youtube: IconBrandYoutube,
  whatsapp: IconBrandWhatsapp,
  mail: IconMail,
  'smiley-sad': IconMoodSad,
  smiley: IconMoodSmile,
  'paper-plane-right': IconSend,
  megaphone: IconSpeakerphone,
  sword: IconSword,
  heart: IconHeart,
  'chart-bar-popular': IconChartBar,
}

// weight="fill" istenince DOLU varyant (yalniz karsiligi olan + dolu kullanilan ikonlar).
// Karsiligi yoksa (or. medal) outline'a duser -> gorsel olarak yine dogru, sadece cizgi.
const FILLED: Partial<Record<IconName, TablerIcon>> = {
  ranking: IconRosetteFilled,
  crown: IconCrownFilled,
  'crown-simple': IconCrownFilled,
  star: IconStarFilled,
  'die-1': IconDice1Filled,
  'die-2': IconDice2Filled,
  'die-3': IconDice3Filled,
  'die-4': IconDice4Filled,
  'die-5': IconDice5Filled,
  'die-6': IconDice6Filled,
  heart: IconHeartFilled,
  'warning-circle': IconAlertCircleFilled,
}

// Tum ikon isimleri (showcase galerisi kullanir)
export const ICON_NAMES = Object.keys(MAP) as IconName[]

export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'

// Phosphor `weight` -> Tabler `stroke` (cizgi kalinligi). Dolu/duotone outline'da 2.
const STROKE: Record<IconWeight, number> = {
  thin: 1,
  light: 1.5,
  regular: 1.5,
  bold: 2.6,
  fill: 1.5,
  duotone: 1.5,
}

// Admin-yapıştırma (MAP'te olmayan) Tabler ikonu: CDN outline svg'sini bir kez fetch'le, SATIR-İÇİ
// <svg> olarak çiz -> site `stroke` (çizgi kalınlığı 1.5) + currentColor UYGULANIR (eski maske <span>'de
// uygulanamıyordu: siyah + kalın görünüyordu). XSS kalkanı: slug [a-z0-9-]; fetch gövdesinden
// <script>/<style>/on* STRIP edilir (yalnız şekil öğeleri kalır); kaynak güvenilir (jsdelivr @tabler).
// Başarısız/engelli -> boş kutu (çizim yok), ASLA crash. Modül-düzeyi cache: her slug bir kez fetch.
const cdnIconCache = new Map<string, string>()

function CdnIcon({ slug, size, weight, className }: { slug: string; size: number; weight: IconWeight; className?: string }) {
  const [inner, setInner] = useState<string | null>(cdnIconCache.get(slug) ?? null)
  useEffect(() => {
    const cached = cdnIconCache.get(slug)
    if (cached !== undefined) {
      setInner(cached)
      return
    }
    let alive = true
    fetch(`https://cdn.jsdelivr.net/npm/@tabler/icons@3.48.0/icons/outline/${slug}.svg`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((txt) => {
        const body = txt
          .replace(/^[\s\S]*?<svg[^>]*>/i, '')
          .replace(/<\/svg>[\s\S]*$/i, '')
          .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
          .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
        cdnIconCache.set(slug, body)
        if (alive) setInner(body)
      })
      .catch(() => {
        cdnIconCache.set(slug, '')
        if (alive) setInner('')
      })
    return () => {
      alive = false
    }
  }, [slug])
  const base = { flex: 'none', display: 'inline-block', verticalAlign: '-0.15em' } as const
  if (!inner) return <span className={className} aria-hidden="true" style={{ ...base, width: size, height: size }} />
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE[weight]}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      style={base}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

export function Icon({
  name,
  size = 20,
  className,
  weight = 'regular',
}: {
  name: IconName
  size?: number
  className?: string
  // Cizgi kalinligi (Phosphor mirasi). Varsayilan temiz outline; oklar gibi vurgu icin 'bold',
  // dolu gorunum icin 'fill' (karsiligi olan ikonlarda DOLU varyant kullanilir).
  weight?: IconWeight
}) {
  if (name === 'chart-bar-popular') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
        style={{
          flex: 'none',
          display: 'inline-block',
          verticalAlign: '-0.15em',
        }}
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE[weight]}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6" />
        <path d="M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10" />
        <path d="M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14" />
        <path d="M4 20h14" />
      </svg>
    )
  }
  const Cmp = (weight === 'fill' && FILLED[name]) || MAP[name]
  if (!Cmp) {
    // Bilinmeyen ad -> admin'in Tabler'dan yapistirdigi ikon slug'i (or. 'arrow-guide').
    // CdnIcon: Tabler CDN outline svg'sini SATIR-ICI (<svg>) cizer -> site `stroke` (cizgi
    // kalinligi) + currentColor UYGULANIR (yerlesik ikonlarla AYNI incelik/renk). Bkz CdnIcon.
    const slug = String(name).toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!slug) return null
    return <CdnIcon slug={slug} size={size} weight={weight} className={className} />
  }
  return (
    <Cmp
      className={className}
      size={size}
      stroke={STROKE[weight]}
      aria-hidden="true"
      style={{ flex: 'none', display: 'inline-block', verticalAlign: '-0.15em' }}
    />
  )
}
