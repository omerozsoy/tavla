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
  Coins,
  Storefront,
  ChartBar,
  UsersThree,
  UserPlus,
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
  Flame,
  Gift,
  SpeakerHigh,
  SpeakerSlash,
  GraduationCap,
  Lightbulb,
  MagnifyingGlass,
  Info,
  ChatCircle,
  User,
  Coin,
  Money,
  Crown,
  Ticket,
  Bell,
  Eye,
  Check,
  Checks,
  X,
  Pencil,
  CaretDown,
  CaretLeft,
  CaretRight,
  ArrowRight,
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
  CalendarDots,
  BuildingOffice,
  Newspaper,
  Briefcase,
  MonitorPlay,
  WarningCircle,
  ChartLine,
  ShieldCheck,
  Clock,
  LockKey,
  LockKeyOpen,
  Fingerprint,
  Package,
  Tag,
  Code,
  Copy,
  DiceOne,
  DiceTwo,
  DiceThree,
  DiceFour,
  DiceSix,
  InstagramLogo,
  YoutubeLogo,
  WhatsappLogo,
  EnvelopeSimple,
} from '@phosphor-icons/react'

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
  | 'checks'
  | 'x'
  | 'pencil'
  | 'chevron'
  | 'caret-left'
  | 'caret-right'
  | 'arrow-right'
  | 'calendar'
  | 'pin'
  | 'phone'
  | 'whatsapp'
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
  | 'calendar-dots'
  | 'building-office'
  | 'newspaper'
  | 'briefcase'
  | 'monitor-play'
  | 'warning-circle'
  | 'chart-line'
  | 'info'
  | 'shield-check'
  | 'clock'
  | 'lock-key'
  | 'lock-open'
  | 'fingerprint'
  | 'package'
  | 'tag'
  | 'code'
  | 'copy'
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

// Isim -> Phosphor bileseni (temiz outline icin weight="regular").
const MAP: Record<IconName, PhosphorIcon> = {
  play: Play,
  live: Broadcast,
  trophy: Trophy,
  medal: Medal,
  ranking: Ranking,
  coins: Coins,
  shop: Storefront,
  chart: ChartBar,
  users: UsersThree,
  'user-plus': UserPlus,
  analyze: ChartLineUp,
  dice: DiceFive,
  flame: Flame,
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
  checks: Checks,
  x: X,
  pencil: Pencil,
  chevron: CaretDown,
  'caret-left': CaretLeft,
  'caret-right': CaretRight,
  'arrow-right': ArrowRight,
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
  'calendar-dots': CalendarDots,
  'building-office': BuildingOffice,
  newspaper: Newspaper,
  briefcase: Briefcase,
  'monitor-play': MonitorPlay,
  'warning-circle': WarningCircle,
  'chart-line': ChartLine,
  info: Info,
  'shield-check': ShieldCheck,
  clock: Clock,
  'lock-key': LockKey,
  'lock-open': LockKeyOpen,
  fingerprint: Fingerprint,
  package: Package,
  tag: Tag,
  code: Code,
  copy: Copy,
  'die-1': DiceOne,
  'die-2': DiceTwo,
  'die-3': DiceThree,
  'die-4': DiceFour,
  'die-5': DiceFive,
  'die-6': DiceSix,
  instagram: InstagramLogo,
  youtube: YoutubeLogo,
  whatsapp: WhatsappLogo,
  mail: EnvelopeSimple,
}

// Tum ikon isimleri (showcase galerisi kullanir)
export const ICON_NAMES = Object.keys(MAP) as IconName[]

export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'

export function Icon({
  name,
  size = 20,
  className,
  weight = 'regular',
}: {
  name: IconName
  size?: number
  className?: string
  // Cizgi kalinligi (Phosphor). Varsayilan temiz outline; oklar gibi vurgu icin 'bold'.
  weight?: IconWeight
}) {
  const Cmp = MAP[name]
  return (
    <Cmp
      className={className}
      size={size}
      weight={weight}
      aria-hidden="true"
      style={{ flex: 'none', display: 'inline-block', verticalAlign: '-0.15em' }}
    />
  )
}