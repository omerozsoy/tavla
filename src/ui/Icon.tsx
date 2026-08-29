/**
 * TavlaTv ikon seti — Phosphor Icons (@phosphor-icons/react) ile render edilir.
 * `<Icon name="trophy" size={18} />` API'si korunur; her `IconName` bir Phosphor
 * bilesenine map'lenir (MAP). weight="regular" -> temiz cizgi/outline. currentColor
 * ile temaya uyar; dekoratif -> aria-hidden. (Phosphor ~9000 ikon; build tree-shake eder.)
 */

import { type Icon as PhosphorIcon } from '@phosphor-icons/react'
import {
  Play,
  Broadcast,
  Trophy,
  Medal,
  Ranking,
  Storefront,
  ChartBar,
  UsersThree,
  ChartLineUp,
  DiceFive,
  GearSix,
  DownloadSimple,
  Flag,
  Sun,
  Moon,
  BookOpen,
  SignOut,
  House,
  Star,
  Gift,
  SpeakerHigh,
  SpeakerSlash,
  GraduationCap,
  Lightbulb,
  MagnifyingGlass,
  ChatCircle,
  User,
  Coin,
  Money,
  Crown,
  Ticket,
  Bell,
  Eye,
  Check,
  X,
  Pencil,
  CaretDown,
  CalendarBlank,
  MapPin,
  Phone,
  ArrowsClockwise,
  Target,
  Globe,
  Robot,
  Trash,
  Lock,
  Camera,
  List,
  ArrowsOut,
  ArrowsIn,
  Warning,
} from '@phosphor-icons/react'

export type IconName =
  | 'play'
  | 'live'
  | 'trophy'
  | 'medal'
  | 'ranking'
  | 'shop'
  | 'chart'
  | 'users'
  | 'analyze'
  | 'dice'
  | 'settings'
  | 'install'
  | 'flag'
  | 'sun'
  | 'moon'
  | 'book'
  | 'logout'
  | 'home'
  | 'star'
  | 'gift'
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
  | 'ticket'
  | 'bell'
  | 'eye'
  | 'check'
  | 'x'
  | 'pencil'
  | 'chevron'
  | 'calendar'
  | 'pin'
  | 'phone'
  | 'refresh'
  | 'target'
  | 'globe'
  | 'robot'
  | 'trash'
  | 'lock'
  | 'camera'
  | 'menu'
  | 'maximize'
  | 'minimize'
  | 'alert'

// Isim -> Phosphor bileseni (temiz outline icin weight="regular").
const MAP: Record<IconName, PhosphorIcon> = {
  play: Play,
  live: Broadcast,
  trophy: Trophy,
  medal: Medal,
  ranking: Ranking,
  shop: Storefront,
  chart: ChartBar,
  users: UsersThree,
  analyze: ChartLineUp,
  dice: DiceFive,
  settings: GearSix,
  install: DownloadSimple,
  flag: Flag,
  sun: Sun,
  moon: Moon,
  book: BookOpen,
  logout: SignOut,
  home: House,
  star: Star,
  gift: Gift,
  volume: SpeakerHigh,
  mute: SpeakerSlash,
  graduation: GraduationCap,
  bulb: Lightbulb,
  search: MagnifyingGlass,
  chat: ChatCircle,
  user: User,
  coin: Coin,
  banknotes: Money,
  crown: Crown,
  ticket: Ticket,
  bell: Bell,
  eye: Eye,
  check: Check,
  x: X,
  pencil: Pencil,
  chevron: CaretDown,
  calendar: CalendarBlank,
  pin: MapPin,
  phone: Phone,
  refresh: ArrowsClockwise,
  target: Target,
  globe: Globe,
  robot: Robot,
  trash: Trash,
  lock: Lock,
  camera: Camera,
  menu: List,
  maximize: ArrowsOut,
  minimize: ArrowsIn,
  alert: Warning,
}

// Tum ikon isimleri (showcase galerisi kullanir)
export const ICON_NAMES = Object.keys(MAP) as IconName[]

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName
  size?: number
  className?: string
}) {
  const Cmp = MAP[name]
  return (
    <Cmp
      className={className}
      size={size}
      weight="regular"
      aria-hidden="true"
      style={{ flex: 'none', display: 'inline-block', verticalAlign: '-0.15em' }}
    />
  )
}
