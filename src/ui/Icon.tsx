/**
 * TavlaTv ikon seti — Heroicons (v2, 24 Outline) ile render edilir.
 * `<Icon name="trophy" size={18} />` API'si korunur; sadece kaynak set degisti
 * (eski elle-yazilmis Lucide path'leri -> @heroicons/react/24/outline).
 * currentColor ile temaya uyar; dekoratif -> aria-hidden.
 *
 * NOT: Heroicons'ta birebir karsiligi olmayan birkac ikon en yakin muadille eslendi:
 *   medal->Trophy, dice->Cube, robot->CpuChip, coin->CurrencyDollar,
 *   crown->Sparkles, target->ViewfinderCircle. Istenirse tek tek degistirilebilir.
 */

import type { ComponentType, SVGProps } from 'react'
import {
  PlayIcon,
  SignalIcon,
  ChartBarIcon,
  TrophyIcon,
  ShoppingBagIcon,
  ChartBarSquareIcon,
  UserGroupIcon,
  CubeIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  FlagIcon,
  SunIcon,
  MoonIcon,
  BookOpenIcon,
  ArrowRightStartOnRectangleIcon,
  HomeIcon,
  StarIcon,
  GiftIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  AcademicCapIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  SparklesIcon,
  TicketIcon,
  BellIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
  ChevronDownIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PhoneIcon,
  ArrowPathIcon,
  ViewfinderCircleIcon,
  GlobeAltIcon,
  CpuChipIcon,
  TrashIcon,
  LockClosedIcon,
  CameraIcon,
  Bars3Icon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

export type IconName =
  | 'play'
  | 'live'
  | 'trophy'
  | 'medal'
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

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>

// Isim -> Heroicons (24 outline) bileseni. Yorumdaki ~ isaretlileri yaklasik muadil.
const MAP: Record<IconName, HeroIcon> = {
  play: PlayIcon,
  live: SignalIcon,
  trophy: ChartBarIcon, // liderlik/siralama
  medal: TrophyIcon, // turnuva (~ madalya)
  shop: ShoppingBagIcon,
  chart: ChartBarIcon,
  users: UserGroupIcon,
  analyze: ChartBarSquareIcon,
  dice: CubeIcon, // ~ zar
  settings: Cog6ToothIcon,
  install: ArrowDownTrayIcon,
  flag: FlagIcon,
  sun: SunIcon,
  moon: MoonIcon,
  book: BookOpenIcon,
  logout: ArrowRightStartOnRectangleIcon,
  home: HomeIcon,
  star: StarIcon,
  gift: GiftIcon,
  volume: SpeakerWaveIcon,
  mute: SpeakerXMarkIcon,
  graduation: AcademicCapIcon,
  bulb: LightBulbIcon,
  search: MagnifyingGlassIcon,
  chat: ChatBubbleLeftRightIcon,
  user: UserIcon,
  coin: CurrencyDollarIcon, // ~ coin
  banknotes: BanknotesIcon, // para/bahis (tek oyun money game)
  crown: SparklesIcon, // ~ premium/uyelik
  ticket: TicketIcon,
  bell: BellIcon,
  eye: EyeIcon,
  check: CheckIcon,
  x: XMarkIcon,
  pencil: PencilIcon,
  chevron: ChevronDownIcon,
  calendar: CalendarDaysIcon,
  pin: MapPinIcon,
  phone: PhoneIcon,
  refresh: ArrowPathIcon,
  target: ViewfinderCircleIcon, // ~ hedef/mac
  globe: GlobeAltIcon,
  robot: CpuChipIcon, // ~ yapay zeka
  trash: TrashIcon,
  lock: LockClosedIcon,
  camera: CameraIcon,
  menu: Bars3Icon,
  maximize: ArrowsPointingOutIcon,
  minimize: ArrowsPointingInIcon,
  alert: ExclamationTriangleIcon,
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
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', display: 'inline-block', verticalAlign: '-0.15em' }}
    />
  )
}
