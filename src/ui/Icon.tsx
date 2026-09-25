/**
 * TavlaTv ikon seti — Tabler Icons (@tabler/icons-react) ile render edilir.
 * `<Icon name="trophy" size={18} />` API'si KORUNUR; her `IconName` bir Tabler
 * bilesenine map'lenir (MAP). Tabler outline ikonlari `currentColor` + `stroke`
 * (cizgi kalinligi, varsayilan 2) kullanir -> temaya/dark-mode'a uyar; dekoratif
 * oldugu icin aria-hidden. `weight` (Phosphor mirasi) -> `stroke`e cevrilir; birkac
 * ikon icin `weight="fill"` istenince DOLU (`...Filled`) varyant kullanilir (FILLED).
 * (Tabler ~5900 ikon; build tree-shake eder.)
 */

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
  IconCoin,
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
  IconLock,
  IconLockAccess,
  IconLockOpen,
  IconCamera,
  IconMenu2,
  IconMaximize,
  IconMinimize,
  IconAlertTriangle,
  IconAlertCircle,
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
  coin: IconCoin,
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
  const Cmp = (weight === 'fill' && FILLED[name]) || MAP[name]
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
