import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import './App.css'
import './ui/landscapePhone.css'
// Cerceve animasyon secim demosu: gizli /cerceve-anim, tum sade animasyonlar isimli.
const CerceveAnim = lazy(() => import('./ui/CerceveAnim'))
import { ErrorBoundary } from './ui/ErrorBoundary'
import type { GameState, Move, Player, Step } from './engine/types'
import { cloneState, gameOutcome, opponent, winner } from './engine/board'
import { applyStep, boardKey, generateMoves, hasNoMove } from './engine/moves'
import { matchGnubgMove } from './engine/gnubgMove'
import {
  ResignationType,
  calculateResignationPoints,
  resignMultiplier,
  resignationValue,
  resignationTypeForValue,
} from './engine/resign'
import { checkerDecision, onePointFactor, prMatchEquity } from './analysis/pr'
import { prDebugRecord, prDebugSummary, prDebugEnabled } from './analysis/prDebug'
import { offerLoss, takeLoss } from './engine/cubeEquity'
import {
  initialState,
  legalNextSteps,
  newTurn,
  reachableFromChecker,
  secureDie,
} from './engine/game'
import { HeuristicBot } from './engine/engine'
import { FairDice } from './engine/fairDice'
import { NeuralBot, type RankedMove } from './engine/neuralBot'
import { moveNotation } from './engine/notation'
import { explainMove, type Reason } from './engine/explain'
import { divisionOfPR } from './badges'
import { subscribeRankThresholds, rankThresholdsVersion } from './rankConfig'
import { Sound, isMuted, setMuted, getVolume, setVolume } from './sound'
import { evaluatePosition, pipCount } from './engine/evaluate'
import {
  canDouble,
  matchWinner,
  newMatch,
  scoreGame,
  setupNextGame,
  shouldAutoRoll,
  type MatchState,
} from './engine/match'
import { cubeAdvice, takeDecision, type CubeAction, type TakeAction } from './engine/cube'
import { reconstructOppMove, oppMoveBase, mergeOppLog } from './online/oppMove'
import {
  isOnlineReady,
  openingNeedsResync,
  openingStateFromMatch,
  serverMatchToLocal,
  shouldApplyServerState,
  serverSyncRoomChanged,
  isDuplicateSubmit,
  nextSubmittedKey,
} from './online/authSync'
import { liveMoveDelta, replayStartIndex } from './online/liveMoves'
import { interpClock } from './online/clockView'
import { subscribeRoom, onRealtimeConn } from './online/realtime'
import { botPersona } from './botPersonas'
import Board from './ui/Board'
import Loading from './ui/Loading'
import { useBoardDir } from './ui/boardDirection'
import { DivisionChip } from './ui/Badges'
import { useSwapStones } from './ui/pieceColors'
import Sidebar from './ui/Sidebar'
import { TavlaTvLogo, TavlaTvMark } from './ui/TavlaTvLogo'
import DiceRow, { Die } from './ui/Dice'
import Auth from './ui/Auth'
import Lobby from './ui/Lobby'
import AnalysisPanel, { type MoveError } from './ui/AnalysisPanel'
import {
  createRoom,
  joinRoom,
  matchmake,
  rematchRoom,
  cancelMatchmake,
  settleRoomConfirmed,
  saveBlunders,
  enterRoom,
  tournamentMatchRoom,
  reportTournament,
  tournamentNoShow,
  listTournaments,
  type Tournament,
  buyItem,
  selectFrame,
  selectChecker,
  claimDaily,
  ping,
  markNotificationsRead,
  deleteNotifications,
  inviteFriend,
  cancelInvite,
  requestFriendById,
  acceptFriend,
  respondInvite,
  type GameInvite as GameInviteT,
  type AppNotification,
  type TournNotice as TournNoticeT,
  showRoom,
  watchRoom,
  type RoomViewer,
  updateRoom,
  createBotRoom,
  botNudge,
  serverRoll,
  serverMove,
  serverCubeOffer,
  serverCubeRespond,
  serverResign,
  leaveRoom,
  postLive,
  type ServerMatch,
  type BotTurn,
  myActiveRooms,
  type ActiveRoom,
  sendChat,
  chatMuteFromError,
  reportRating,
  fetchUnseenAchievements,
  type UnlockedAchievement,
  resendVerification,
  ApiError as ApiErr,
  isTransientError,
  type Slot,
  type ChatMsg,
  submitGameLog,
  flushGameLogQueue,
  type GameLogTurn,
  setPresenceStatus,
  type PresenceStatus,
  type Seeker,
  listInfoPages,
} from './api'
import Chat from './ui/Chat'
import ViewersBadge from './ui/ViewersBadge'
import ClockStack from './ui/ClockStack'
import BoardPickerModal from './ui/BoardPickerModal'
import { sourceRect, destEl, flyChecker, type MoveStyle } from './ui/moveAnim'
const PositionAnalyzer = lazy(() => import('./ui/PositionAnalyzer'))
import MatAnalyzer from './ui/MatAnalyzer'
import SideMenu, { type NavItem } from './ui/SideMenu'
import Footer, { type FooterItem } from './ui/Footer'
import LobbyLayout from './ui/LobbyLayout'
import { PAGES, PAGE_BY_KEY, MENU_GROUP_ORDER, MENU_GROUP_LABELS, type MenuGroup } from './pages'
import { Icon, type IconName } from './ui/Icon'
import ConfirmModal from './ui/ConfirmModal'
import { burstConfettiAt } from './ui/confetti'
import GameMenu from './ui/GameMenu'
import Leaderboard from './ui/Leaderboard'
import RankInfo from './ui/RankInfo'
import FairnessModal from './ui/FairnessModal'
import Friends from './ui/Friends'
import Messages from './ui/Messages'
const Lessons = lazy(() => import('./ui/Lessons'))
const Tournaments = lazy(() => import('./ui/Tournaments'))
import BannerSlider from './ui/BannerSlider'
import { AdStrip } from './ui/AdStrip'
import { EntryPopupModal } from './ui/EntryPopupModal'
import { CookieConsent, OPEN_LEGAL, OPEN_COOKIE_PREFS } from './ui/CookieConsent'
import { LegalView } from './ui/LegalView'
import SoloStakes from './ui/SoloStakes'
const ErrorJournal = lazy(() => import('./ui/ErrorJournal'))
const MatchAnalytics = lazy(() => import('./ui/MatchAnalytics'))
const GamePreview = lazy(() => import('./ui/GamePreview'))
const ContentView = lazy(() => import('./ui/ContentView'))
import QuizPlay from './ui/QuizPlay'
const Clubs = lazy(() => import('./ui/Clubs'))
const Rules = lazy(() => import('./ui/Rules'))
import SeoContent from './ui/SeoContent'
import SeoAppSection from './ui/SeoAppSection'
const ServiceLanding = lazy(() => import('./ui/ServiceLanding'))
const CustomInfoPage = lazy(() => import('./ui/CustomInfoPage'))
const GuideView = lazy(() => import('./ui/GuideView'))
const TournamentRules = lazy(() => import('./ui/TournamentRules'))
const FaqView = lazy(() => import('./ui/FaqView'))
const Info = lazy(() => import('./ui/Info'))
import type { InfoTab } from './ui/Info'
// Bilgi sekmesi <-> URL slug haritasi: /bilgi/hakkinda, /bilgi/hizmetler ...
const INFO_TAB_URL: Record<InfoTab, string> = {
  about: 'hakkinda', services: 'hizmetler', glossary: 'sozluk', ranks: 'rutbeler',
  scoring: 'puanlama', badges: 'basarilarim', fair: 'adil-zar',
}
const INFO_URL_TAB: Record<string, InfoTab> = {
  hakkinda: 'about', hizmetler: 'services', sozluk: 'glossary', rutbeler: 'ranks',
  puanlama: 'scoring', basarilarim: 'badges', 'adil-zar': 'fair',
}

// Rota bazli sekme/SEO basligi. Ana sayfa (bos slug) index.html'deki varsayilana doner.
// Hukuki sayfalarin basligini LegalView (page.seo_title) yonetir -> LEGAL_SLUGS atlanir.
const DEFAULT_DOC_TITLE = 'TavlaTv - Ücretsiz Online Tavla Oyna & Bedava Tavla'
const LEGAL_SLUGS = new Set([
  'kvkk', 'gizlilik-politikasi', 'cerez-politikasi', 'kullanim-kosullari',
  'uyelik-sozlesmesi', 'sifre-sifirla',
])
const SITE_ORIGIN = 'https://www.tavlatv.com'
// Ana sayfa (bos slug) meta aciklamasi — index.html'deki description ile ayni.
const DEFAULT_DESC =
  'Ücretsiz online tavla oyna; arkadaşlarınla maç yap, yapay zekâya karşı yarış, turnuvalara katıl ve maçlarını analiz et. Kayıt gerektirmez.'
// Logo sürüm rozeti: TEK KAYNAK package.json. "3.1.0" -> "3.1" (sondaki .0 kırpılır).
// (Beta aşaması bitti: artık "BETA" öneki yok; yalnız sürüm numarası gösterilir.)
declare const __APP_VERSION__: string
const VERSION_LABEL = `BETA ${__APP_VERSION__.replace(/\.0$/, '')}`

const SEO_TITLES: Record<string, string> = {
  'online-tavla': 'Online Tavla Oyna - Ücretsiz Canlı Tavla | TavlaTv',
  'tavla-oyna': 'Tavla Oyna - Ücretsiz Bedava Tavla Oyunu | TavlaTv',
  'tavla-turnuvasi-organizasyonu': 'Tavla Turnuvası Organizasyonu | Kurumsal, Belediye, AVM | TavlaTv',
  'kurumsal-tavla-turnuvasi': 'Kurumsal Tavla Turnuvası Organizasyonu | TavlaTv',
  'belediye-tavla-turnuvasi': 'Belediye Tavla Turnuvası Organizasyonu | TavlaTv',
  'avm-tavla-turnuvasi': 'AVM Tavla Turnuvası Organizasyonu | TavlaTv',
  'iletisim': 'İletişim | TavlaTv',
  'tek-oyun': 'Tek Oyun Tavla | TavlaTv',
  'yeni-oyun': 'Online Tavla Maçı Oyna | TavlaTv',
  'yz-ile-oyna': 'Yapay Zekâya Karşı Tavla Oyna | TavlaTv',
  'arkadasinla-oyna': 'Arkadaşınla Tavla Oyna | TavlaTv',
  'online-turnuvalar': 'Online Tavla Turnuvaları | TavlaTv',
  'lider-tablosu': 'Lider Tablosu — En İyi Tavla Oyuncuları | TavlaTv',
  'uyelik': 'Üyelik ve Premium | TavlaTv',
  'magaza': 'Mağaza | TavlaTv',
  'turnuva-takvimi': 'Tavla Turnuva Takvimi | TavlaTv',
  'kulupler': 'Tavla Kulüpleri | TavlaTv',
  'haberler': 'Tavla Haberleri | TavlaTv',
  'makaleler': 'Tavla Makaleleri | TavlaTv',
  'makaleler/tavla-hamle-secme-stratejileri': 'Tavlada Hamle Seçerken Nelere Bakılır? 3 Temel Strateji | TavlaTV',
  'makaleler/tavla-nedir': 'Tavla Nedir? Oyunun Mantığı ve Temel Terimler | TavlaTV',
  'makaleler/tavla-nasil-oynanir': 'Tavla Nasıl Oynanır? Taş Dizilişi, Zar ve Toplama | TavlaTV',
  'makaleler/tavla-acilis-zarlari-31-42-61-53-65': 'Tavlada Açılış Zarları: 3–1, 4–2, 6–1, 5–3 ve 6–5 | TavlaTV',
  'makaleler/tavla-acilis-zarlari-62-63-64': 'Tavlada 6–2, 6–3 ve 6–4 Açılışları Nasıl Oynanır? | TavlaTV',
  'makaleler/ilk-tavla-turnuvasina-katilim': 'İlk Tavla Turnuvana Nasıl Katılırsın? Hazırlık Rehberi | TavlaTV',
  'makaleler/tavla-turnuvasinda-ilk-gun': 'Tavla Turnuvasında İlk Gün: Kayıttan Sonuca Adım Adım | TavlaTV',
  'makaleler/evde-tavla-oynama-rehberi': 'Evde Tavla Oynamak: Ekipman, Format ve Öğrenme Planı | TavlaTV',
  'makaleler/tavlaya-yeni-baslayanlar-rehberi': 'Tavlaya Yeni Başlayanlar İçin Öğrenme Rehberi | TavlaTV',
  'tavla-magazin': 'Tavla Magazin | TavlaTv',
  'nasil-oynanir': 'Tavla Nasıl Oynanır? Kurallar ve Rehber | TavlaTv',
  'tavla-rehberi': 'Tavla Rehberi — Stratejiler ve İpuçları | TavlaTv',
  'turnuva-kurallari': 'Tavla Turnuva Kuralları (WBF) — Resmî Kurallar | TavlaTv',
  'sikca-sorulan-sorular': 'Tavla Hakkında Sıkça Sorulan Sorular | TavlaTv',
  'tavla-rehberi/tavla-acilis-stratejileri': 'Tavla Açılış Stratejileri: En İyi İlk Hamleler | TavlaTv',
  'tavla-rehberi/tavla-kupu-doubling-cube': 'Tavla Küpü (Doubling Cube) Nedir, Nasıl Kullanılır? | TavlaTv',
  'tavla-rehberi/tavla-kazanma-taktikleri': 'Tavla Kazanma Taktikleri ve İpuçları | TavlaTv',
  'tavla-rehberi/mars-gammon-backgammon-nedir': 'Mars (Gammon) ve Backgammon Nedir? | TavlaTv',
  'pozisyon-analizi': 'Tavla Pozisyon Analizi | TavlaTv',
  'mat-analiz': 'Tavla Maç Analizi (.mat) | TavlaTv',
  'mac-analizleri': 'Maç Analizlerim | TavlaTv',
  'hata-gunlugu': 'Hata Günlüğü | TavlaTv',
  'sans-carki': 'Şans Çarkı | TavlaTv',
  'zar-slotu': 'Zar Slotu | TavlaTv',
  'bahane-makinesi': 'Tavla Bahane Makinesi | TavlaTv',
  'kiz-tavlasi': 'Kız Tavlası — Online Oyna | TavlaTv',
  'bilgi/hakkinda': 'Hakkımızda | TavlaTv',
  'bilgi/hizmetler': 'Hizmetler | TavlaTv',
  'bilgi/sozluk': 'Tavla Sözlüğü — Terimler | TavlaTv',
  'bilgi/rutbeler': 'Tavla Rütbeleri | TavlaTv',
  'bilgi/puanlama': 'Puanlama ve PR (Performans) | TavlaTv',
  'bilgi/basarilarim': 'Rozetler ve Başarımlar | TavlaTv',
  'bilgi/adil-zar': 'Adil Zar — Kanıtlanabilir Rastgelelik | TavlaTv',
}
// Rota bazli meta aciklamasi (og/twitter + <meta name=description>). Her sayfa BENZERSIZ
// aciklama alir — soft-duplicate meta sorununu (tum sayfalar ayni description) kapatir.
const SEO_DESCS: Record<string, string> = {
  'online-tavla':
    'Ücretsiz online tavla oyna! Gerçek rakiplere karşı canlı maçlar, güçlü yapay zekâ botu, turnuvalar ve maç analizi (PR). Kayıt gerektirmez, tarayıcıda hemen başla.',
  'tavla-oyna':
    'Bedava tavla oyna! Ücretsiz, kayıtsız ve tarayıcıda anında açılan tavla oyunu. Yapay zekâya karşı pratik yap, arkadaşınla veya gerçek rakiplerle online tavla oyna.',
  'tavla-turnuvasi-organizasyonu':
    'Kurumlar, belediyeler ve AVM’ler için anahtar teslim tavla turnuvası organizasyonu. Format kurgusu, hakemlik, dijital eşleşme tabloları ve ödül töreni dahil. Teklif alın.',
  'kurumsal-tavla-turnuvasi':
    'Şirketiniz için kurumsal tavla turnuvası organizasyonu: takım ruhu ve çalışan bağlılığı için anahtar teslim etkinlik. Ofiste, otelde veya hibrit online. Teklif alın.',
  'belediye-tavla-turnuvasi':
    'Belediyeler için kitlesel katılımlı tavla turnuvası organizasyonu: festival, Ramazan ve kültür etkinlikleri. Dijital kayıt, hakemlik ve ödül töreni dahil. Teklif alın.',
  'avm-tavla-turnuvasi':
    'AVM’ler için ziyaretçi çeken tavla turnuvası organizasyonu: sahne kurulumu, sponsorluk ve canlı skor ekranları. Marka etkileşimi yaratan etkinlik. Teklif alın.',
  'iletisim':
    'TavlaTV ile iletişime geçin: turnuva organizasyonu, sponsorluk, iş birliği ve sorularınız için bize yazın. En kısa sürede size dönüş yapalım.',
  'tek-oyun':
    'Tek başına tavla oyna: yapay zekâya karşı pratik yap, açılışları ve hamleleri dene. Ücretsiz ve kayıt gerektirmez.',
  'yeni-oyun':
    'Online tavla maçı kur: puanlı (rating) maçlar, farklı zaman kontrolleri ve gerçek rakiplerle canlı tavla.',
  'yz-ile-oyna':
    'Güçlü sinir ağı tavla botuna karşı oyna. Seviyeni seç, performansını (PR) ölç ve gelişimini takip et.',
  'arkadasinla-oyna':
    'Arkadaşını davet et, birlikte online tavla oyna. Özel maç ayarları, süre ve puan seçenekleriyle.',
  'online-turnuvalar':
    'Online tavla turnuvalarına katıl: eleme tabloları, ödüller ve canlı sonuçlar. Turnuvalara ücretsiz kayıt.',
  'lider-tablosu':
    'En iyi tavla oyuncularının güncel sıralaması. Rating, performans (PR) ve istatistiklerle lider tablosu.',
  'uyelik':
    'TavlaTv üyelik ve Premium avantajları: detaylı analiz, ekstra özellikler ve reklamsız deneyim.',
  'turnuva-takvimi':
    'Yaklaşan tavla turnuvalarının takvimi: tarih, yer ve düzenleyen kurum bilgileriyle etkinlik listesi.',
  'kulupler':
    'Tavla kulüplerini keşfet: kulüp profilleri, üyeler ve etkinlikler. Kendi tavla topluluğunu bul.',
  'haberler':
    'Tavla dünyasından güncel haberler, turnuva sonuçları ve duyurular. En yeni tavla haberleri TavlaTv’de.',
  'makaleler':
    'Tavla makaleleri: stratejiler, taktikler ve analiz yazıları. Tavlayı daha iyi oynamak için okuyup öğren.',
  'makaleler/tavla-hamle-secme-stratejileri': 'Tavlada kapı almak, taş kırmak ve gerideki taşları çıkarmak için hamle rehberi.',
  'makaleler/tavla-nedir': 'Tavla nedir, nasıl kazanılır ve hangi temel terimleri bilmelisiniz? Oyuna yeni başlayanlar için kısa ve anlaşılır bir giriş.',
  'makaleler/tavla-nasil-oynanir': 'Tavla kurallarını adım adım öğrenin: 15 taşın dizilişi, zarlarla hareket, taş kırma, bar ve taş toplama.',
  'makaleler/tavla-acilis-zarlari-31-42-61-53-65': 'Tavlada 3–1, 4–2, 6–1, 5–3 ve 6–5 açılış zarları nasıl oynanır? Başlangıç konumunda örnek hamleler ve nedenleri.',
  'makaleler/tavla-acilis-zarlari-62-63-64': '6–2, 6–3 ve 6–4 açılışlarında gerideki taşı çıkarma, kurucu taş getirme ve riskleri değerlendirme rehberi.',
  'makaleler/ilk-tavla-turnuvasina-katilim': 'İlk tavla turnuvasına katılmadan önce kayıt, kurallar, maç formatı ve oyun günü için pratik hazırlık listesi.',
  'makaleler/tavla-turnuvasinda-ilk-gun': 'Tavla turnuvasında kayıt, eşleşme, maç başlangıcı ve sonuç bildirimi nasıl ilerler? İlk gün için anlaşılır akış.',
  'makaleler/evde-tavla-oynama-rehberi': 'Evde tavla kurmak için gerekenler, maç formatı seçimi ve yeni başlayanların birlikte gelişmesi için öneriler.',
  'makaleler/tavlaya-yeni-baslayanlar-rehberi': 'Tavlaya sıfırdan başlamak için kurallar, ilk stratejiler, sık hatalar ve pratik çalışma sırası.',
  'tavla-magazin':
    'Tavla magazin: röportajlar, analizler ve tavla kültüründen içerikler.',
  'nasil-oynanir':
    'Tavla nasıl oynanır? Kurallar, açılış dizilimi, zar ve pul hareketleriyle yeni başlayanlar için tavla rehberi.',
  'tavla-rehberi':
    'Tavla rehberi: açılış stratejileri, küp (doubling cube) kullanımı, kazanma taktikleri, mars ve backgammon puanlaması. Oyununu geliştirecek özgün yazılar.',
  'turnuva-kurallari':
    'WBF (Dünya Tavla Federasyonu) Uluslararası Tavla Turnuva Kuralları: format, süre, zar ve küp kuralları, kural dışı hareketler ve anlaşmazlıkların çözümü. Resmî ve eksiksiz Türkçe kural metni.',
  'sikca-sorulan-sorular':
    'Tavla kuralları, katlama küpü, maç oyunu, farklı tavla türleri ve TavlaTV rating sistemi hakkında anlaşılır soru-cevaplar.',
  'tavla-rehberi/tavla-acilis-stratejileri':
    'Tavla açılış stratejileri: her zar atışı için en iyi ilk hamleler, 5-nokta ve bar-nokta yapma, blot bırakma riskleri ve yeni başlayanlar için pratik ipuçları.',
  'tavla-rehberi/tavla-kupu-doubling-cube':
    'Tavla küpü (doubling cube) nedir, nasıl kullanılır? Katlama, kabul (take) ve pas (drop) kararları, Crawford kuralı ve doğru zamanlama ile küp stratejisi rehberi.',
  'tavla-rehberi/tavla-kazanma-taktikleri':
    'Tavla kazanma taktikleri: blot bırakmama, kilit ve prime kurma, pip sayımı, yarış ve tutma oyunu ile küp kullanımı. Oyununu geliştirecek pratik ipuçları.',
  'tavla-rehberi/mars-gammon-backgammon-nedir':
    'Mars (gammon) ve backgammon nedir? Tekli, mars ve backgammon galibiyetlerinin puan değerleri, küp çarpanı ve bu büyük galibiyetleri kazanma/önleme taktikleri.',
  'pozisyon-analizi':
    'Tavla pozisyonunu analiz et: TavlaTV Motoru ve sinir ağı ile en iyi hamle, kazanma yüzdesi ve equity.',
  'mat-analiz':
    '.mat maç dosyanı yükle, motorla tam analiz al: PR, blunder, hata ve şans dökümü.',
  'sans-carki': 'Şans Çarkını çevir, ödüller kazan. TavlaTv eğlence oyunlarından Şans Çarkı.',
  'zar-slotu': 'Zar Slotu: tavla temalı slot oyunu, artan jackpot ve eğlenceli ödüller.',
  'bahane-makinesi':
    'Bahane Makinesi: tavla kaybettiğinde işine yarayacak 100 hazır bahane. Salt eğlence.',
  'kiz-tavlasi':
    'Kız Tavlası: pulları önce toplayan kazanır. Bilgisayara karşı ücretsiz oyna.',
  'bilgi/hakkinda': 'TavlaTv hakkında: misyonumuz, adil oyun ilkelerimiz ve tavla topluluğu.',
  'bilgi/hizmetler': 'TavlaTv hizmetleri: online tavla, turnuvalar, analiz araçları ve daha fazlası.',
  'bilgi/sozluk': 'Tavla sözlüğü: tavla terimleri ve anlamları — mars, gammon, backgammon, küp, pip ve daha fazlası.',
  'bilgi/rutbeler':
    'Tavla rütbeleri ve seviye sistemi: rating aralıkları ve rütbe rozetleri nasıl kazanılır.',
  'bilgi/puanlama':
    'Puanlama ve performans (PR) nasıl hesaplanır? Rating, Elo ve şans-bazlı puan açıklamaları.',
  'bilgi/basarilarim':
    'TavlaTv rozetleri ve başarımları: hangi rozet nasıl açılır, tüm başarımların listesi.',
  'bilgi/adil-zar':
    'Adil zar: kanıtlanabilir rastgelelik (CSPRNG) nasıl çalışır, test alanı ve Ki-Kare doğrulaması.',
}

// Rota bazli SEO meta: once tam slug (ör. 'bilgi/hakkinda'), sonra ilk segment (ör.
// 'haberler/<slug>' -> 'haberler') denenir; ikisi de yoksa ana sayfa varsayilanina doner.
function seoLookup(slug: string): { title: string; desc: string } {
  const base = slug.split('/')[0]
  return {
    title: SEO_TITLES[slug] || SEO_TITLES[base] || DEFAULT_DOC_TITLE,
    desc: SEO_DESCS[slug] || SEO_DESCS[base] || DEFAULT_DESC,
  }
}

// <head>'deki bir <meta> etiketini gunceller; yoksa olusturur (attr: 'name' | 'property').
function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  const sel = `meta[${attr}="${key}"]`
  let el = document.head.querySelector<HTMLMetaElement>(sel)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

// <link rel="canonical"> href'ini gunceller (yoksa olusturur).
function setCanonical(url: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', url)
}

// Hukuki sayfalar icin H1 (LegalView title'i DB'den async gelir; H1'i statik veriyoruz).
const LEGAL_H1: Record<string, string> = {
  kvkk: 'KVKK Aydınlatma Metni',
  'gizlilik-politikasi': 'Gizlilik Politikası',
  'cerez-politikasi': 'Çerez Politikası',
  'kullanim-kosullari': 'Kullanım Koşulları',
  'uyelik-sozlesmesi': 'Üyelik Sözleşmesi',
  'sifre-sifirla': 'Şifre Sıfırla',
}

// Rota basligi -> gorsel-gizli <h1> metni (SPA'da her sayfa DOM'da benzersiz H1 tasisin;
// JS render eden crawler'lar (Google) icin. JS'siz crawler'lar SeoMeta <noscript> H1'ini alir).
function seoH1(slug: string): string {
  if (!slug) return 'Online Tavla Oyna — Ücretsiz ve Bedava Tavla'
  if (LEGAL_H1[slug]) return LEGAL_H1[slug]
  const { title } = seoLookup(slug)
  // " | TavlaTv" / " - TavlaTv…" markasal son eki at.
  return title.replace(/\s*[|\-–—]\s*TavlaTv.*$/i, '').trim() || 'TavlaTv'
}

// Rota-farkindali gorsel-gizli H1: body'nin ilk cocugu olarak tutulur (React #root'a dokunmaz).
function setSeoH1(text: string): void {
  let el = document.getElementById('seo-route-h1') as HTMLHeadingElement | null
  if (!el) {
    el = document.createElement('h1')
    el.id = 'seo-route-h1'
    // Gorsel-gizli ama erisilebilir (display:none DEGIL; SR + crawler okur). clip pattern.
    el.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
      'clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0;'
    document.body.insertBefore(el, document.body.firstChild)
  }
  if (el.textContent !== text) el.textContent = text
}
import Achievements from './ui/Achievements'
import AchievementUnlock from './ui/AchievementUnlock'
import FriendGameSetup from './ui/FriendGameSetup'
import LangMenu from './ui/LangMenu'
import type { ContentType } from './api'
import Shop from './ui/Shop'
import LuckyWheel from './ui/LuckyWheel'
import DiceSlot from './ui/DiceSlot'
import ExcuseMachine from './ui/ExcuseMachine'
import KizTavlasi from './ui/KizTavlasi'
import CheckerShop from './ui/CheckerShop'
import { CHECKER_BY_ID } from './checkers'
import Products, { type CartAddLine } from './ui/Products'
import MyOrders from './ui/MyOrders'
import Cart, { type CartItem, MEMBERSHIP_ITEM_ID } from './ui/Cart'
import Checkout from './ui/Checkout'
import BankTransfer from './ui/BankTransfer'
import FrameShop from './ui/FrameShop'
import ProfileOverview from './ui/ProfileOverview'
import { AVATAR_FRAMES } from './ui/avatarFrames'
import FrameGallery from './ui/FrameGallery'
import AvatarFrame from './ui/AvatarFrame'
import PremiumCrown from './ui/PremiumCrown'
import { Flag } from './ui/Flag'
import MatchResult from './ui/MatchResult'
import { chatWarnText, chatMuteText } from './ui/chatNotice'
import ScrollTop from './ui/ScrollTop'
import MatchReport, { type LogEntry } from './ui/MatchReport'
import type { GameResultInput } from './matExport'
import { LiveMatchesPanel, OnlinePlayersPanel, SeekersPanel, RankingPanel, HomeFeatures, HomeDashboard, TournamentsPanel, CalendarPanel, NewsPanel, StatusPicker } from './ui/HomePanels'
import TopThreeShowcase from './ui/TopThreeShowcase'
import Spectate from './ui/Spectate'
import PublicProfile from './ui/PublicProfile'
import Membership from './ui/Membership'
import type { PlanId } from './plans'
import ResetPassword from './ui/ResetPassword'
import MatchSetup, { type MatchOptions, type SetupMode } from './ui/MatchSetup'
import {
  loadGame,
  clearGame,
  loadProfile,
  saveGame,
  saveProfile,
  savePendingReport,
  loadPendingReport,
  clearPendingReport,
  savePendingSettle,
  loadPendingSettle,
  clearPendingSettle,
  type Profile,
  type SavedGame,
  type MoveLogEntry,
} from './storage'
import { useT, LANGS } from './i18n'
import { useToast } from './ui/Toast'
import BugReport from './ui/BugReport'
import { Button } from '@/components/ui/button'
import {
  getToken,
  loadServerGame,
  logout as apiLogout,
  deleteAccount as apiDeleteAccount,
  me as apiMe,
  meWithRetry,
  isAuthRejected,
  saveServerGame,
  setAutoRenew as apiSetAutoRenew,
  toProfile,
  getMenuConfig,
  getShopDesigns,
  getFooterConfig,
  buyMembership,
  cartCoinOrder,
  newCommandId,
  cartCheckout,
  isBankTransfer,
  type BankTransferResult,
  type PayMethod,
  messagesUnread,
  matchPr,
  matchGnubgPr,
  matchGnubgReview,
  analyzePosition,
  type GnuMove,
  type MenuOverride,
  type MenuGroupCfg,
  type FooterColumnCfg,
  type FooterLinkCfg,
  type SponsorCfg,
  type ServerUser,
} from './api'

// Geri sayim bicimi: saniye -> "S:DD:SS"
function fmtCountdown(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Zar gorunum sirasi: varsayilan olarak buyuk zar once (ciftte/tek zarda degismez).
// Oyuncu tahtada zara tiklayarak sirayi degistirebilir (canSwapDice).
function orderDice(dice: number[]): number[] {
  if (dice.length === 2 && dice[0] < dice[1]) return [dice[1], dice[0]]
  return dice
}

// gnubg tarzi hata siniflandirmasi (equity kaybina gore) -> ceviri anahtari
function classifyError(loss: number): { key: string; cls: string } {
  if (loss < 0.02) return { key: 'err.veryGood', cls: 'good' }
  if (loss < 0.04) return { key: 'err.small', cls: 'ok' }
  if (loss < 0.08) return { key: 'err.error', cls: 'bad' }
  return { key: 'err.blunder', cls: 'blunder' }
}

function applyPlayed(base: GameState, played: Step[]): GameState {
  const s = cloneState(base)
  for (const step of played) applyStep(s, step, base.turn)
  return s
}

function freshBoard(turn: Player): GameState {
  const s = initialState()
  s.turn = turn
  return s
}

// Taze (oyun basi) tahtanin imzasi: sonraki oyunun ZATEN kurulmus olup olmadigini anlamak icin.
// Biten bir oyunun tahtasi (15 tas disarida) bu imzayi asla tutturamaz -> guvenli ayirt edici.
const START_KEY = boardKey(initialState())

// Basarim sinyali: bir pozisyonda oyuncunun kurdugu yapiyi tespit et.
//  prime6  = 6 ardisik nokta, her birinde >=2 tas ("Kapici")
//  closeout= tum ev bolgesi (6 nokta) kapali VE rakip barda tas tutuyor ("Cikabilirsen Cik")
function achBoardFeats(pos: GameState, player: Player): { prime6: boolean; closeout: boolean } {
  const pts = pos.points
  const cnt = (i: number) => (player === 'white' ? Math.max(0, pts[i]) : Math.max(0, -pts[i]))
  let prime6 = false
  for (let i = 0; i <= 18 && !prime6; i++) {
    let ok = true
    for (let k = 0; k < 6; k++) if (cnt(i + k) < 2) { ok = false; break }
    if (ok) prime6 = true
  }
  const home = player === 'white' ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23]
  const opp: Player = player === 'white' ? 'black' : 'white'
  const closeout = home.every((i) => cnt(i) >= 2) && (pos.bar?.[opp] ?? 0) > 0
  return { prime6, closeout }
}

type Mode = 'pvp' | 'pvb' | 'online'
type Difficulty = number // 1..10 AI seviyesi

// AI zorluk seviyeleri (1..10)
const AI_LEVELS = [
  'Beginner',
  'Rookie',
  'Casual',
  'Skilled',
  'Expert',
  'Master',
  'Grandmaster',
  'Elite',
  'Legend',
  'World Class', // 10: gnubg 2-ply, gürültüsüz (hızlı + çok güçlü)
  'Grandmaster', // 11: TavlaTV Grandmaster — gnubg 3-ply (birkaç saniye düşünebilir)
  'Ultimate', // 12: TavlaTV Ultimate — adaptive 3→4-ply (kritik pozisyonda daha uzun)
]
// ---- Maç kaydı (hamle+zar logu) yardımcıları ----
// Offline (pvb/pvp) maçlar için kısa, okunur maç kimliği üretir (regex [A-Za-z0-9]).
function genLocalUid(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // karışan harfler (I,O,0,1) atlandı
  const arr = new Uint8Array(7)
  ;(globalThis.crypto ?? window.crypto).getRandomValues(arr)
  let out = 'L'
  for (const b of arr) out += abc[b % abc.length]
  return out
}
// Step[] -> notasyon ("24/18 13/8" / "pas"). moveNotation yalnız .steps okur.
function turnNotation(steps: Step[], player: Player): string {
  return moveNotation({ steps, resultKey: '' }, player)
}

// Eski kayit ('neural'/'heuristic') veya sayi -> 1..12
function normDifficulty(d: unknown): number {
  if (typeof d === 'number' && d >= 1 && d <= 12) return Math.round(d)
  if (d === 'heuristic') return 3
  return 10 // 'neural' veya bilinmeyen -> World Class (varsayilan en yuksek "hizli" seviye)
}

interface RoomState {
  code: string
  slot: Slot
  oppName: string | null
  oppRating: number | null
  oppAvatar: string | null
  oppFrame: string | null
  oppCountry?: string | null // rakip ülke kodu -> isim yaninda minik bayrak
  oppPremium?: boolean // rakip premium mi -> isim yaninda PREMIUM
  oppId?: number | null // rakip user id (herkese açık profil modalı için; misafir=null)
  status: 'waiting' | 'mm_waiting' | 'playing' | 'finished'
  // Sunucu-otoriter mod (para maçı güvenliği Faz 2c). true iken istemci zar/hamleyi
  // SUNUCUDAN alır (serverRoll/serverMove). Şu an hiçbir oda için true değil (gated).
  authoritative?: boolean
  server_version?: number
  // BAĞIMSIZ Faz 1: true iken yalnız ZAR sunucudan (serverRoll); hamle/tahta/küp LEGACY kalır.
  // Bahisli (para) eşleşme odalarında açılır. authoritative'den AYRIDIR.
  dice_authority?: boolean
  // SUNUCU-OTORİTER BOT: bu oda bir bot maçı (p2 = sunucu botu). Rakip hamleleri serverRoll/
  // serverMove yanıtındaki bot[] turlarından gelir (yerel motor YOK). botLevel = HUD zorluk.
  bot?: boolean
  botLevel?: number | null
  // KLASIK TAVLA: bu oda klasik mi (küp yok + mars=2). match.classic buradan aynalanır (tek kaynak oda).
  classic?: boolean
  // CANLI hamle önizlemesi (cosmetic): sıradaki oyuncunun o an oynadığı/geri aldığı adımlar.
  live?: { slot: Slot; steps: Step[]; turn?: Player | null; seq?: number } | null
}
const BOT_PLAYER: Player = 'black'
// SUNUCU-OTORİTER BOT: true iken PvB maçı sunucuda (authoritative bot odası) oynanır — zar/tahta/
// bot hamlesi SUNUCUDA; iki sekme aynı TEK state'i izler ("aynı maç iki pencerede farklı state"
// bug'ı kapanır). false = eski yerel motor (ONNX) yolu (anında geri dönüş). DEPLOY: gnubg/validator
// ayakta olmalı; yoksa açılış "Rakip düşünüyor…"da bekler (insan hamlesi kaybolmaz).
const SERVER_BOT = true
const TARGETS = [1, 3, 5, 7, 9, 11] // mac uzunlugu secenekleri (1 = tek oyun)
const CLASSIC_TARGETS = [1, 3, 5, 7] // KLASIK TAVLA mac uzunluklari — max 7 (9/11 yok; normal + YZ)

// Board renk temalari — boardThemes.ts'e cikarildi (God-component kucultme, #10)
import {
  BOARD_THEMES,
  PREMIUM_THEMES,
  RARITY_THEMES,
  CLUB_THEMES,
  COUNTRY_THEMES,
  TAVLATV_THEMES,
  GALAXY_EXTRA_THEMES,
  ALL_THEMES,
  BOARD_ID_MIGRATE,
  hexLum,
  boardRarityOf,
  boardPrice,
  boardOnSale,
  FREE_BOARDS,
  CUSTOM_THEMES,
} from './boardThemes'
import { applyCachedShopDesigns, storeShopDesigns } from './shopDesigns'
import { NAUTICAL_FLAG_TOP_BY_DP, NAUTICAL_FLAG_BOTTOM_BY_DP } from './nauticalFlags'
// Admin Tavla/Avatar/Pul Tasarımı ayarlarının son bilinen hali (özel tahta seçili oyuncu açılışta standarda düşmesin).
applyCachedShopDesigns()

// Bot temposu (ms) - daha yuksek = daha yavas/dogal
const BOT_ROLL_DELAY = 1000 // zar atmadan once (kisa dusunme)
const BOT_MOVE_DELAY = 900 // zar atildiktan sonra ilk tas oynanmadan once (zar okunabilsin)
const BOT_STEP_DELAY = 500 // her tas arasi (izlenebilir ama snappy; sunucu-bot tur devri hizlansin)
const BOT_END_DELAY = 500 // son tastan sonra sira gecmeden once (kisa ara; ~1sn tur-devri gecikmesi cok uzundu)
const BOT_REVEAL_DELAY = 850 // bot zarini ILK hamleden once net goster (kullanici "gele attigini goremedim" -> zar okunsun)
const BOT_FINAL_DELAY = 1400 // botun MAÇI BİTİREN hamlesinden sonra: son pozisyon görünsün, sonra sonuç ekranı
const BOT_DANCE_DELAY = 1600 // bot HAMLE YOK (dance / bardan giremedi): zar + "Hamle Yok" overlay'i gorunur kalsin

interface BotAnim {
  steps: Step[]
  index: number
  // SUNUCU-OTORİTER BOT: doluysa animasyon SONUNDA commitTurn YERİNE bu otoriter durum uygulanır
  // (sunucu hamleyi zaten uyguladı; istemci yalnız tas-tas GÖSTERİR, tekrar sunucuya YOLLAMAZ).
  serverFinal?: { state: GameState; match: ServerMatch | null; version: number }
}

interface OpeningResult {
  white: number
  black: number
  winner: Player
  winnerDie: number
  loserDie: number
}

interface GameEnd {
  winner: Player
  points: number
  mult: number
  dropped: boolean
  timeout?: boolean // sure bitiminden dolayi kayip
  resigned?: boolean // pes etme/cekilme
  resignType?: ResignationType // pes türü (single/gammon/backgammon) — MAT + kayıt için
}

// Kup danismani ipucu: ya roll-oncesi teklif tavsiyesi (offer) ya da take/drop (respond)
type CubeHint =
  | {
      kind: 'offer'
      winPct: number
      gammonPct: number
      equity: number
      oppTakePct: number
      action: CubeAction
    }
  | { kind: 'respond'; take: TakeAction; winPct: number; tpPct: number }

// Oyun saati (her hamle sirasi icin, her turda sifirlanir):
//  12sn hamle suresi -> bitince 30sn geri sayim -> sonra 30sn "son asama" (30dan)
//  son asama da biterse sirasi gelen oyuncu oyunu kaybeder.
// Saat: hamle suresi (delay) + rezerv (over). Backgammon Galaxy tarzi 3 preset.
type TimeControl = 'casual' | 'normal' | 'speed'
// over = PUAN BASINA ana sure (sn); freshMatchClock bunu mac uzunluguyla carpar.
// Rahat 3dk/puan, Normal 1dk/puan, Hizli 0.4dk/puan (=24sn). Delay = hamle basina gecikme.
// NOT: online'da sunucu (App\Services\MatchClock) ayni degerlerle OTORITERdir; bu presetler
// pvb (bota karsi) icin ve online'da sunucu saati gelene kadar ilk gosterim icindir.
const CLOCK_PRESETS: Record<TimeControl, { move: number; over: number }> = {
  casual: { move: 15, over: 180 }, // Rahat: 15sn/hamle + 3dk/puan
  normal: { move: 10, over: 60 }, // Normal: 10sn/hamle + 1dk/puan
  speed: { move: 8, over: 24 }, // Hizli: 8sn/hamle + 0.4dk/puan (24sn)
}
const FINAL_STAGE = 30 // son asama uyari esigi (sn)
const MOVE_DELAY = CLOCK_PRESETS.normal.move // varsayilan/fallback
const OVER_TOTAL = CLOCK_PRESETS.normal.over

export default function App() {
  const { t, lang, setLang } = useT()
  // Rutbe esikleri (admin: Ayarlar > Rating Ayar) boot'ta sunucudan tazelenir; degisirse bu
  // abonelik agaci yeniden render eder -> rozetler/rutbeler yenilenmeyi beklemeden guncellenir.
  useSyncExternalStore(subscribeRankThresholds, rankThresholdsVersion, rankThresholdsVersion)
  // Pul renkleri takas edilince (swapStones) oyuncu motor-beyazi SIYAH, motor-siyahi BEYAZ
  // gorur. Renk ADI da tahtadaki gorunumle ayni olmali (Board.tsx ayni inversiyon) -> yoksa
  // "siyah kubu katladi" derken rakip ekranda BEYAZ gorunur. Tek kaynak: tum cagiranlar duzelir.
  const pName = (p: Player) => {
    const shown: Player = swapStones ? (p === 'white' ? 'black' : 'white') : p
    return t(shown === 'white' ? 'player.white' : 'player.black')
  }
  const [saved] = useState(() => loadGame())
  const [user, setUser] = useState<ServerUser | null>(null)
  // Sol menu override'lari (admin panelden: sira/ad/gorunurluk/grup). Anahtar -> override.
  const [menuOverrides, setMenuOverrides] = useState<Record<string, MenuOverride>>({})
  // Grup basligi override'lari (admin "Menü Grupları"). Grup anahtari -> config.
  const [menuGroupCfg, setMenuGroupCfg] = useState<Record<string, MenuGroupCfg>>({})
  // Footer kolon override'lari (admin "Footer Kolonları": sira/gorunurluk/baslik). key -> config.
  const [footerCfg, setFooterCfg] = useState<Record<string, FooterColumnCfg>>({})
  const [footerLinkCfg, setFooterLinkCfg] = useState<Record<string, FooterLinkCfg>>({})
  // Footer sponsor karuseli (admin "Sponsorlar"): logo + kisa ad.
  const [sponsors, setSponsors] = useState<SponsorCfg[]>([])
  // Admin-eklemeli ozel bilgi sayfalari (section'u olanlar): footer kolonu / sol-menu grubu
  // altina enjekte edilir. section "footer:<kolon>" | "menu:<grup>", sort = o bolum icinde konum
  // (0 = en ust). Bkz InfoPageResource::SECTION_PICKS.
  const [cmsPages, setCmsPages] = useState<{ slug: string; title: string; section: string; sort: number }[]>([])
  const [guestProfile, setGuestProfile] = useState<Profile | null>(() => loadProfile())
  const [authChecked, setAuthChecked] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [profileEditMode, setProfileEditMode] = useState(false) // Profil: false=genel bakis, true=duzenleme formu
  // Profil genel-bakis aktif sekmesi — URL'e yansir (kisisel yer-imi/link: /profil/avatarlar vb.)
  const [profileTab, setProfileTab] = useState<'stats' | 'frames' | 'boards' | 'checkers' | 'badges' | 'addresses'>('stats')
  const [showAuth, setShowAuth] = useState(false) // giris/kayit modali acik mi
  const [authForgot, setAuthForgot] = useState(false) // Auth "sifremi unuttum" modu -> /sifremi-unuttum
  // Sifre sifirlama: link'ten ?action=reset&token=&email= geldiyse
  const [resetInfo, setResetInfo] = useState<{ email: string; token: string } | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      // Temiz yol (/sifre-sifirla) VEYA eski link (?action=reset) — ikisi de token+email ister.
      const onResetPath = window.location.pathname.replace(/\/+$/, '') === '/sifre-sifirla'
      if ((p.get('action') === 'reset' || onResetPath) && p.get('token') && p.get('email')) {
        return { email: p.get('email') as string, token: p.get('token') as string }
      }
    } catch {
      /* yok */
    }
    return null
  })
  // E-posta dogrulama sonucu: link'ten ?verified=1/0 geldiyse bildirim goster
  const [verifyNotice] = useState<'ok' | 'fail' | null>(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('verified')
      if (v === '1') return 'ok'
      if (v === '0') return 'fail'
    } catch {
      /* yok */
    }
    return null
  })
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  // Profil hep dolu: giris yoksa varsayilan misafir (Auth artik modal, tam ekran gate degil)
  const guestDefault: Profile = {
    firstName: '',
    lastName: '',
    country: '',
    nickname: t('auth.guestNick'),
    email: '',
  }
  const profile: Profile = user ? toProfile(user) : (guestProfile ?? guestDefault)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      // Mediterranean Club: ESAS tema LIGHT (warm ivory + mediterranean blue).
      // Kullanici koyu varyanti sectiyse ('dark') ona saygi goster.
      return localStorage.getItem('tavla.theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  // Sunucudan tahta tasarımları gelince (özel tahta/grup/fiyat) tema + mağaza listesi yeniden hesaplansın.
  const [boardDesignsRev, setBoardDesignsRev] = useState(0)
  const [boardTheme, setBoardTheme] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('tavla.board')
      // Rebrand migration: eski varsayilan tahtalari (blue/walnut) bir kez TavlaTv'ye tasi.
      // NOT: bos (yeni kullanici) ARTIK burada yakalanmaz -> asagida 'standart' varsayilanina duser.
      if (!localStorage.getItem('tavla.board.rebrand')) {
        localStorage.setItem('tavla.board.rebrand', '1')
        if (stored === 'blue' || stored === 'walnut') {
          localStorage.setItem('tavla.board', 'tavla')
          return 'tavla'
        }
      }
      // v2 migration: yalniz eski varsayilan 'tavla' secmis kullaniciyi Galaxy'ye tasi.
      // Bilincli baska tema (neptune vb.) veya yeni kullanici (bos) dokunulmaz.
      if (!localStorage.getItem('tavla.board.v2galaxy')) {
        localStorage.setItem('tavla.board.v2galaxy', '1')
        if (stored === 'tavla') {
          localStorage.setItem('tavla.board', 'galaxy')
          return 'galaxy'
        }
      }
      // Yeni uye / hic secim yapmamis -> marka renkli 'Standart' board varsayilan gelir.
      // Mevcut secim (galaxy dahil) korunur.
      if (!stored) {
        localStorage.setItem('tavla.board', 'standart')
        return 'standart'
      }
      return stored
    } catch {
      return 'standart'
    }
  })
  const [mode, setMode] = useState<Mode>(saved?.mode ?? 'pvb')
  const [difficulty, setDifficulty] = useState<Difficulty>(normDifficulty(saved?.difficulty))
  const [match, setMatch] = useState<MatchState>(() => saved?.match ?? newMatch(1))
  const [starter, setStarter] = useState<Player>(saved?.starter ?? 'white')
  const [turnStart, setTurnStart] = useState<GameState>(() => saved?.turnStart ?? freshBoard('white'))
  const [played, setPlayed] = useState<Step[]>(saved?.played ?? [])
  // CANLI rakip önizlemesi (cosmetic): rakibin o an oynadığı adımlar; ekranda adım adım gösterilir.
  const [oppLive, setOppLive] = useState<Step[]>([])
  const oppLiveShownRef = useRef<Step[]>([]) // ekranda gösterilen rakip adımları (delta hesabı)
  const pendingOppFlightRef = useRef<{ to: number | 'off'; srcRect: DOMRect; offColor?: Player } | null>(null)
  const liveSentRef = useRef<string>('') // gönderilen son canlı-önizleme imzası (spam/echo önleme)
  const [selectedFrom, setSelectedFrom] = useState<number | 'bar' | null>(null)
  const [cubePending, setCubePending] = useState<Player | null>(null) // teklif eden
  // RAKİP ZAR GÖSTERGESİ: rakibin attığı zar, tahtanın ORTASINDA normal zar gibi gösterilir.
  // oppRoll sunucu lastMove'undan (rakibin tamamladığı son hamlenin zarı) türetilir; sıra bana
  // geçtiği andan BEN KENDİ ZARIMI ATANA KADAR solda SABİT durur (otomatik kaybolma YOK).
  // KÖK FIX ("rakibin zarı gözükmüyor"): zar-atma ve hamle AYRI sunucu sürümleridir; istemci poll/
  // push'ta yalnız EN SON sürümü uygular -> rakip hızlı oynar/çift atarsa zar-sürümü atlanır VEYA
  // commit (sıra=ben, zar=boş) zarı animasyon bitmeden ezer. lastMove coalescing'den SAĞ KALIR;
  // sabit tutunca (timer yok) + render !diceRolled kapısı (zarımı atınca kalkar) -> zar kaçmaz.
  const [oppRoll, setOppRoll] = useState<{ dice: number[]; at: number } | null>(null)
  const lastOppRollVRef = useRef<number>(-1) // son gösterilen lastMove.v (mükerrer tetik engeli)
  // §5.2 ONAYLI RAKİP HAMLESİ REPLAY: rakip hamlesini onaylayınca (otoriter durum gelince) tahta
  // SON konuma sıçrıyordu ("bir anda tamamlanmış geldi"). Bu, hamleyi otoriter delta'dan (reconstruct)
  // adım adım OYNATIR — COSMETIC: `turnStart`/skor/saat zaten otoriter ilerler, bu yalnız GÖSTERİM.
  // Canlı önizleme (room.live) zaten oynattıysa atlanır (çift yok); bot/sonuç-ekranı hariç. Her koşulda
  // güvenlik zamanlayıcısıyla temizlenir (takılma engeli); yeni otoriter durum gelince anında biter.
  const [oppReplay, setOppReplay] = useState<{ base: GameState; steps: Step[]; shown: number; color: Player } | null>(null)
  const oppReplayRef = useRef<typeof oppReplay>(null)
  const oppReplayTimersRef = useRef<number[]>([])
  useEffect(() => {
    oppReplayRef.current = oppReplay
  }, [oppReplay])
  const [matchCodeCopied, setMatchCodeCopied] = useState(false) // oyun-içi maç ID kopyalandı geri bildirimi
  // Kup danismani (insan icin): roll-oncesi teklif tavsiyesi veya take/drop tavsiyesi
  const [cubeHint, setCubeHint] = useState<CubeHint | null>(null)
  const cubeHintRef = useRef<CubeHint | null>(null) // karar aninda loglamak icin
  const cubeBusyRef = useRef(false) // take/drop ucusta-guard: cift-gonderim -> 409 (pending yok) engeli
  const [gameEnd, setGameEnd] = useState<GameEnd | null>(saved?.gameEnd ?? null)
  const [botAnim, setBotAnim] = useState<BotAnim | null>(null) // bot tas-tas oynatma
  const [botDance, setBotDance] = useState(false) // bot "hamle yok" -> popup 2sn gorunur, sonra gecer
  const [turnsPlayed, setTurnsPlayed] = useState(saved?.turnsPlayed ?? 0) // ilk elde kup yok
  const [opening, setOpening] = useState<'roll' | 'reveal' | null>(saved ? null : 'roll')
  const [openingResult, setOpeningResult] = useState<OpeningResult | null>(null)
  // Online oda
  const [room, setRoom] = useState<RoomState | null>(null)
  const [roomBusy, setRoomBusy] = useState(false)
  const [roomError, setRoomError] = useState('')
  const [oppStarted, setOppStarted] = useState(false) // p2: ilk snapshot geldi mi
  const [chat, setChat] = useState<ChatMsg[]>([]) // online sohbet mesajlari
  const [chatNotice, setChatNotice] = useState<string | null>(null) // küfür uyarısı/konuşma yasağı (kırmızı)
  const [roomViewers, setRoomViewers] = useState<RoomViewer[]>([]) // maçı izleyenler (oyuncular da görsün)
  const [viewerCount, setViewerCount] = useState(0)
  const [showPip, setShowPip] = useState(true) // pip sayilari gorunur mu
  const [showLivePr, setShowLivePr] = useState(true) // canli PR (yalniz pvb) menuden ac/kapa
  // Pul renkleri (oyuncu siyah/beyaz) — kalıcı + profil<->oyun senkron (boardDir gibi).
  // Ayar PROFİLDEN yapılır; burada yalnız okunur (Board'a geçilir).
  const [swapStones] = useSwapStones()
  const [setup, setSetup] = useState<null | SetupMode>(null) // mac kurulum modali (baslangic modu)
  const [classicSetup, setClassicSetup] = useState(false) // KLASIK TAVLA kurulum ekrani mi (kup yok + mars=2)
  const [onlineTavlaOpen, setOnlineTavlaOpen] = useState(false) // SEO landing: /online-tavla
  const [tavlaOynaOpen, setTavlaOynaOpen] = useState(false) // SEO landing: /tavla-oyna
  // Turnuva organizasyonu SEO servis sayfalari + /iletisim (slug tutar): hub + kurumsal/
  // belediye/avm + iletisim. Tek state -> hepsi ServiceLanding ile render edilir.
  const [servicePage, setServicePage] = useState<string | null>(null)
  // Admin-eklemeli OZEL bilgi sayfasi: /bilgi/<slug> (sabit sekme DISI) -> CustomInfoPage.
  const [customInfoSlug, setCustomInfoSlug] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false) // Tavla Rehberi blog: /tavla-rehberi
  const [guideSlug, setGuideSlug] = useState<string | null>(null) // /tavla-rehberi/<slug> -> yazı
  const [tournRulesOpen, setTournRulesOpen] = useState(false) // WBF turnuva kuralları: /turnuva-kurallari
  const [faqOpen, setFaqOpen] = useState(false) // Sıkça Sorulan Sorular: /sikca-sorulan-sorular
  const [resignOpen, setResignOpen] = useState(false) // pes et menusu acik mi
  const [boardPickerOpen, setBoardPickerOpen] = useState(false) // kurulumda hizli tahta secim modali
  const [shopTab, setShopTab] = useState<string>('coin') // Magaza secili sekme: 'coin' (paketler) | kategori-slug (URL-otoriter)
  const [shopProduct, setShopProduct] = useState<string | null>(null) // Magaza secili urun slug'i -> /magaza/<kat>/<slug>
  const [analyzerOpen, setAnalyzerOpen] = useState(false) // pozisyon analiz modulu
  const [matAnalyzerOpen, setMatAnalyzerOpen] = useState(false) // Mat Analiz: .mat yukle + gnubg tam analiz
  const [leaderboardOpen, setLeaderboardOpen] = useState(false) // liderlik tablosu modali
  const [ranksOpen, setRanksOpen] = useState(false) // "Rutbeler" (RankProgression) modali
  const [infoOpen, setInfoOpen] = useState(false) // "Bilgi" sayfasi
  const [legalSlug, setLegalSlug] = useState<string | null>(null) // hukuki sayfa (KVKK/gizlilik/...)
  const [infoTab, setInfoTab] = useState<InfoTab>('about') // aktif Bilgi sekmesi (URL'e bagli)
  const [achOpen, setAchOpen] = useState(false) // Basarimlar (rozet galerisi)
  const [friendSetupOpen, setFriendSetupOpen] = useState(false) // "Ozel Oyun Olustur" (arkadasinla oyna)
  const [friendClassic, setFriendClassic] = useState(false) // KLASIK TAVLA arkadas kurulumu (klasik varsayilan ON)
  const [achUnlocked, setAchUnlocked] = useState<UnlockedAchievement[]>([]) // mac sonu unlock kuyrugu
  // RAKİP ZAR GÖSTERGESİ: OTO-KAYBOLMA KALDIRILDI (kök fix). Eskiden 3.5sn sonra setOppRoll(null)
  // yapılıyordu; yavaş düşünen/çift atan rakipte zar daha sen bakmadan kaybolup "göremedim" oluyordu.
  // Artık kendi zarımı atana kadar durur (render !diceRolled); temizlik resetRoomSync + yeni-oyunda.
  // Giris/acilista: turnuva/backfill gibi mac-disi kanallardan gelen GORULMEMIS unlock'lari
  // kuyruga al (bir kez animasyon; backend cagride notified=true isaretler).
  useEffect(() => {
    if (!user) return
    let alive = true
    fetchUnseenAchievements()
      .then((r) => {
        if (alive && r.items.length) setAchUnlocked((q) => (q.length ? q : r.items))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  const [fairOpen, setFairOpen] = useState(false) // adil zar modali
  const [friendsOpen, setFriendsOpen] = useState(false) // arkadaslar modali
  const [messagesOpen, setMessagesOpen] = useState(false) // ozel mesajlar (DM) modali
  const [messagesFocusId, setMessagesFocusId] = useState<number | null>(null) // acilirken odaklanilacak arkadas
  const [dmUnread, setDmUnread] = useState(0) // okunmamis ozel mesaj sayisi (menu rozeti)
  const [lessonsOpen, setLessonsOpen] = useState(false) // dersler modali
  const [tournOpen, setTournOpen] = useState(false) // turnuvalar modali
  const [tournDetailId, setTournDetailId] = useState<number | null>(null) // acik turnuva detayi (fetch id)
  const [tournDetailSlug, setTournDetailSlug] = useState<string | null>(null) // SEO URL slug (/online-turnuvalar/isim-{id})
  const [soloOpen, setSoloOpen] = useState(false) // Tek Oyun bahis gridi
  const [productsOpen, setProductsOpen] = useState(false) // fiziksel urun magazasi (/urunler)
  const [myOrdersOpen, setMyOrdersOpen] = useState(false) // siparislerim (/siparislerim)
  const [blunderOpen, setBlunderOpen] = useState(false) // hata gunlugu
  const [matchHistOpen, setMatchHistOpen] = useState(false) // mac analizleri (gecmis maclar)
  const [matchHistInitialId, setMatchHistInitialId] = useState<number | null>(null) // acilista otomatik acilacak mac
  const [frameAnimOpen, setFrameAnimOpen] = useState(false) // Animasyon secim demosu (/cerceve-anim)
  const [gamePreviewOpen, setGamePreviewOpen] = useState(false) // oyun ekrani layout onizleme
  const [contentView, setContentView] = useState<ContentType | null>(null) // acik icerik sayfasi
  const [newsSlug, setNewsSlug] = useState<string | null>(null) // acik haber detayi (slug) - /haberler/<slug>
  const [quizOpen, setQuizOpen] = useState(false) // quiz oynanis
  const [clubsOpen, setClubsOpen] = useState(false) // kulupler + lig
  const [rulesOpen, setRulesOpen] = useState(false) // nasil oynanir rehberi
  const [spectate, setSpectate] = useState<{ code: string; p1: string; p2: string } | null>(null)
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]) // devam eden online maclarim
  const [homeProfileId, setHomeProfileId] = useState<number | null>(null) // lobi siralamasindan profil
  const [memOpen, setMemOpen] = useState(false) // uyelik yukseltme modali
  const stakeRef = useRef(0) // aktif bahisli online oyunun tutari (0 = bahissiz); coklu secimde anlasilan
  const stakesRef = useRef<number[] | null>(null) // Tek Oyun: kabul edilen coklu bahis (null = tek/Mac Oyunu)
  // Arkadaslik (davet kodu) maci mi? true -> NE puan NE coin (dostluk). Davet=friendly,
  // eslesme havuzu/solo=ranked. Mac-sonu raporu + coin settle bunu okur.
  const friendlyRef = useRef(false)
  const minRatingRef = useRef(0) // Mac Oyunu: rakip min puan filtresi
  const betPctRef = useRef(0) // Mac Oyunu: bahis = bakiyenin %'si (0 = pct bahis yok)
  const potRef = useRef(0) // oynanan gercek pot (yuzde maçta min snapshot, sabitte = stake); sunucudan gelir
  const mmOriginRef = useRef<'match' | 'solo' | 'klassik'>('match') // eslesme hangi kurulumdan basladi (iptalde geri don)
  // POOL arama (mm_waiting): "Rakip aranıyor" VS kartını GÖSTERME; ana sayfaya dön, kullanıcı
  // kendini "Oyun Arayanlar"da "Rakip Bekleniyor" + İptal ile görür. true iken poll eşleşmeyi
  // (status 'playing') yakalayınca auto-enter effect'i oyuna sokar.
  const awaitingMatchRef = useRef(false)
  const [shopOpen, setShopOpen] = useState(false) // magaza modali
  const [luckyWheelOpen, setLuckyWheelOpen] = useState(false) // Şans Çarkı modali
  const [diceSlotOpen, setDiceSlotOpen] = useState(false) // Zar Slotu modali
  const [excusesOpen, setExcusesOpen] = useState(false) // Bahane Makinesi modali (salt eğlence)
  const [kizOpen, setKizOpen] = useState(false) // Kız Tavlası oyun sayfasi (ayri kural motoru)
  const [checkerShopOpen, setCheckerShopOpen] = useState(false) // Pul Tasarimlari (checker) sayfasi
  const [cartOpen, setCartOpen] = useState(false) // sepet (coin paketleri) modali
  // Uygulama-ici odeme sayfasi (kredi karti). buyCoins'ten donen imzali submitUrl + tutar.
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutData, setCheckoutData] = useState<{
    submitUrl: string
    amount: number
    coins: number
    items: CartItem[]
    demo?: boolean
  } | null>(null)
  // Havale/EFT talimat ekranı (kart yerine). cartCheckout/buyMembership havale dönerse dolar.
  const [bankData, setBankData] = useState<BankTransferResult | null>(null)
  // Sepet: coin paketleri. localStorage'da tutulur (yenilemede/odeme donusunde korunur).
  // A-30: coin sipariş idempotency anahtarı AYNI sepet+adres için yeniden denemelerde KORUNUR
  // (eskiden her denemede yeni anahtar -> yanıtı kaybolan başarılı istek tekrarında çift düşüm).
  const coinOrderKeyRef = useRef<{ sig: string; key: string } | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem('cart')
      return raw ? (JSON.parse(raw) as CartItem[]) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cartItems))
    } catch {
      /* yoksay */
    }
  }, [cartItems])
  // Ürün -> ortak sepete ekle. Aynı ürün+renk+ödeme tek satır (adet birleşir). Üyelik ögesi
  // varsa çıkar (üyelik sepeti tek başına). Satır kimliği: p:<id>:<renk>:<ödeme>.
  const addProductToCart = (line: CartAddLine) => {
    const id = `p:${line.productId}:${line.color ?? ''}:${line.payment}`
    setCartItems((prev) => {
      const base = prev.filter((c) => c.kind !== 'membership')
      const ex = base.find((c) => c.id === id)
      if (ex) return base.map((c) => (c.id === id ? { ...c, qty: Math.min(10, c.qty + line.qty) } : c))
      return [
        ...base,
        {
          id,
          qty: line.qty,
          kind: 'product',
          product: {
            id: line.productId,
            name: line.name,
            image: line.image,
            color: line.color,
            payment: line.payment,
            coinPrice: line.coinPrice,
            moneyPrice: line.moneyPrice,
          },
        },
      ]
    })
    notify.success(t('products.addedToCart'))
  }
  const cartCount = cartItems.reduce((s, c) => s + c.qty, 0) // üst bar sepet rozeti + Mağaza
  const [frameGalleryOpen, setFrameGalleryOpen] = useState(false) // avatar cerceve galerisi

  // --- URL yonlendirme (hash tabanli) ---
  // Acik sayfa URL'de gorunur; tarayici geri/ileri tuslari ve dogrudan link/yer imi calisir.
  // NOT: Hook'lar erken return'lerden ONCE, tum sayfa state'leri tanimlandiktan sonra durmali.
  const initialPathRef = useRef(window.location.pathname.replace(/^\/+|\/+$/g, ''))
  const initialPathHydratedRef = useRef(false)
  const currentSlug = legalSlug // hukuki sayfa (slug == URL: kvkk, gizlilik-politikasi, ...)
    ? legalSlug
    : showAuth
    ? authForgot
      ? 'sifremi-unuttum'
      : 'giris'
    : memOpen
    ? 'uyelik'
    : editProfile
    ? profileEditMode
      ? 'profil/duzenle'
      : profileTab === 'frames'
        ? 'profil/avatarlar'
        : profileTab === 'boards'
          ? 'profil/tahtalar'
          : profileTab === 'badges'
            ? 'profil/basarilar'
            : profileTab === 'checkers'
              ? 'profil/pul-tasarimlari'
            : profileTab === 'addresses'
                ? 'profil/adreslerim'
                : 'profil'
    : customInfoSlug
    ? 'bilgi/' + customInfoSlug
    : infoOpen
    ? 'bilgi/' + INFO_TAB_URL[infoTab]
    : leaderboardOpen
    ? 'lider-tablosu'
    : ranksOpen
    ? 'rutbeler'
    : tournOpen
      ? tournDetailId != null
        ? 'online-turnuvalar/' + (tournDetailSlug || tournDetailId)
        : 'online-turnuvalar'
      : bankData
        ? 'havale' // Havale/EFT talimati; dogrudan URL/yenileme -> siparislere duser (referans orada)
      : checkoutOpen
        ? 'sepet' // odeme adimi URL'de /sepet gosterir: yenileme/geri guvenle sepete doner
      : cartOpen
        ? 'sepet'
      : shopOpen
        ? shopTab && shopTab !== 'coin' && shopTab !== 'coins'
          ? 'magaza/' + shopTab + (shopProduct ? '/' + shopProduct : '') // kategori / urun detay sayfasi
          : 'magaza' // coin (varsayilan) sayfasi
      : productsOpen
        ? 'urunler'
      : myOrdersOpen
        ? 'siparislerim'
      : luckyWheelOpen
        ? 'sans-carki'
        : diceSlotOpen
          ? 'zar-slotu'
        : excusesOpen
          ? 'bahane-makinesi'
        : kizOpen
          ? 'kiz-tavlasi'
        : checkerShopOpen
          ? 'pul-tasarimlari'
        : frameGalleryOpen
          ? 'cerceveler'
          : friendsOpen
            ? 'arkadaslar'
            : messagesOpen
              ? 'mesajlar'
            : blunderOpen
              ? 'hata-gunlugu'
              : matchHistOpen
                ? matchHistInitialId != null
                  ? 'mac-analizleri/' + matchHistInitialId
                  : 'mac-analizleri'
              : frameAnimOpen
                ? 'cerceve-anim'
              : gamePreviewOpen
                ? 'oyun-onizleme'
              : fairOpen
                ? 'adillik'
                : lessonsOpen
                  ? 'dersler'
                  : soloOpen
                    ? 'tek-oyun'
                    : contentView === 'event'
                      ? 'turnuva-takvimi'
                      : contentView === 'service'
                        ? 'hizmetler'
                        : contentView === 'blog'
                          ? 'blog'
                          : contentView === 'news'
                            ? newsSlug
                              ? 'haberler/' + newsSlug
                              : 'haberler'
                          : contentView === 'makale'
                            ? newsSlug
                              ? 'makaleler/' + newsSlug
                              : 'makaleler'
                          : contentView === 'magazine'
                            ? 'tavla-magazin'
                            : contentView === 'club'
                              ? 'kulup-rehberi'
                              : quizOpen
                                ? 'bulmaca'
                                : clubsOpen
                                  ? 'kulupler'
                                  : rulesOpen
                                    ? 'nasil-oynanir'
                                    : analyzerOpen
                                      ? 'pozisyon-analizi'
                                      : matAnalyzerOpen
                                        ? 'mat-analiz'
                                      : achOpen
                                        ? 'basarimlar'
                                      : friendSetupOpen
                                        ? (friendClassic ? 'klasik-arkadasinla-oyna' : 'arkadasinla-oyna')
                                      : servicePage
                                        ? servicePage
                                      : onlineTavlaOpen
                                        ? 'online-tavla'
                                      : tavlaOynaOpen
                                        ? 'tavla-oyna'
                                      : guideOpen
                                        ? (guideSlug ? 'tavla-rehberi/' + guideSlug : 'tavla-rehberi')
                                      : tournRulesOpen
                                        ? 'turnuva-kurallari'
                                      : faqOpen
                                        ? 'sikca-sorulan-sorular'
                                      : setup === 'online'
                                        ? 'yeni-oyun'
                                      : setup === 'pvb'
                                        ? (classicSetup ? 'klasik-yapay-zeka' : 'yz-ile-oyna')
                                      : spectate
                                        ? 'izle/' + spectate.code
                                        : ''

  // PREMIUM-only araclar: URL/deep-link VEYA profil-tiklamasi ile giren premium OLMAYAN
  // kullaniciyi (misafir dahil) uyelik ekranina yonlendir (menu zaten gate'li; bu, o
  // yollarin bypass'ini kapatir). Kapsam: Hata Gunlugu, Pozisyon Analizi, Mat Analiz,
  // Mac Analizleri. (Online Turnuvalar artik herkese acik; katilim turnuva basina premium_only.)
  // NOT: bu hook ust hook bolgesinde (erken-return'lerden ONCE) durmali — sabit sira;
  // premium'u user'dan inline turetir ki gec tanimlanan `premium` const'una baglanmasin.
  useEffect(() => {
    // KRITIK (refresh yonlendirme bug'i): auth HENUZ cozulmeden (apiMe donmeden) `user` null'dir;
    // bu asamada premium'u "false" sayip deep-link'le acilan araci kapatmak PREMIUM uyeyi bile
    // /uyelik'e atardi. authChecked olana kadar BEKLE -> premium bilinince dogru karar verilir.
    if (!authChecked) return
    const isPrem = user?.plan_active === 'star'
    if (isPrem) return
    let redirect = false
    if (blunderOpen) { setBlunderOpen(false); redirect = true }
    if (analyzerOpen) { setAnalyzerOpen(false); redirect = true }
    if (matAnalyzerOpen) { setMatAnalyzerOpen(false); redirect = true }
    if (matchHistOpen) { setMatchHistOpen(false); redirect = true }
    if (redirect) setMemOpen(true)
  }, [authChecked, blunderOpen, analyzerOpen, matAnalyzerOpen, matchHistOpen, user])

  // Sol menu yapilandirmasini (admin panelden sira/ad/gorunurluk) acilista bir kez cek.
  useEffect(() => {
    let alive = true
    getMenuConfig().then(({ items, groups }) => {
      if (!alive) return
      setMenuOverrides(Object.fromEntries(items.map((it) => [it.key, it])))
      setMenuGroupCfg(Object.fromEntries(groups.map((g) => [g.key, g])))
    })
    // Tavla/Avatar/Pul Tasarımı (admin): özel tahtalar + grup/fiyat/satış ayarları. Hata -> önbellek/yerleşik.
    getShopDesigns().then((d) => {
      if (!alive || !d) return
      storeShopDesigns(d)
      setBoardDesignsRev((n) => n + 1)
    })
    // Footer kolon yapilandirmasi (admin panel): sira/gorunurluk/baslik. Hata/bos -> sabit sira.
    getFooterConfig().then(({ columns, links, sponsors }) => {
      if (!alive) return
      setFooterCfg(Object.fromEntries(columns.map((c) => [c.key, c])))
      setFooterLinkCfg(Object.fromEntries(links.map((l) => [l.key, l])))
      setSponsors(sponsors)
    })
    // Admin-eklemeli ozel sayfalardan section'u olanlar -> footer/menu'ye enjekte edilir.
    listInfoPages()
      .then((ps) => {
        if (alive) setCmsPages(ps.filter((p) => p.section).map((p) => ({ slug: p.slug, title: p.title, section: p.section!, sort: p.sort ?? 0 })))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // DAYANIKLILIK: önceki maçta ağ hatasıyla başarısız olan reportRating/settle'ı açılışta ve
  // yeniden-bağlanınca tekrar dene. Backend idempotent (oda+kullanıcı tek satır; settle atomik)
  // -> çift-sayma yok. Düşen istemcinin rating + analiz satırı + coin'i kaybolmaz (ekran görüntüsü
  // bug'ı: bir taraf "bağlantı hatası" alıp maç analizinde görünmüyordu). Yalnız user hazırken.
  useEffect(() => {
    if (!user) return
    let alive = true
    const flush = async () => {
      const pr = loadPendingReport()
      if (pr) {
        try {
          const rr = await reportRating(...(pr.args as Parameters<typeof reportRating>))
          if (alive) setUser((u) => (u ? { ...u, rating: rr.rating } : u))
          clearPendingReport()
        } catch (error) {
          // verified-match-required kalıcı bir 409'dur: oda artık doğrulanabilir
          // değilse eski pending raporu her sayfa açılışında tekrar gönderilmesin.
          if (error instanceof ApiErr && error.status === 409) {
            clearPendingReport()
          }
        }
      }
      const ps = loadPendingSettle()
      if (ps) {
        try {
          const sr = await settleRoomConfirmed(ps.code, ps.won)
          if (sr.ok || !sr.pending) {
            if (alive && typeof sr.coins === 'number') setUser((u) => (u ? { ...u, coins: sr.coins } : u))
            clearPendingSettle()
          }
        } catch {
          /* sonra */
        }
      }
    }
    flush()
    const onOnline = () => flush()
    window.addEventListener('online', onOnline)
    return () => {
      alive = false
      window.removeEventListener('online', onOnline)
    }
  // BİLEREK yalnız user?.id: user nesnesi her profil/coin yenilemesinde değişir; dep olursa flush
  // her seferinde yeniden koşar (gereksiz retry istekleri). Kimlik değişince bir kez yeterli.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // stabil kimlik -> döngü yok (bkz heartbeat-ping-kacak-dongu)

  // Çerez banner'ı / hukuki sayfalar: "tavla:open-legal" olayı -> hukuki sayfayı aç
  // (App'e state eklemeden footer/banner bağlantılarından tetiklenir).
  useEffect(() => {
    const onOpenLegal = (e: Event) => {
      const slug = (e as CustomEvent<{ slug?: string }>).detail?.slug
      if (slug) setLegalSlug(slug)
    }
    window.addEventListener(OPEN_LEGAL, onOpenLegal)
    return () => window.removeEventListener(OPEN_LEGAL, onOpenLegal)
  }, [])

  // popstate closure'i icin GUNCEL "aktif oyun var mi" (hasActiveGame render-sonrasi
  // hesaplaniyor; ref ile son degeri applyFromPath'e tasiyoruz).
  const hasActiveGameRef = useRef(false)

  // URL yolu -> state: dogrudan link, yer imi, geri/ileri tusu (closeAllPages hoisted)
  // Temiz path kullanilir (SEO): /yz-ile-oyna  (hash # yok; eski /yapay-zeka alias)
  useEffect(() => {
    const applyFromPath = () => {
      const slug = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, '')).trim()
      const seg = slug.split('/')
      const root = seg[0] // ilk segment (ör. 'haberler/<slug>' -> 'haberler')
      closeAllPages()
      setAnalyzerOpen(false)
      setMemOpen(false)
      // URL navigasyonu (geri/ileri/link) HER ZAMAN lobi baglamidir — oyunun kendi URL
      // slug'i YOK. Aktif oyun yoksa bayat online/oyun state'ini temizle ki GERI tusunda
      // ekrana eski/bitmis board gelmesin (kullanici sikayeti). setHome(true) -> sayfa
      // home dalinda (sol menu + logo) acilir. (Aktif oyun varsa dokunma: resume korunur.)
      if (!hasActiveGameRef.current) {
        setMode('pvb')
        setRoom(null)
      }
      setHome(true)
      switch (root) {
        case 'lider-tablosu':
          setLeaderboardOpen(true)
          break
        case 'rutbeler':
          setRanksOpen(true)
          break
        case 'bilgi': {
          // /bilgi/<slug>: bilinen sekme -> Info modali; katalog disi slug -> OZEL sayfa.
          const sub = seg.slice(1).join('/')
          if (sub && !INFO_URL_TAB[seg[1] ?? '']) {
            setCustomInfoSlug(sub)
          } else {
            setInfoTab(INFO_URL_TAB[seg[1] ?? ''] ?? 'about')
            setInfoOpen(true)
          }
          break
        }
        case 'online-turnuvalar':
        case 'turnuvalar': { // eski slug -> geriye donuk uyum
          setTournOpen(true)
          // /online-turnuvalar/{isim-slug}-{id} veya eski /online-turnuvalar/{id}: son '-' parcasi id
          const s1 = seg[1] || ''
          const last = s1.split('-').pop() || ''
          const tid = /^\d+$/.test(last) ? parseInt(last, 10) : null
          setTournDetailId(tid)
          setTournDetailSlug(tid != null ? s1 : null)
          break
        }
        case 'magaza': {
          // /magaza -> coin; /magaza/<kategori> -> o kategori; /magaza/<kategori>/<urun> -> urun detay
          const sub = seg[1] || ''
          const isCoin = !sub || sub === 'coin' || sub === 'coins'
          setShopTab(isCoin ? 'coin' : sub)
          setShopProduct(isCoin ? null : seg[2] || null)
          setShopOpen(true)
          break
        }
        case 'sans-carki':
          setLuckyWheelOpen(true)
          break
        case 'zar-slotu':
          setDiceSlotOpen(true)
          break
        case 'bahane-makinesi':
          setExcusesOpen(true)
          break
        case 'kiz-tavlasi':
          setKizOpen(true)
          break
        case 'pul-tasarimlari':
          setCheckerShopOpen(true)
          break
        case 'urunler':
          setProductsOpen(true)
          break
        case 'havale': // Havale talimati gecici (sunucu referansi, URL'den kurulamaz) -> siparislere dus
        case 'siparislerim':
          setMyOrdersOpen(true)
          break
        case 'uyelik':
          // Uyelik modali (menu key 'membership' -> slug 'uyelik'). Dogrudan link/yenileme/
          // geri tusuyla gelince de acilsin (aksi halde home'a dusuyordu). Modal user
          // gerektirir; misafirde memOpen no-op olur (home gorunur).
          setMemOpen(true)
          break
        case 'sepet':
          setCartOpen(true)
          break
        case 'odeme':
          // Odeme adimi gecici (imzali submitUrl bellekte); dogrudan/yenileme ile gelince sepete don.
          setCartOpen(true)
          break
        case 'cerceveler':
          setFrameGalleryOpen(true)
          break
        case 'istatistiklerim': // eski slug -> profil ANA sayfasi (İstatistikler sekmesi)
          setProfileEditMode(false)
          setProfileTab('stats')
          setEditProfile(true)
          break
        case 'arkadaslar':
          setFriendsOpen(true)
          break
        case 'mesajlar':
          setMessagesOpen(true)
          break
        case 'hata-gunlugu':
          setBlunderOpen(true)
          break
        case 'mac-analizleri': {
          // /mac-analizleri/<id> -> o macin raporunu otomatik ac (paylasilabilir link).
          // MatchAnalytics initialMatchId ile o maci bulup rapor/detayi acar.
          const mid = /^\d+$/.test(seg[1] || '') ? parseInt(seg[1], 10) : null
          setMatchHistInitialId(mid)
          setMatchHistOpen(true)
          break
        }
        case 'cerceve-anim':
          setFrameAnimOpen(true)
          break
        case 'oyun-onizleme':
          setGamePreviewOpen(true)
          break
        case 'adillik':
          setFairOpen(true)
          break
        case 'dersler':
          setLessonsOpen(true)
          break
        case 'tek-oyun':
          // Misafir Tek Oyun oynayamaz (coin/hesap şart) -> üyelik iste. Yalnız Yapay Zeka ile
          // oynama misafire açık.
          // KRITIK: mount'ta (refresh) profil fetch'i HENUZ bitmedi -> `user` null olur; `!user`
          // ile gate edersek GIRISLI kullaniciyi refresh'te haksiz giris sayfasina atar. Senkron
          // getToken() oturumu guvenilir soyler (profil beklemeden). Token yoksa misafir -> uyelik.
          if (!getToken()) requireLogin()
          else setSoloOpen(true)
          break
        case 'turnuva-takvimi':
          setContentView('event')
          break
        case 'hizmetler': // eski standalone Hizmetler -> Bilgi › Hizmetler sekmesine yonlendir
          setInfoTab('services')
          setInfoOpen(true)
          break
        case 'blog':
          setContentView('blog')
          break
        case 'haberler':
          setContentView('news')
          setNewsSlug(seg[1] ?? null) // /haberler/<slug> -> detay
          break
        case 'makaleler':
          setContentView('makale')
          setNewsSlug(seg[1] ?? null) // /makaleler/<slug> -> detay (newsSlug paylaşılır)
          break
        case 'tavla-magazin':
          setContentView('magazine')
          break
        case 'kulup-rehberi':
          setContentView('club')
          break
        case 'ayarlar':
        case 'tahta-ayarlari': // eski slug -> Magaza (Tahta Rengi sekmesi kaldirildi -> coin)
          setShopTab('coin')
          setShopOpen(true)
          break
        case 'bulmaca':
          setQuizOpen(true)
          break
        case 'kulupler':
          setClubsOpen(true)
          break
        case 'nasil-oynanir':
          setRulesOpen(true)
          break
        case 'pozisyon-analizi':
          setAnalyzerOpen(true)
          break
        case 'mat-analiz':
          setMatAnalyzerOpen(true)
          break
        case 'basarimlar':
          setAchOpen(true)
          break
        case 'izle': {
          // Canli mac izleme deep-link: /izle/<ODA_KODU>. Isimler oda verisinden
          // (showRoom p1_name/p2_name) gelir -> prop bos verilebilir. Kod yoksa yok say.
          const c = (seg[1] || '').toUpperCase()
          if (!c) break
          // Adres cubugu oynanan macta /izle/<kod> gosterir (asagidaki effect). F5'te bu kendi
          // aktif online macimizsa SPECTATE ACMA -> rejoin (localStorage) bizi oyuncu olarak dondurur.
          const lg = loadGame()
          if (lg && lg.mode === 'online' && lg.inGame === true && lg.record?.online && (lg.record?.uid || '').toUpperCase() === c) break
          setSpectate({ code: c, p1: '', p2: '' })
          break
        }
        case 'arkadasinla-oyna':
          setInviteTarget(null) // menuden acilis = normal mod (davet degil)
          setFriendClassic(false)
          setFriendSetupOpen(true)
          break
        case 'yeni-oyun':
          setClassicSetup(false)
          setSetup('online')
          break
        case 'klasik-arkadasinla-oyna': // KLASIK TAVLA — Arkadaşınla Oyna (küp yok + mars=2)
          setInviteTarget(null)
          setFriendClassic(true)
          setFriendSetupOpen(true)
          break
        case 'klasik-tavla': // eski birleşik slug -> geriye dönük: klasik bota karşı
        case 'klasik-yapay-zeka': // KLASIK TAVLA — Yapay Zeka ile Oyna (küp yok + mars=2)
          setClassicSetup(true)
          setSetup('pvb')
          break
        case 'online-tavla': // SEO landing sayfasi (taranabilir icerik)
          setOnlineTavlaOpen(true)
          break
        case 'tavla-oyna': // SEO landing sayfasi (taranabilir icerik)
          setTavlaOynaOpen(true)
          break
        case 'tavla-turnuvasi-organizasyonu': // Turnuva organizasyonu SEO servis sayfalari + iletisim
        case 'kurumsal-tavla-turnuvasi':
        case 'belediye-tavla-turnuvasi':
        case 'avm-tavla-turnuvasi':
        case 'iletisim':
          setServicePage(seg[0])
          break
        case 'tavla-rehberi': // Tavla Rehberi blog: hub (/tavla-rehberi) veya yazi (/tavla-rehberi/<slug>)
          setGuideOpen(true)
          setGuideSlug(seg[1] || null)
          break
        case 'turnuva-kurallari': // WBF turnuva kuralları referans sayfası
          setTournRulesOpen(true)
          break
        case 'sikca-sorulan-sorular':
          setFaqOpen(true)
          break
        case 'yz-ile-oyna':
        case 'yapay-zeka': // eski slug -> geriye donuk uyum
          setClassicSetup(false)
          setSetup('pvb')
          break
        case 'profil': {
          // Alt-yol -> profil sekmesi (kisisel yer-imi/link): /profil/avatarlar, /tahtalar, /basarilar,
          // /bildirimler, /duzenle. Alt-yol yoksa (veya bilinmeyen) İstatistikler sekmesi.
          const sub = seg[1] || ''
          if (sub === 'bildirimler') {
            // Bildirimler artık Mesajlar'da (birleşti) -> eski /profil/bildirimler linki Mesajlar'ı açar.
            setMessagesOpen(true)
            break
          }
          if (sub === 'duzenle') {
            setProfileEditMode(true)
          } else {
            setProfileEditMode(false)
            setProfileTab(
              sub === 'avatarlar'
                ? 'frames'
                : sub === 'tahtalar'
                  ? 'boards'
                  : sub === 'basarilar'
                    ? 'badges'
                    : sub === 'pul-tasarimlari'
                      ? 'checkers'
                    : sub === 'adreslerim'
                      ? 'addresses'
                      : 'stats',
            )
          }
          setEditProfile(true)
          break
        }
        case 'profil-duzenle': // eski slug -> geriye donuk uyum (duzenleme formu)
          setProfileEditMode(true)
          setEditProfile(true)
          break
        case 'giris': // Giris/Kayit artik normal sayfa (URL'li). Deep-link/geri tusu ile acilir.
          // Zaten girisliyse (token var) giris/kayit formu anlamsiz -> ana sayfaya cek, acma.
          // getToken() senkron+guvenilir (profil fetch'i beklemeden formun gorunmesini onler).
          if (getToken()) { window.history.replaceState(null, '', '/'); break }
          setShowAuth(true)
          setAuthForgot(false)
          break
        case 'sifremi-unuttum': // Sifremi unuttum = Auth'un forgot alt-modu, artik kendi URL'si
          if (getToken()) { window.history.replaceState(null, '', '/'); break }
          setShowAuth(true)
          setAuthForgot(true)
          break
        case 'kvkk':
        case 'gizlilik-politikasi':
        case 'cerez-politikasi':
        case 'kullanim-kosullari':
        case 'uyelik-sozlesmesi':
          setLegalSlug(root) // hukuki sayfa (slug == URL)
          break
        default:
          break // ana sayfa (bos path)
      }
    }
    applyFromPath()
    window.addEventListener('popstate', applyFromPath)
    return () => window.removeEventListener('popstate', applyFromPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // state -> URL yolu: menuden sayfa acildikca temiz path guncellenir
  useEffect(() => {
    const pathSlug = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, '')).trim()
    // Doğrudan bilgi URL'sinde önce path -> state efekti çalışmalı; ilk render'da
    // başlangıç state'i boşken adresi ana sayfaya geri yazma.
    // Genel kural: açılışta adreste bir sayfa varsa (ör. /hata-gunlugu) path -> state henüz
    // oturmadan adresi '/'ye yazma — yenilemede sayfa ana sayfaya düşüp "en üste atıyordu".
    if (!initialPathHydratedRef.current && initialPathRef.current !== '') {
      initialPathHydratedRef.current = true
      return
    }
    if (pathSlug === currentSlug) return // zaten senkron (path'ten uygulandi)
    const search = window.location.search
    if (currentSlug) {
      window.history.pushState(null, '', '/' + currentSlug + search)
    } else {
      window.history.replaceState(null, '', '/' + search)
    }
  }, [currentSlug])

  // Rota bazli sekme basligi. Hukuki sayfalar LegalView'de yonetilir (atla).
  // React effect'leri alttan-uste calisir -> child LegalView cleanup'i bu parent
  // effect'ten ONCE calisir, boylece legal->diger gecisinde son sozu bu effect soyler.
  useEffect(() => {
    const slug = currentSlug || ''
    // Canonical + og:url HER rotada kendine isaret eder (eskiden hep ana sayfaya isaret
    // ediyordu -> tum sayfalar ayni canonical). Detay yollari (haberler/<slug> vb.) de
    // kendi tam URL'lerini alir.
    const canonical = SITE_ORIGIN + '/' + slug
    setCanonical(canonical)
    upsertMeta('property', 'og:url', canonical)
    setSeoH1(seoH1(slug)) // her rota DOM'da benzersiz gorsel-gizli H1 tasisin (JS crawler)
    // Hukuki sayfalarin title/description'ini LegalView (page.seo_*) yonetir; canonical/og:url
    // yukarida verildi, gerisini atla.
    if (slug && LEGAL_SLUGS.has(slug)) return
    const { title, desc } = seoLookup(slug)
    document.title = title
    upsertMeta('name', 'description', desc)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', desc)
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', desc)
  }, [currentSlug])

  // Sayfa (slug) DEGISINCE EN USTE kaydir: footer'dan (asagidan) bir linke tiklayinca sayfa
  // ustte acilir ama scroll asagida (footer'da) kaliyordu -> kullanici acilan sayfayi gormuyordu.
  // KRITIK: HOME'a donuste de (slug BOS) kaydir. Onceki `if(!currentSlug)return` home'u atliyordu
  // -> /turnuva-kurallari gibi bir sayfanin EN ALTINDA logoya tiklayinca icerik home'a degisiyor
  // AMA viewport altta kaliyor; home'un alti da AYNI footer oldugu icin "hicbir sey olmadi" hissi
  // (Playwright repro: scroll 384'te takili kaldi). Ilk mount'u atla (tarayici scroll geri-yukleme
  // / deep-link'e karisma); sonraki HER gecelte (home dahil) olasi tum scroll kaplarini tepeye al.
  const scrolledFirstRef = useRef(false)
  const hydratedScrollRef = useRef(false)
  // Gercek SAYFA (menuPages) `.page-host` icine render olur; PORTAL overlay'ler (izle/profil/
  // modallar, menuOverlays) OLMAZ -> feed arkada mount kalir. Bu geciste page-host var mıydı?
  const prevPageHostRef = useRef(false)
  useEffect(() => {
    if (!scrolledFirstRef.current) {
      scrolledFirstRef.current = true
      prevPageHostRef.current = !!document.querySelector('.page-host')
      return
    }
    // SADECE gercek sayfa (page-host) acilis/kapanisinda tepeye kaydir. Portal overlay'ler
    // (canli izleme, profil karti, modallar) page-host OLUSTURMAZ -> acilip kapaninca alttaki
    // lobi feed'inin scroll'u KORUNUR (overlay kapatinca tepeye siçrama yok — sikayet buydu).
    const curPageHost = !!document.querySelector('.page-host')
    const wasPageHost = prevPageHostRef.current
    prevPageHostRef.current = curPageHost
    if (!curPageHost && !wasPageHost) return
    // DEEP-LINK REFRESH FIX ("/sikca-sorulan-sorular refresh edince en başa dönüyor"): ilk mount'ta
    // currentSlug='' idi; applyFromPath deep-link state'ini kurunca currentSlug URL'deki başlangıç
    // slug'ına OTURUR -> bu HİDRASYON geçişinde EN ÜSTE KAYDIRMA (tarayıcı scroll geri-yükleme +
    // #anchor korunur). Yalnız yüklemeden SONRAKİ gerçek kullanıcı gezinmelerinde tepeye al.
    if (!hydratedScrollRef.current) {
      hydratedScrollRef.current = true
      if ((currentSlug || '') === initialPathRef.current) return
    }
    for (const sel of ['.app.lobby', '.lobby-main', '.page-host', '.main', '.register-card']) {
      const el = document.querySelector(sel) as HTMLElement | null
      if (el) el.scrollTop = 0
    }
    window.scrollTo(0, 0)
  }, [currentSlug])

  const [invites, setInvites] = useState<GameInviteT[]>([]) // gelen oyun davetleri
  // Cevrimici listeden "kilic" ile secilen rakip -> FriendGameSetup davet modu (oyun turu/sure sec)
  const [inviteTarget, setInviteTarget] = useState<{ id: number; name: string; avatar?: string | null; rating?: number | null } | null>(null)
  // "Oyun Arayanlar" para/bahis onayı: native window.confirm yerine uygulama-içi stilli modal
  // (markasız tarayıcı popup'ı yerine). msg = onay metni, run = onaylanınca çalışacak eşleşme.
  const [seekerConfirm, setSeekerConfirm] = useState<{ msg: string; run: () => void } | null>(null)
  // Hedefli davetle acilan bekleme odasinda rakip adi: doluysa Lobby bekleme ekrani "kod
  // paylas" yerine "{ad} yaniti bekleniyor" + "Oyunu Iptal Et" gosterir (davet zaten kisiye
  // gitti, kod paylasmaya gerek yok). Oda-olustur/matchmake/terk'te temizlenir.
  const [inviteWaitName, setInviteWaitName] = useState<string | null>(null)
  // Davet edilenin rating'i (bekleme ekraninda isim altinda). Yalniz inviteWaitName varken gorunur.
  const [inviteWaitRating, setInviteWaitRating] = useState<number | null>(null)
  // Davet edenin bu macta rating riski (sunucu Elo'su, davet yanitindan). null = puansiz.
  const [inviteWaitPreview, setInviteWaitPreview] = useState<{ win: number; loss: number } | null>(null)
  // Oda poll'u (deps: room.code) bayat closure'dan okur -> reddeden adini ref'ten al.
  const inviteWaitNameRef = useRef<string | null>(null)
  inviteWaitNameRef.current = inviteWaitName
  const inviteDeclinedRef = useRef<string | null>(null) // bu oda kodu icin red bir kez islensin
  // Daveti reddedince "Oyun Kabul Etmiyor / Cevrimdisi Gorun" diye soran mini modal
  const [declineAsk, setDeclineAsk] = useState(false)
  const [tournNotices, setTournNotices] = useState<TournNoticeT[]>([]) // sirasi gelen turnuva maclari
  const [tournWaiting, setTournWaiting] = useState<{ tid: number; tname: string }[]>([]) // turlar arasi bekleyen turnuvalarim
  // Turnuva maci hazir penceresi (kura + 20sn geri sayim -> otomatik giris). Ayni mac icin bir kez.
  // Turnuva maçına OTOMATİK giriş çift-giriş kilidi (popup YOK -> ping bildirimi gelince doğrudan
  // maça alınır; giriş başarısız olursa catch sıfırlar -> tekrar denenir).
  const enteredNoticeRef = useRef('')
  // Su anki oda bir turnuva maci mi (sonuc ekrani: rovans yok, "Turnuva Lobisi" var)
  const [tournRoom, setTournRoom] = useState<{ code: string; tid: number } | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([]) // sistem bildirimleri
  const [unreadNotif, setUnreadNotif] = useState(0) // okunmamis bildirim sayisi (can rozeti)
  const seenNotifRef = useRef<Set<number>>(new Set()) // toast'landi mi (yeni bildirim tespiti)
  const notifPrimedRef = useRef(false) // ilk ping'te eski bildirimleri toast'lama
  const seenInviteIdsRef = useRef<Set<number>>(new Set()) // yeni oyun daveti tespiti (ses uyarisi)
  const invitePrimedRef = useRef(false) // ilk ping'te mevcut davetleri ses ile uyarma
  const luckyWheelOpenRef = useRef(false) // cark modali acikken bildirim toast'unu bastir (erken gelmesin)
  useEffect(() => {
    luckyWheelOpenRef.current = luckyWheelOpen
  }, [luckyWheelOpen])
  const [rewardReady, setRewardReady] = useState(false) // 6 saatlik odul hazir mi
  const [rewardSecs, setRewardSecs] = useState(0) // sonraki odule kalan saniye (geri sayim)
  const [rewardCoins, setRewardCoins] = useState(25) // odul miktari (plana+admin ayarina gore; presence'tan)
  const [myStatus, setMyStatus] = useState<PresenceStatus>('available') // oyuncu durumu (durum secici; presence'tan senkron)
  // Durum seçici YARIŞ koruması: kullanıcı elle değiştirince zaman damgası. Heartbeat (beat) bayat
  // sunucu durumunu bu pencerede (≤8sn) GERİ ALMASIN -> mobilde "değiştiriyorum ama değişmiyor" kökü:
  // iyimser setMyStatus + fire-and-forget POST uçuşta iken, önce atılmış bir heartbeat eski durumu
  // döndürüp optimistik değeri eziyordu (POST yavaş mobilde her seferinde yakalıyor).
  const statusChangedAtRef = useRef(0)
  // Acilista her zaman ana menu; kayitli oyun varsa menude "Aktif Oyunlar" ile devam edilir
  const [home, setHome] = useState(true)
  const [lobbyTourns, setLobbyTourns] = useState<Tournament[]>([]) // lobide gosterilen aktif turnuvalar
  const [timeControl, setTimeControl] = useState<TimeControl>('normal')
  const [rankedMatch, setRankedMatch] = useState(true) // false = casual (puana etki etmez)
  const clockRef = useRef(CLOCK_PRESETS.normal) // secili saat preseti (delay/over)
  const onlineTargetRef = useRef(1) // online oda kurulunca kullanilacak mac uzunlugu
  const classicRef = useRef(false) // KLASIK TAVLA (kup yok + mars=2): matchmake/bot/arkadas payload bayragi
  const targetsRef = useRef<number[]>([1]) // eslesme icin kabul edilen uzunluklar (coklu)
  const matchTargetSyncedRef = useRef(false) // eslesme sonrasi anlasilan uzunluk uygulandi mi
  // ROVANS (online): biten oda yeniden kullanilamaz (settle onu 'finished' isaretler), bu yuzden
  // iki taraf da isteyince SUNUCU ayni ayarlarla yeni oda acar. mine/theirs: null|'yes'|'no'.
  const [rematch, setRematch] = useState<{ mine: string | null; theirs: string | null; code: string | null }>({
    mine: null,
    theirs: null,
    code: null,
  })
  const rematchEnteredRef = useRef<string | null>(null) // GIRILEN rovans odasinin kodu (tekrar girme)
  const rematchEnteringRef = useRef<string | null>(null) // girisi SURMEKTE olan kod (poll ust uste denemesin)
  // Sunucuya GONDERDIGIM cevap ('yes'/'no'). Poll her 1.2sn'de rematch state'ini sunucudan
  // ezdigi icin, sunucu cevabimi henuz yansitmadiysa iyimser deger BUNDAN korunur (aksi halde
  // "Rakip bekleniyor…" tekrar "Rövanş" butonuna donup titriyordu).
  const rematchSentRef = useRef<string | null>(null)
  // Saat: hamle gecikmesi (delay, her tur sifirlanir) + oyuncu-basi rezerv bankasi
  // (white/black; maca gore kurulur, turlar boyunca tukenir - Galaxy tarzi).
  const [clock, setClock] = useState<{ delay: number; white: number; black: number }>({
    delay: MOVE_DELAY,
    white: OVER_TOTAL,
    black: OVER_TOTAL,
  })
  // Saat her SANIYE degisir; saveGame'i saniyede bir tetiklemesin (agir matchLog yazimi) diye
  // ref'ten okunur -> save yalniz hamle/tur degisiminde olur, saat degeri o an gunceldir.
  const clockStateRef = useRef(clock)
  clockStateRef.current = clock
  // Sunucu-otoriter saat demiri: poll bunu tazeler, ekran YEREL olarak buradan turetilir.
  // Boylece 1.2sn poll'un 1sn'lik sayaci ornekleme aliasing'i (10->8->7->6->4 atlama) biter.
  const clockAnchorRef = useRef<{
    delay: number
    hold: number // grace: delay bu kadar sn SABİT kalır (started_at gelecekte), sonra geri sayar
    white: number
    black: number
    active: Player | null
    at: number
  } | null>(null)
  // AFK (sunucu-otoriter): kayba kalan saniye (yalniz son 15sn'de dolu) + sirasi gelen renk.
  const [afkLeft, setAfkLeft] = useState<number | null>(null)
  const [srvActive, setSrvActive] = useState<Player | null>(null)
  // Maç saat/terk ile bittiyse sebep ('TIMEOUT'|'AFK_TIMEOUT'|'ABANDON') -> sonuç ekranında göster
  // ("kimse çıkmadan kendi kendine bitti" kafa karışıklığını önler). Normal bitişte null.
  const [endReason, setEndReason] = useState<string | null>(null)
  // Mac basi taze saat: rezerv bankasi = puan-basi sure x mac uzunlugu (her oyuncuya)
  // Turnuva turunun elle girilen suresi (sn, oyuncu basina); null = saat modunun varsayilani.
  const clockBankRef = useRef<number | null>(null)
  const freshMatchClock = (target: number) => {
    const bank = clockBankRef.current ?? clockRef.current.over * Math.max(1, target)
    return { delay: clockRef.current.move, white: bank, black: bank }
  }
  const appliedVersionRef = useRef(-1)
  const syncEnabledRef = useRef(false)
  // Oda cikisi basladiginda bekleyen legacy PUT/debounce isteklerini de engelle.
  const roomLeavingRef = useRef<string | null>(null)
  // 409 sonrasi otomatik acilis timer'i ayni hatali istegi sonsuza dek yinelemesin.
  const rollConflictRef = useRef(false)
  const lastSyncRef = useRef('') // en son gonderilen/uygulanan durum imzasi (echo engelle)
  // Sunucu-otoriter mod (Faz 2c): true iken legacy PUT/lokal-zar DEVRE DISI (serverRoll/Move).
  const authoritativeRef = useRef(false)
  // BAGIMSIZ Faz 1: true iken yalniz ZAR sunucudan (serverRoll); hamle/tahta/PUT LEGACY kalir.
  // authoritative'den AYRI: doRoll serverRoll'a gider ama commitTurn/PUT sync degismez.
  const diceAuthorityRef = useRef(false)
  // SUNUCU-OTORİTER BOT: gnubg yokken (bot_status='unavailable') botu tekrar dürtme zamanlayıcısı.
  const botNudgeTimerRef = useRef<number | null>(null)
  const rollInFlightRef = useRef(false) // serverRoll uçuşta -> üst üste/döngüsel çağrıyı engelle
  const moveInFlightRef = useRef(false) // serverMove uçuşta -> mükerrer commit engelle
  // Bot maçı akıcılığı: insan Onayla/Kabul der demez (SUNUCU yanıtını BEKLEMEDEN) buton ANINDA
  // kapanır ve "sıra botta, düşünüyor" gösterilir; gnubg hamlesi arkada hesaplanır. Yoksa buton
  // ~1.5sn ekranda takılı kalıp yanıt gelince kaybolur (kullanıcı "donuyor/akıcı değil" dedi).
  const [botThinking, setBotThinking] = useState(false)
  // TURNUVA BEKLEME GERİ SAYIMI: maç ekranında (tahtada) rakibin bağlanması için 60sn sayaç.
  // Dolunca no-show effect'i (tournamentNoShow) hükmen kazandırır. Yalnız görsel; otorite sunucuda.
  const [tournWaitSec, setTournWaitSec] = useState(60)
  // ONLINE AKICILIK: insan maçında (bot değil) aksiyon SUNUCU yanıtını bekler; optimistik yerel
  // uygulama yoktur. Yanıt gelene kadar butonu "Gönderiliyor…/Atılıyor…"a çevirip DISABLE ederek
  // (a) donuk his yerine ilerleme göster, (b) sabırsız tekrar-basışı (moveInFlightRef zaten yutar
  // ama görsel de kilitli) engelle. botThinking bot maçına özel; bu ikisi insan maçları içindir.
  const [moveSending, setMoveSending] = useState(false)
  const [rollSending, setRollSending] = useState(false)
  // OTO-ZAR KURTARMA (1 puanlik/olu-kup maç): kup teklif secenegi olmayan maçta "Zar At" butonu
  // HİÇ çizilmez (autoRollPending daima true) -> zar %100 oto-zar effect'ine bağlı. Oto-zar bir
  // transiente (409 mandalı / bayat srvTurn / backoff) takılırsa manuel kurtarma yolu yoktu ->
  // oyuncu KALICI kilitlenir ("zar atamıyor", #XR37P). true olunca butonu acil kapı olarak açarız.
  const [autoRollStuck, setAutoRollStuck] = useState(false)
  // API GERİ-ÇEKİLME (429 "Too Many Attempts"): bir istek rate-limit yerse bu zaman damgasına
  // kadar YENİ istek ATMA (roll + poll). Aksi halde takılı auto-roll/poll döngüsü kotayı doldurup
  // tüm hesabı kilitliyor (bir maçın spam'i diğer maçı da bloke ediyordu). Date.now() > ref -> serbest.
  const apiBackoffUntilRef = useRef(0)
  const lastSubmittedMoveRef = useRef<string | null>(null)
  const appliedServerVersionRef = useRef(-1) // uygulanan son server_state versiyonu
  // SAVUNMA KALKANI: istemci GEÇERSİZ tahta (toplam != 15/15) hesaplarsa kaç kez resync istendi
  // (aynı bozulmada sonsuz döngü olmasın). Bkz boardDisplay geçerlilik efekti.
  const invalidBoardResyncRef = useRef(0)
  // Yukaridaki surum HANGI odaya ait? Surumler oda-yerelidir (her oda 0'dan baslar), bu yuzden
  // "ref eskimis mi" karari SURUM SIRASINA degil ODA KIMLIGINE bakmali (bkz. serverSyncRoomChanged).
  const appliedServerRoomRef = useRef<string | null>(null)
  // Poll (stale-closure) icin guncel tur/oynanan ref'leri: server_state'i mid-move'u ezmeden uygula.
  const srvTurnStartRef = useRef<GameState | null>(null)
  const srvPlayedRef = useRef<Step[]>([])
  // Poll (stale-closure) acilis overlay'ini de gormeli: "Acilis zari atiliyor..."da takilirsak
  // sunucudaki acilmis oyunu KOSULSUZ uygula (openingNeedsResync kalkani).
  const openingRef = useRef<'roll' | 'reveal' | null>(null)
  // Poll (stale-closure): bot HAMLESI EKRANDA OYNANIRKEN (botAnim) sunucu saatini YAZMA. Sunucuda
  // bot aninda oynadigi icin sira/saat coktan insana (p1) gecmis olur; poll bu araligi yazarsa
  // "sira botta ama benim (beyaz) sayim eriyor" desync'i olusur. Animasyon bitene kadar yerel saat
  // (aktif=siyah) gosterilir; bittiginde poll gercek sunucu saatini (reveal-grace'li) yazar.
  const botAnimRef = useRef(false)
  // MAÇI BİTİREN bot hamlesi animasyonla oynanırken bekleyen otoriter son durum (bkz applyBotTurn).
  // Animasyon bir şekilde iptal edilirse güvenlik zamanlayıcısı bunu yine de uygular (gameEnd kurulur).
  const pendingBotFinalRef = useRef<{ code: string; version: number; state: GameState; match: ServerMatch | null } | null>(null)
  const oppLoggedRef = useRef('') // otoriter modda rakip hamlesi bir KEZ loglansin
  // Odaya (yeniden) GIRERKEN senkron sayaclarini sifirla — TEK YER.
  // KRITIK BUG (canli): appliedServerVersionRef yalniz ilk mount'ta -1'di ve oda girislerinde
  // SIFIRLANMIYORDU. Yeni odanin server_version'i 0/1'den basladigi icin, ayni sekmede ikinci
  // (rovans/yeni eslesme) maca giren oyuncuda "surum ilerledi mi" kontrolu KALICI olarak
  // basarisiz oluyor -> poll otoriter durumu HIC uygulamiyor. Acilis yarisini KAYBEDEN taraf
  // (reused/409 alip poll'a birakan) "Acilis zari atiliyor..." ekraninda SONSUZA KADAR takili
  // kaliyor; rakibi normal oynuyordu. srvTurnStart/oppLogged de eski odadan tasinmasin.
  function resetRoomSync() {
    appliedVersionRef.current = -1
    appliedServerVersionRef.current = -1
    appliedServerRoomRef.current = null
    srvTurnStartRef.current = null
    oppLoggedRef.current = ''
    setOppRoll(null) // yeni oda/rövanş: önceki maçın rakip-zarı bayat görünmesin
    lastOppRollVRef.current = -1
  }
  // Bitmis mac restore edildiyse puan tekrar bildirilmesin (refresh koruma)
  const ratingReportedRef = useRef(!!(saved && (saved.gameEnd || matchWinner(saved.match))))
  const turnRankedRef = useRef<RankedMove[] | null>(null) // tur basi tam siralama (hata tespiti)
  // ---- Maç kaydı (hamle+zar logu): TÜM maçları logla (bkz. submitGameLog) ----
  // NOT: mevcut `matchLogRef` (analiz logu) ile KARISTIRMA — bu ayri bir kayit.
  const gameRecordRef = useRef<{
    uid: string
    online: boolean
    slot: Slot
    mode: 'pvb' | 'online' | 'local'
    target: number
    gameNo: number
    events: GameLogTurn[]
    done: boolean
  } | null>(null)
  const [recordUid, setRecordUid] = useState<string | null>(null) // sol üst HUD'da gösterilen maç ID
  const prevGameEndRef = useRef(false) // gameEnd null->deger gecisini yakala (oyun-sonu flush)
  const autoNextGameRef = useRef(false)
  const turnsPlayedRef = useRef(0) // commitTurn anindaki ortak sira (iki istemci ayni deger)
  // Alt anlatım satırı kaldırıldı (board görsel veriyor); setMessage yazımları
  // zararsız kalır ama değer artık GÖSTERİLMEZ. ponytail: dead state, okuyan kalmadı.
  const [, setMessage] = useState(() => t('msg.roll'))
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [currentProbs, setCurrentProbs] = useState<number[] | null>(null)
  const [ranked, setRanked] = useState<RankedMove[] | null>(null)
  // HAKEM=gnubg: panel açıkken gösterilen hamle listesi gnubg'den (varsa). null -> wildbg ranked.
  const [gnubgMoves, setGnubgMoves] = useState<GnuMove[] | null>(null)
  const [analysisBoard, setAnalysisBoard] = useState<GameState | null>(null) // mini board pozisyonu
  // Ipucu / Ogrenme modu: mevcut konumdaki en iyi hamle + gerekceleri (ekstra ag cagrisi yok)
  const [curBest, setCurBest] = useState<{ notation: string; equity: number; reasons: Reason[] } | null>(null)
  const [hintShown, setHintShown] = useState(false) // ipucu butonuna basildi mi
  const [learnMode, setLearnMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tavla.learn') === '1'
    } catch {
      return false
    }
  })
  // PR (Performans Reytingi): her oyuncu icin karar basina kaybedilen equity
  // loss/decisions = STRICT XG (obvious+forced hariç, PR'ın kendisi). cubeLoss/cubeDecisions =
  // yalnız küp (kırılım). allLoss/allDecisions = TÜM kaydedilen kararlar (obvious dahil) -> strict
  // 0 çıkarsa PR "—" olmasın diye GARANTİ yedeği. Opsiyonel -> reset {loss,decisions} yeter.
  const [prStats, setPrStats] = useState<{
    white: { loss: number; decisions: number; cubeLoss?: number; cubeDecisions?: number; allLoss?: number; allDecisions?: number }
    black: { loss: number; decisions: number; cubeLoss?: number; cubeDecisions?: number; allLoss?: number; allDecisions?: number }
  }>({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
  // PR'in EN GUNCEL degeri: mac-sonu raporu (async recordPR'lar report closure'undan
  // SONRA bittigi icin) stale prStats yerine bu ref'ten okur -> kendi PR'im null dusmez.
  const prStatsRef = useRef(prStats)
  prStatsRef.current = prStats
  // Sans (luck): oyuncu-basi birikmis equity sansi (zarlarin sanslilik toplami)
  const [prLuck, setPrLuck] = useState<{ white: number; black: number }>({ white: 0, black: 0 })
  // Luck'in EN GUNCEL degeri (mac-sonu flush'i stale closure yerine buradan okur)
  const prLuckRef = useRef(prLuck)
  prLuckRef.current = prLuck
  const luckSigRef = useRef('') // ayni turda sansi iki kez saymayi engelle
  const [coinDelta, setCoinDelta] = useState<number | null>(null) // bahisli macta kendi coin degisimi
  // Komisyon (rake): kazananin aldigi (won) vs kaybedenin odedigi (lost) ASIMETRIK olabilir
  // (kazanan stake x (1-komisyon)). MatchResult iki tarafi ayri gosterir. null -> simetrik fallback.
  const [coinPair, setCoinPair] = useState<{ won: number; lost: number } | null>(null)
  // reason/limit: maç PUANSIZ ise (kılıç casual / günlük limit / bot) sonuç ekranında açıklayıcı not.
  const [ratingChange, setRatingChange] = useState<{
    before: number
    after: number
    reason?: 'bot' | 'unrated' | 'guest' | 'friendly_cap' | 'friendly' | 'casual' | null
    limit?: number
  } | null>(null)
  // Sunucu-otoriter PR (mac-sonu): kendi + rakip PR'i backend'de her oyuncunun KENDI
  // log'undan hesaplanir -> iki oyuncu AYNI degerleri gorur. null ise lokal prOf'a duser.
  // KIRILIM (checker/cube) da sunucudan gelir -> "Pul Oyunu PR" / "Kup PR" satirlari da iki
  // oyuncuda OZDES olur (rakibin kup kararlari lokal olarak hic olculemez; backend onun kendi
  // log'undan hesaplar). Alan null ise lokal olcume duser.
  const [serverPr, setServerPr] = useState<{
    self: number | null
    opp: number | null
    checkerSelf?: number | null
    checkerOpp?: number | null
    cubeSelf?: number | null
    cubeOpp?: number | null
  } | null>(null)
  // HAKEM=gnubg: maç bitince gösterilen PR gnubg (async job) ile hesaplanır. Hazır olana kadar
  // sonuç ekranı insan PR'ında "…" gösterir (wildbg sayısı gösterilmez); gnubg gelince swap edilir.
  const [prAnalyzing, setPrAnalyzing] = useState(false)
  // RAKİP PR'ı ayrı/geç gelir (kaybeden kendi satırını geç raporlar/gnubg kuyruğu). KENDİ PR'ım hazır
  // olunca prAnalyzing kapanıp rakip hücresi boş "—" gösteriyordu ("rakibin PR'ı yok" sanılıyordu).
  // Bu bayrak rakip PR'ı gelene (ya da matchPr poll tavanına) kadar onun hücresinde "…" tutar.
  const [oppPrPending, setOppPrPending] = useState(false)
  const prPollRef = useRef(0) // aktif poll oturumu (yeni maç/yeni rapor eski poll'u iptal eder)
  // Sunucu-otoriter SANS (luck): iki oyuncu da backend'den AYNI beyaz+siyah HAM luck çiftini
  // okur (her biri kendi renginin ham luck'ını raporlar) -> net (kazanan−kaybeden) TUTARLI.
  // Renk-anahtarlı (peer snapshot'a güvenmez). null iken lokal prLuck'a düşer.
  const [serverLuck, setServerLuck] = useState<{ white: number | null; black: number | null } | null>(null)
  // Tavlai Luck V1: gnubg NATIVE per-oyuncu MWC-luck (%). Async (analyse match) -> hazır olunca
  // dolar; İKİSİ de biliniyorsa MatchResult BAĞIMSIZ % gösterir (sıfır-toplam DEĞİL, gnubg gibi).
  const [serverLuckMwc, setServerLuckMwc] = useState<{ white: number | null; black: number | null } | null>(null)
  // Maç Özeti: gnubg luck EQUITY (cost) + JOKER sayısı (per renk). Async job doldurur.
  const [serverLuckEmg, setServerLuckEmg] = useState<{ white: number | null; black: number | null } | null>(null)
  const [serverLuckJokers, setServerLuckJokers] = useState<{ white: number | null; black: number | null } | null>(null)
  // Gecici bildirim: birlesik toast sistemi (src/ui/Toast). Ag hatalari + e-posta
  // dogrulama sonucu buradan gecer; eski yerel ".verify-toast" render'i kaldirildi.
  const notify = useToast()
  // Mac gunlugu (insanin kararlari): rapor/istatistik icin
  const [matchLog, setMatchLog] = useState<MoveLogEntry[]>([])
  // En guncel log (mac-sonu kaydi async analizler bittikten sonra bunu okur)
  const matchLogRef = useRef<MoveLogEntry[]>([])
  matchLogRef.current = matchLog
  // OTORITER oyun sonuclari (kazanan + gercek puan), oyun sirasiyla. XG .mat disa aktariminda
  // matchLog'un ATLADIGI zorunlu bitiren-hamle yuzunden tahta-tekrari sonuc bulamazsa buradan
  // doldurulur (bkz. buildMatXg.results). Ayni dizi kimligi korunur (.length=0 ile temizlenir)
  // ki MatchReport'a gecen referans daima canli kalsin.
  const gameResultsRef = useRef<GameResultInput[]>([])
  // Basarim sinyalleri (mac boyunca birikir; reportRating'te okunur + sifirlanir).
  // Bunlar log'da guvenilir olmadigi icin frontend'den payload ile gonderilir.
  const achGammonRef = useRef(0) // bu macta insanin mars (gammon) galibiyeti
  const achBgRef = useRef(0) // katmerli mars (backgammon) galibiyeti
  const achMinWpRef = useRef(101) // insanin gordugu en dusuk kazanma % (101 = yok)
  const achPrime6Ref = useRef(false)
  const achCloseoutRef = useRef(false)
  const resetAchSignals = () => {
    achGammonRef.current = 0
    achBgRef.current = 0
    achMinWpRef.current = 101
    achPrime6Ref.current = false
    achCloseoutRef.current = false
  }
  // reportRating payload'i icin sinyalleri topla + sifirla (bir sonraki mac temiz baslar).
  const buildAchExtra = () => {
    const minWp = achMinWpRef.current <= 100 ? achMinWpRef.current : null
    const flags: string[] = []
    if (achPrime6Ref.current) flags.push('prime6')
    if (achCloseoutRef.current) flags.push('closeout')
    const extra = {
      gammons: achGammonRef.current,
      backgammons: achBgRef.current,
      min_win_prob: minWp,
      ach_flags: flags,
    }
    resetAchSignals()
    return extra
  }
  // Bekleyen (async) hamle analizi sayaci: online mac-sonu kaydi bunlar bitene kadar bekler
  const pendingAnalysisRef = useRef(0)
  // pvb HAYALET-MAC KALKANI: bu macta INSANIN (beyaz) commit ettigi tur sayisi. Acilis zari
  // rakibe (bot=siyah) baslama hakki verirse bot ONCE oynar -> turnsPlayed>0 + matchLog dolu
  // OLUR ama insan HIC hamle yapmamistir. Insan bu noktada "Mactan Cekil" derse eski guard
  // (matchLog bos && turnsPlayed==0) yetmez -> oynanmamis AI KAYBI yazilirdi. Bu sayac yalniz
  // insan turlarini sayar; 0 iken maci KAYDETME. Yeni macta sifirlanir (bkz handleNewMatch).
  const humanTurnsRef = useRef(0)
  const [resultView, setResultView] = useState<null | 'stats' | 'analysis'>(null) // rapor modali
  const matchResultIdRef = useRef<number | null>(null) // reportRating'ten dönen id (gnubg analiz için)
  const [analysisGnubgLog, setAnalysisGnubgLog] = useState<LogEntry[] | null>(null) // maç-sonu gnubg analizi
  const [analysisBusy, setAnalysisBusy] = useState(false)
  // Maç-sonu rapor (stats/analysis) açılınca: hamle-hamle analizi GNUBG'den çek (loader). Yoksa/
  // başarısızsa yerel matchLog'a düşülür. Kapanınca sıfırla. (HAKEM=gnubg: analizde wildbg gösterme.)
  useEffect(() => {
    if (!resultView) {
      setAnalysisGnubgLog(null)
      return
    }
    const id = matchResultIdRef.current
    if (!id) return
    let alive = true
    setAnalysisBusy(true)
    matchGnubgReview(id)
      .then((gr) => {
        if (alive && gr?.ok && gr.log && gr.log.length > 0) setAnalysisGnubgLog(gr.log)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setAnalysisBusy(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultView])
  const [lastError, setLastError] = useState<MoveError | null>(null)
  const heuristicRef = useRef(new HeuristicBot())
  const neuralRef = useRef(new NeuralBot())
  const fairRef = useRef(new FairDice()) // adil (dogrulanabilir) zar ureticisi
  const tournMatchRef = useRef<{ tid: number; matchKey: string; oppId: number } | null>(null)
  neuralRef.current.level = difficulty // AI seviyesini uygula
  const engine = neuralRef.current // tum seviyeler sinir agi (seviyeye gore gurultu)

  // HAKEM=gnubg: bot TÜM SEVİYELERDE gnubg oynar (girişli + servis). gnubg sıralı aday hamleleri
  // (equity'li) döner; seviye 10 -> en iyi, seviye<10 -> wildbg ile AYNI Gauss gürültü modeliyle
  // equity'ye rastgele ekleyip suboptimal seçilir (seviye/zorluk korunur). Eşleşmez/servis yok/
  // misafir/çift değil ise wildbg (engine.chooseMove) FALLBACK -> bot ASLA geçersiz/donuk kalmaz.
  async function chooseBotMove(state: GameState): Promise<Move> {
    if (getToken()) {
      try {
        const dice2 = state.dice.slice(0, 2)
        if (dice2.length === 2) {
          const g = await analyzePosition({
            points: state.points,
            bar: state.bar,
            turn: state.turn,
            dice: dice2,
            cube: { value: match.cube.value, owner: match.cube.owner },
            score: { white: match.score.white, black: match.score.black },
            matchLength: match.target,
            plies: 2,
          })
          if (g.moves && g.moves.length > 0) {
            // Seviye zayıflatması: gnubg listesine wildbg ile aynı gürültü (sigma) uygulanır.
            let pick = g.moves[0]
            if (difficulty < 10 && g.moves.length > 1) {
              const sigma = 0.45 * Math.pow((10 - difficulty) / 9, 1.4)
              let bestNoisy = -Infinity
              for (const m of g.moves) {
                const noisy = m.equity + (Math.random() * 2 - 1) * sigma
                if (noisy > bestNoisy) {
                  bestNoisy = noisy
                  pick = m
                }
              }
            }
            const mv = matchGnubgMove(state, state.turn, pick.notation)
            if (mv) return mv // gnubg hamlesi (güvenli eşleşme)
          }
        }
      } catch {
        /* gnubg erişilemedi -> wildbg fallback */
      }
    }
    return await Promise.resolve(engine.chooseMove(state))
  }

  // Refresh'te oyun kaybolmasin: saveGame, ILK restore bitene kadar localStorage'i
  // EZMEZ (hydratedRef). Boylece restore effect'i kaydi TAZE okur — StrictMode dev
  // remount'unda bile ezme olmaz. "Once useMemo ile yakala" kirilgan numarasi YOK.
  const hydratedRef = useRef(false)

  // Oyunu yerel kaydet (offline/misafir icin). gameEnd de kaydedilir ki
  // refresh'te bitmis oyun yeniden "kazanildi" sayilip tekrar puanlanmasin.
  useEffect(() => {
    if (!hydratedRef.current) return // ilk restore bitene kadar localStorage'i EZME (kritik)
    // pr/luck da kaydedilir -> refresh/resume'da PR/Sans/Seviye kaybolmaz
    // inGame: kayit aninda oyun gorunumunde miydik -> refresh'te ana sayfadan oyuna zorla sokma
    // log (matchLog) da kaydedilir -> refresh/resume'da KARAR LOGU kaybolmaz; yoksa mac
    // sonu PR birikmis prStats'tan gelir ama log BOS gider (has_log=false -> "analiz cikmiyor").
    // Boyut icin son 600 girdi (rapor zaten son 1000'i gonderir; localStorage kotasi guvenli).
    // ach: basarim sinyalleri (ref) — refresh'te sifirlanmasin diye ref degerleri de kaydedilir.
    // clock: saat/rezerv bankasi (pvb kozmetik; online sunucudan geldigi icin ezilir).
    // record: admin mac kaydi kimligi + biriken events (refresh'te ayni kayda devam -> parcalanma yok).
    // result: mac-sonu ekran gosterim degerleri (refresh'te delta/coin gosterimi kaybolmasin).
    const rec = gameRecordRef.current
    saveGame({ mode, difficulty, match, starter, turnsPlayed, turnStart, played, gameEnd, pr: prStats, luck: prLuck, log: matchLog.slice(-600), ach: { gammons: achGammonRef.current, backgammons: achBgRef.current, minWp: achMinWpRef.current, prime6: achPrime6Ref.current, closeout: achCloseoutRef.current }, clock: clockStateRef.current, record: rec ? { uid: rec.uid, gameNo: rec.gameNo, online: rec.online, slot: rec.slot, mode: rec.mode, target: rec.target, done: rec.done, events: rec.events } : undefined, result: { ratingChange, coinDelta, coinPair }, inGame: !home })
  }, [mode, difficulty, match, starter, turnsPlayed, turnStart, played, gameEnd, prStats, prLuck, matchLog, ratingChange, coinDelta, coinPair, home])

  // Kaydedilmis oyunu state'e uygula (sunucudan yukleme)
  function applySavedGame(g: SavedGame) {
    setMode(g.mode)
    setDifficulty(normDifficulty(g.difficulty))
    setMatch(g.match)
    setStarter(g.starter)
    setTurnStart(g.turnStart)
    // Bot yarim animasyonda kaydedildiyse (played>0, sira bot) temizle -> bot devam etsin (takilma fix)
    setPlayed(g.mode === 'pvb' && g.turnStart.turn === BOT_PLAYER ? [] : g.played)
    setTurnsPlayed(g.turnsPlayed)
    setSelectedFrom(null)
    setCubePending(null)
    setGameEnd(g.gameEnd ?? null)
    setBotAnim(null)
    setOpening(null)
    setOpeningResult(null)
    // PR + Sans'i da geri yukle -> refresh/resume sonrasi mac sonu ekraninda oyuncunun
    // seviyesi/PR/sansi "—"/+0 olmaz (kayittaki birikmis degerler korunur).
    if (g.pr) setPrStats(g.pr)
    if (g.luck) setPrLuck(g.luck)
    // KARAR LOGU'nu da geri yukle -> refresh sonrasi mac bitince has_log=true olur
    // (analiz raporu acilir). prStats ile TUTARLI kalir (PR var ama log yok bug'i fix).
    if (g.log?.length) setMatchLog(g.log)
    // Hayalet-mac kalkani: refresh oncesi insanin (beyaz) OYNADIGI turlar korunsun; aksi halde
    // resume sonrasi insan hamle yapmadan cikarsa gercek mac "hic oynanmadi" sanilip kaybolurdu.
    humanTurnsRef.current = g.log?.filter((e) => e.player === 'white').length ?? 0
    // BAŞARIM SİNYALLERİ'ni geri yukle -> refresh sonrasi mac bitince mars/6-prime/closeout/
    // min-WP basarimlari eksik raporlanmaz (matchLog fix ile ayni mantik; ref'ler otomatik kaydolmaz).
    if (g.ach) {
      achGammonRef.current = g.ach.gammons ?? 0
      achBgRef.current = g.ach.backgammons ?? 0
      achMinWpRef.current = g.ach.minWp ?? 101
      achPrime6Ref.current = !!g.ach.prime6
      achCloseoutRef.current = !!g.ach.closeout
    }
    // SAAT: pvb/pvp'de rezerv bankasi refresh'te sifirlanmasin (online'da server-sync ezer).
    if (g.clock) setClock({ delay: g.clock.delay, white: g.clock.white ?? OVER_TOTAL, black: g.clock.black ?? OVER_TOTAL })
    // MAÇ KAYDI: aktif LOKAL maç -> ayni admin kaydina (uid+events) devam et; yeni uid uretip
    // logu ikiye BOLME. (Online'da uid=oda kodu; sunucudan re-derive edilir, burada dokunma.)
    if (g.record && g.mode !== 'online') {
      gameRecordRef.current = {
        uid: g.record.uid,
        online: g.record.online,
        slot: g.record.slot,
        mode: g.record.mode,
        target: g.record.target,
        gameNo: g.record.gameNo,
        events: (g.record.events as GameLogTurn[]) ?? [],
        done: g.record.done,
      }
      setRecordUid(g.record.uid)
    }
    // MAÇ-SONU SONUÇ EKRANI: refresh'te delta/coin gosterimi +0/— dusmesin (kalici deger sunucuda).
    if (g.result) {
      if (g.result.ratingChange) setRatingChange(g.result.ratingChange)
      if (g.result.coinDelta != null) setCoinDelta(g.result.coinDelta)
      if (g.result.coinPair) setCoinPair(g.result.coinPair)
    }
    // Bitmis mac yeniden yuklendiyse puani tekrar bildirme
    ratingReportedRef.current = !!(g.gameEnd || matchWinner(g.match))
    // Aktif (bitmemis) bot/lokal oyun geri yuklendiyse: SADECE kayit aninda kullanici
    // oyun gorunumundeyse (inGame) oyuna don. Ana sayfadayken (inGame=false) veya eski
    // kayitta (undefined) HOME'da kal -> aktif oyun "Devam Et" cubuguyla erisilir.
    // (Boylece refresh, terk edilmis eski AI oyununa ZORLA sokmaz; oyun da kaybolmaz.)
    if (
      g.inGame === true &&
      g.mode !== 'online' &&
      !matchWinner(g.match) &&
      (g.turnsPlayed > 0 || !!g.gameEnd)
    ) {
      setHome(false)
    }
  }

  // Acilista oyunu geri yukle. KRITIK: ayni cihazda refresh'te YEREL kayit (her hamlede
  // localStorage'a yazilir) EN TAZE kaynaktir. Sunucu kaydi debounce'lu + cok-cihaz icin;
  // eski/bos donup taze yerel oyunu EZMEMELI. Bu yuzden aktif bir yerel (bot/lokal) oyun
  // varsa GIRIS YAPMIS olsa bile once onu yukle; sunucu yalniz yerel yoksa (cok-cihaz).
  useEffect(() => {
    const token = getToken()
    // saveGame henuz calismadi (hydrated=false) -> localStorage TAZE. Dogrudan oku.
    const local = loadGame()
    const localActive =
      !!local &&
      local.mode !== 'online' &&
      !matchWinner(local.match) &&
      (local.turnsPlayed > 0 || !!local.gameEnd)
    const finish = () => {
      hydratedRef.current = true // artik saveGame yazabilir
      setAuthChecked(true)
    }
    if (!token) {
      if (local) applySavedGame(local) // misafir: yerel oyunu geri yukle
      finish()
      return
    }
    let cancelled = false
    ;(async () => {
      let u: ServerUser
      try {
        u = await meWithRetry(() => cancelled)
      } catch (e) {
        // YALNIZ 401 (gecersiz/suresi dolmus token) oturumu kapatir. Eskiden HER hata token'i
        // siliyordu -> internet kopukken/502'de acilan sayfa kullaniciyi login'e atiyordu.
        // Ag/sunucu hatasinda token KORUNUR; asagidaki effect baglanti gelince oturumu getirir.
        if (isAuthRejected(e)) await apiLogout()
        if (!cancelled) finish()
        return
      }
      try {
        if (cancelled) return
        setUser(u)
        // Online oyundayken F5: lobiye düşürme; sunucuda HÂLÂ aktif olan odaya OTOMATİK dön
        // (inGame=true -> gerçekten oyun görünümündeydi; record.uid=oda kodu, record.online=true).
        // Aktif değilse (maç bitti/terk) normal akışa düşer -> lobi. rejoinRoom banner ile aynı yol.
        if (local && local.mode === 'online' && local.inGame === true && local.record && local.record.online && local.record.uid) {
          const code = local.record.uid
          const rooms = await myActiveRooms().catch(() => [] as ActiveRoom[])
          if (cancelled) return
          const rm = rooms.find((r) => r.code === code)
          if (rm) {
            rejoinRoom(rm)
            return
          }
          // SUNUCU-OTORİTER BOT: bot odaları myActiveRooms'tan HARİÇ tutulur (banner'da görünmesin).
          // Bu yüzden refresh/ikinci sekmede rm=undefined kalır -> rejoin edilmez -> room=null ->
          // poll effect'i `if (!online || !room) return` ile ANINDA çıkar -> sekme eski server_state'te
          // DONAR ("iki pencere farklı state"). Bot odasını doğrudan koddan çek: hâlâ oynanan bir bot
          // maçıysa rejoin et (poll yeniden bağlanır -> güncel server_state'e YAKALAR + bot turlarını uygular).
          const rv = await showRoom(code).catch(() => null)
          if (cancelled) return
          if (rv && rv.bot && rv.status === 'playing') {
            rejoinRoom({
              code,
              slot: local.record.slot,
              opp_name: rv.p2_name ?? '',
              opp_rating: rv.p2_rating ?? null,
              opp_avatar: rv.p2_avatar ?? null,
              target: rv.target ?? local.record.target ?? 1,
              score: null,
              bot: true,
              bot_level: rv.bot_level ?? null,
            })
            return
          }
        }
        if (localActive) {
          applySavedGame(local!) // taze yerel aktif oyun -> sunucuyu bekleme/ezdirme
          return
        }
        const g = await loadServerGame().catch(() => null)
        if (cancelled) return
        if (g) applySavedGame(g as SavedGame)
        else if (local) applySavedGame(local) // sunucuda yoksa yerele dus
      } catch {
        /* oyun geri yukleme hatasi oturumu DUSURMEZ (kullanici zaten dogrulandi) */
      } finally {
        if (!cancelled) finish()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Acilista ag yoktu/sunucu cevap vermedi (token duruyor ama user cozulmedi): baglanti
  // gelince ('online') ve periyodik olarak oturumu sessizce geri yukle. 401 -> token temizlenir.
  useEffect(() => {
    if (!authChecked || user || !getToken()) return
    let stop = false
    const retry = () => {
      if (stop || !getToken()) return
      apiMe()
        .then((u) => {
          if (!stop && getToken()) setUser(u)
        })
        .catch((e) => {
          if (isAuthRejected(e)) {
            stop = true
            void apiLogout()
          }
        })
    }
    window.addEventListener('online', retry)
    const id = window.setInterval(retry, 15000)
    return () => {
      stop = true
      window.removeEventListener('online', retry)
      window.clearInterval(id)
    }
  }, [authChecked, user])

  // Giris yapmissa oyunu sunucuya da kaydet (debounce)
  useEffect(() => {
    if (!user) return
    const timer = window.setTimeout(() => {
      saveServerGame({ mode, difficulty, match, starter, turnsPlayed, turnStart, played }).catch(
        () => {},
      )
    }, 800)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode, difficulty, match, starter, turnsPlayed, turnStart, played])

  // Tema (koyu/acik) + board rengi -> DOM'a uygula ve kaydet
  useEffect(() => {
    const root = document.documentElement
    // Eski id -> yeni id gecisi (rename edilen boardlar): bir kez tasit
    if (!ALL_THEMES.some((x) => x.id === boardTheme) && BOARD_ID_MIGRATE[boardTheme]) {
      setBoardTheme(BOARD_ID_MIGRATE[boardTheme])
      return
    }
    root.setAttribute('data-theme', theme)
    root.setAttribute('data-board', boardTheme)
    const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
    // Kulup boardlari: oyun yuzeyini (panel + ucgenler) HAFIF pastel yap (hue korunur,
    // %15 beyaz karisim) -> pullar daha da ayrisir; renk kimligi bozulmaz. Pul/cerceve haric.
    const surf = (c: string) =>
      bt.rarity === 'club' ? `color-mix(in srgb, ${c} 85%, white)` : c
    root.style.setProperty('--panel', surf(bt.panel))
    root.style.setProperty('--tri-a', surf(bt.a))
    root.style.setProperty('--tri-b', surf(bt.b))
    root.style.setProperty('--navy', bt.checker) // koyu pul temaya uyar
    // Cerceve + acik pul: tema verirse uygula, yoksa temizle (CSS varsayilanina don)
    if (bt.frame) root.style.setProperty('--bar', bt.frame)
    else root.style.removeProperty('--bar')
    if (bt.light) root.style.setProperty('--cream', bt.light)
    else root.style.removeProperty('--cream')
    // Zar arka planlari: tema ozel verir; yoksa acik/koyu pul rengine duser (CSS fallback)
    const dieVars: [string, string | undefined][] = [
      ['--die1-bg', bt.d1Bg], ['--die1-pip', bt.d1Pip],
      ['--die2-bg', bt.d2Bg], ['--die2-pip', bt.d2Pip],
    ]
    for (const [k, v] of dieVars) {
      if (v) root.style.setProperty(k, v)
      else root.style.removeProperty(k)
    }
    // Kup HER ZAMAN temaya uyar: ozel verilmezse aksan point rengi (a), metin luminance'a gore
    const cubeBg = bt.cubeBg ?? bt.a
    const cubeText = bt.cubeText ?? (hexLum(cubeBg) > 150 ? '#161616' : '#ffffff')
    root.style.setProperty('--cube-bg', cubeBg)
    root.style.setProperty('--cube-text', cubeText)
    // Pul stili (flat/gloss/ice/ring/neon) + yuzey motifi (plain/gradient/felt)
    // -> data-attribute; CSS bunlara gore pul/yuzey gorunumunu degistirir.
    root.setAttribute('data-checker', bt.checkerStyle ?? 'flat')
    root.setAttribute('data-surface', bt.surface ?? 'plain')
    root.setAttribute('data-point-style', bt.pointStyle ?? 'sharp') // hane sekli: sivri/yuvarlak
    // Özel tahta hane resimleri (tek = shade-a, çift = shade-b): CSS değişkeni + işaret attribute'u.
    for (const [k, v, fit] of [['a', bt.pointImgA, bt.pointFitA], ['b', bt.pointImgB, bt.pointFitB]] as const) {
      // Yerleşim: sayılar kökte (boyut hesabı .point::before'da --col/--tri-h ile yapılır)
      const vars: [string, string | null][] = [
        [`--pt-img-${k}`, v ? `url("${v}")` : null],
        [`--pt-${k}-x`, v && fit ? String(fit.x) : null],
        [`--pt-${k}-y`, v && fit ? String(fit.y) : null],
        [`--pt-${k}-zoom`, v && fit ? String(fit.zoom / 100) : null],
        [`--pt-${k}-aspect`, v && fit?.aspect ? String(fit.aspect) : null],
      ]
      for (const [name, val] of vars) {
        if (val != null) root.style.setProperty(name, val)
        else root.style.removeProperty(name)
      }
      if (v) root.setAttribute(`data-pt-img-${k}`, '')
      else root.removeAttribute(`data-pt-img-${k}`)
    }
    // Tam resim modu: her hanenin kendi resmi -> hane başı CSS kuralı (data-point = 0..23 sıra).
    // URL'ler safeImgUrl ile doğrulandı (tırnak/parantez yok); sayılar safeFit ile sınırlı.
    {
      let el = document.getElementById('pt-each-style') as HTMLStyleElement | null
      const imgs = bt.pointImgs ?? {}
      const ns = Object.keys(imgs).map(Number)
      if (ns.length) {
        if (!el) {
          el = document.createElement('style')
          el.id = 'pt-each-style'
          document.head.appendChild(el)
        }
        el.textContent = ns
          .map((n) => {
            const f = bt.pointFits?.[n] ?? { x: 50, y: 50, zoom: 100 }
            const tri = n % 2 ? 'var(--tri-a)' : 'var(--tri-b)'
            const size = `calc(max(var(--col), calc(var(--tri-h) * ${f.aspect ?? 0})) * ${f.zoom / 100}) auto`
            return `html[data-pt-each] .point[data-point="${n - 1}"]::before{background:url("${imgs[n]}") ${f.x}% ${f.y}% / ${size} no-repeat,${tri}}` +
              `html[data-pt-each] .point.bottom[data-point="${n - 1}"]::before{clip-path:polygon(0 0,100% 0,50% 100%);transform:translateX(-50%) rotate(180deg)}`
          })
          .join('\n')
        root.setAttribute('data-pt-each', '')
      } else {
        el?.remove()
        root.removeAttribute('data-pt-each')
      }
    }
    // Tahta zemin resmi (sol/sağ yarı, üçgenlerin ALTINDA) + şeffaflık. URL'ler safeImgUrl ile doğrulandı.
    {
      const sl = bt.surfaceImgLeft
      const sr = bt.surfaceImgRight
      if (sl || sr) {
        root.style.setProperty('--surf-img-left', sl ? `url("${sl}")` : 'none')
        root.style.setProperty('--surf-img-right', sr ? `url("${sr}")` : 'none')
        root.style.setProperty('--surf-opacity', String((bt.surfaceOpacity ?? 100) / 100))
        root.setAttribute('data-surf-img', '')
      } else {
        root.style.removeProperty('--surf-img-left')
        root.style.removeProperty('--surf-img-right')
        root.style.removeProperty('--surf-opacity')
        root.removeAttribute('data-surf-img')
      }
    }
    root.setAttribute('data-board-rarity', bt.rarity ?? 'common') // kulup board: pullara gumus halka
    // Maritime board: 12 sinyal flamasini CSS degiskeni olarak yaz. Ust/alt hane AYRI varyant
    // (--naut-<dp> = ust, --naut-<dp>-b = alt) -> motif DAIMA tabanda (rail), distort YOK.
    // Diger boardlarda temizle (bayat degisken kalmasin). Tek kaynak: src/nauticalFlags.ts.
    for (let dp = 1; dp <= 23; dp += 2) {
      const top = boardTheme === 'nautical' ? NAUTICAL_FLAG_TOP_BY_DP[dp] : undefined
      const bot = boardTheme === 'nautical' ? NAUTICAL_FLAG_BOTTOM_BY_DP[dp] : undefined
      if (top) root.style.setProperty(`--naut-${dp}`, `url("${top}")`)
      else root.style.removeProperty(`--naut-${dp}`)
      if (bot) root.style.setProperty(`--naut-${dp}-b`, `url("${bot}")`)
      else root.style.removeProperty(`--naut-${dp}-b`)
    }
    // Watermark rengi: board zemini acik -> koyu yazi, koyu -> acik yazi. Ulke boardlarinda
    // orta yazi (ulke adi) TASARIMIN merkezi -> biraz daha belirgin (~%16, yine taslari engellemez);
    // digerlerinde cok soluk (0.075-0.09). Isik/koyu esigi panel luminance'ina gore.
    const wmLight = hexLum(bt.panel) > 150
    const wmAlpha = bt.rarity === 'country' ? (wmLight ? '0.16' : '0.15') : wmLight ? '0.09' : '0.075'
    root.style.setProperty(
      '--wm-color',
      wmLight ? `rgba(12,18,45,${wmAlpha})` : `rgba(255,255,255,${wmAlpha})`,
    )
    try {
      localStorage.setItem('tavla.theme', theme)
      localStorage.setItem('tavla.board', boardTheme)
    } catch {
      /* yok */
    }
  }, [theme, boardTheme, boardDesignsRev])

  // Lobiye girildiginde aktif turnuvalari cek (bitmis olanlar haric)
  useEffect(() => {
    if (!home) return
    let cancelled = false
    listTournaments()
      .then((ts) => {
        if (!cancelled) setLobbyTourns(ts.filter((x) => x.status !== 'finished'))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [home])

  const working = useMemo(() => applyPlayed(turnStart, played), [turnStart, played])
  const resultShowingRef = useRef(false)
  // Lobide/menüde miyiz (home). Uçuştaki bir serverMove/serverRoll/botNudge yanıtı, kullanıcı
  // maçtan ÇIKTIKTAN sonra resolve olup applyBotTurn -> playDice çağırabilir (kullanıcı raporu:
  // "maçtan çıkınca zar atma sesi geliyor"). O yanıt eski render'ın stale closure'ını taşıdığından
  // playDice içinde `home`'u DOĞRUDAN okumak güvenilmez -> ref'e aynala (resultShowingRef deseni).
  const inLobbyRef = useRef(false)
  // Zar sesini SADECE oyun-içi atışta çal; sonuç/maç-sonu ekranı açıkken VEYA lobide isek bastır.
  const playDice = () => {
    if (resultShowingRef.current || inLobbyRef.current) return
    Sound.dice()
  }
  const gameWon = winner(working) !== null
  const mWinner = matchWinner(match)
  const matchOver = mWinner !== null
  // Sonuç/maç-sonu ekranı açıkken OTOMATİK zar sesi ÇALMASIN. Bot maçı sunucu-otoriter olduğundan
  // oyun bittikten sonra gelen bayat bir poll/nudge yanıtı bot turu içerince applyBotTurn koşulsuz
  // playDice() çalıyordu -> kullanıcı raporu "oyun bitince zar sesi geliyor". playDice() bu kapıya
  // bakar; gerçek oyun-içi atışlarda (gameEnd/gameWon henüz false) normal çalar.
  resultShowingRef.current = gameEnd != null || matchOver || gameWon
  inLobbyRef.current = home // maçtan çıkınca uçuştaki yanıtın zar sesini çalmasını engelle
  const diceRolled = turnStart.dice.length > 0
  const isBotTurn = mode === 'pvb' && turnStart.turn === BOT_PLAYER
  const online = mode === 'online' && room !== null
  // BOT MAÇI: eski yerel pvb (SERVER_BOT=false) VEYA sunucu-otoriter bot odası (mode='online' +
  // room.bot). Canlı PR / analiz gösterimi ikisinde de açık olmalı; SERVER_BOT geçişinden önce
  // yalnız `mode==='pvb'` kontrol ediliyordu -> otoriter bot maçında canlı PR "—" kalıyordu.
  const botMatch = mode === 'pvb' || (online && !!room?.bot)
  // PARA OYUNU (Tek Oyun): online + sabit bahis (stake>0, % bahis değil) + tek oyun (target≤1).
  // Küp CANLI (coin stake×küp×gammon ile ölçeklenir); cubeAvailability/shouldAutoRoll'a geçilir.
  const isMoneyGame = online && stakeRef.current > 0 && betPctRef.current === 0 && match.target <= 1

  // Oynadigin online macin IZLEME linkini adres cubugunda goster: /izle/<KOD>. Kopyalanip
  // paylasilinca baskalari maci canli izler. replaceState -> geri tusu/yeniden-baglanmayi bozmaz.
  // Izleyici (spectate) URL'yi zaten applyFromPath'ten alir -> dokunma. Bot odasi izlenemez -> atla.
  useEffect(() => {
    if (spectate) return
    const watchCode = online && !room?.bot ? room?.code : null
    if (watchCode) {
      const path = '/izle/' + watchCode
      if (window.location.pathname !== path) window.history.replaceState(null, '', path)
    } else if (window.location.pathname.startsWith('/izle/')) {
      window.history.replaceState(null, '', '/')
    }
  }, [online, room?.code, room?.bot, spectate])

  // TURNUVA MACI HAZIR -> POPUP YOK, DOĞRUDAN maça al. ping'teki tournament_matches'ten gelen
  // yeni (görülmemiş) maça anında girilir. Zaten o maçtaysak (tournMatchRef) tekrar girmeyiz;
  // başka (turnuva dışı) maçtaysak NO-CONTEST kapatıp geçeriz. enteredNoticeRef kısa async pencerede
  // çift-girişi önler; giriş başarısız olursa catch sıfırlar -> sonraki poll tekrar dener. Kopma/
  // reload sonrası ping bildirimi (maç bitene dek sürer) oyuncuyu otomatik geri alır.
  useEffect(() => {
    const tm = tournMatchRef.current
    const n = tournNotices.find(
      (x) =>
        enteredNoticeRef.current !== `${x.tid}-${x.match}` &&
        !(tm && tm.tid === x.tid && tm.matchKey === x.match),
    )
    if (!n) return
    enteredNoticeRef.current = `${n.tid}-${n.match}`
    if (online && !matchOver) void leaveCurrentAndEnterTourn(n.tid, n.match, n.oppId)
    else void handlePlayTournamentMatch(n.tid, { key: n.match }, n.oppId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournNotices, online, matchOver])

  const myColor: Player = room?.slot === 'p2' ? 'black' : 'white'
  // Online'da siyah oyuncu tahtayi 180 cevrilmis gorur (kendi taslari altta)
  const flipBoard = online && myColor === 'black'
  // Saat, kurulumda bir sure secildiyse (kapali degilse) calisir
  const clockOn = true // Galaxy tarzi: her oyunda saat acik (3 preset)
  // Hazırlık gate'i saf isOnlineReady'de (authSync); testli. p2 authoritative bug'ı orada belgeli.
  const onlineReady = isOnlineReady({
    online,
    status: room?.status,
    slot: room?.slot,
    oppStarted,
    authoritative: room?.authoritative,
  })
  const myTurn = online ? turnStart.turn === myColor : !isBotTurn
  const interactive =
    !home && // LOBİDE tahta etkileşimi YOK: aksi halde AI maçından çıkıp ana sayfaya dönünce taze
    // pvb tahtası (myTurn + zarsız + turns=0) auto-roll effect'ini tetikleyip FANTOM zar atıyordu
    // (kullanıcı raporu: "yapay zeka ile maçtan çıkıp ana sayfaya tıklayınca zar sesi geliyor").
    onlineReady &&
    myTurn &&
    !gameWon &&
    gameEnd === null &&
    !matchOver &&
    cubePending === null &&
    !opening
  // Tahtada gösterilecek durum: kendi turumda `working`; RAKİP turunda canlı önizleme varsa
  // turnStart + rakip adımları (adım adım animasyonla dolar) -> rakip oynarken/geri alırken görürsün.
  // §5.2 REPLAY aktifse tahta otoriter `base`+oynatılan adımlar; değilse canlı önizleme (oppLive);
  // o da yoksa otoriter `working`. Replay cosmetic: bitince `working`'e (otoriter sonuç) döner.
  const boardDisplay = oppReplay
    ? applyPlayed(oppReplay.base, oppReplay.steps.slice(0, oppReplay.shown))
    : online && !myTurn && oppLive.length > 0
      ? applyPlayed(turnStart, oppLive)
      : working

  // SAVUNMA KALKANI (vaka N7DNY): istemci bir kare GEÇERSİZ tahta tutarsa — bar+off dahil
  // toplam 15 beyaz / 15 siyah DEĞİLSE — bu geçici bir state bozulmasıdır (mobilde görüldü:
  // beyaz taşlar siyah/yanlış hanede). Renk doğrudur, altındaki state bozuktur. O çöp kareyi
  // kalıcı göstermek yerine otoriter server_state'i yeniden uygulat (appliedServerVersionRef=-1
  // -> poll re-apply). Döngü koruması: aynı bozulmada en çok 3 resync; geçerliye dönünce sıfırla.
  useEffect(() => {
    if (!online || !room?.authoritative || gameEnd || matchOver) return
    let w = boardDisplay.bar.white + boardDisplay.off.white
    let b = boardDisplay.bar.black + boardDisplay.off.black
    for (const v of boardDisplay.points) {
      if (v > 0) w += v
      else if (v < 0) b -= v
    }
    if (w === 15 && b === 15) {
      invalidBoardResyncRef.current = 0
      return
    }
    if (invalidBoardResyncRef.current >= 3) return // otoriter de bozuksa sonsuz döngüye girme
    invalidBoardResyncRef.current++
    appliedServerVersionRef.current = -1 // poll otoriter (doğru) durumu geri yükler
  }, [boardDisplay, online, room?.authoritative, gameEnd, matchOver])

  // ===== KURŞUN GEÇİRMEZ MAÇ BAŞLANGICI =====
  // "Oyun ekranına girdim ama board hiç yüklenmedi / mavi ekranda kaldım" bir daha ASLA sessiz
  // takılmaya dönmesin. Geçerli bir tavla pozisyonu DAİMA 15 beyaz + 15 siyah'tır (açılış dahil);
  // board bu ölçüde değilse YÜKLENMEMİŞ/BOZUK demektir. online maçta board sürekli geçersiz kalırsa:
  //  6sn -> sert resync (poll otoriter durumu yeniden uygula), 14sn -> GÖRÜNÜR kurtarma ekranı
  //  (Tekrar Dene / Sayfayı Yenile). Normal oyunda board hep 15/15 -> hiç tetiklenmez (false-positive yok).
  const boardBadSinceRef = useRef<number | null>(null)
  const startHardResyncRef = useRef(false)
  const [startStuck, setStartStuck] = useState(false)
  useEffect(() => {
    if (!online || gameEnd || matchOver || !room?.code) {
      boardBadSinceRef.current = null
      startHardResyncRef.current = false
      setStartStuck(false)
      return
    }
    let w = boardDisplay.bar.white + boardDisplay.off.white
    let b = boardDisplay.bar.black + boardDisplay.off.black
    for (const v of boardDisplay.points) {
      if (v > 0) w += v
      else if (v < 0) b -= v
    }
    if (w === 15 && b === 15) {
      boardBadSinceRef.current = null
      startHardResyncRef.current = false
      setStartStuck(false)
    } else if (boardBadSinceRef.current == null) {
      boardBadSinceRef.current = Date.now()
    }
  }, [boardDisplay, online, gameEnd, matchOver, room?.code])
  useEffect(() => {
    if (!online || !room?.code) return
    const id = window.setInterval(() => {
      const since = boardBadSinceRef.current
      if (since == null) return
      const bad = Date.now() - since
      if (bad > 6000 && !startHardResyncRef.current) {
        startHardResyncRef.current = true
        invalidBoardResyncRef.current = 0 // 3-resync kilidini aç -> otoriter durumu tekrar iste
        appliedServerVersionRef.current = -1
      }
      if (bad > 14000) setStartStuck(true)
    }, 2000)
    return () => window.clearInterval(id)
  }, [online, room?.code])

  const nextSteps = useMemo(
    () => (diceRolled && !gameWon ? legalNextSteps(turnStart, played) : []),
    [turnStart, played, diceRolled, gameWon],
  )

  const selectableFroms = useMemo(() => {
    const set = new Set<number | 'bar'>()
    if (!interactive) return set
    for (const st of nextSteps) set.add(st.from)
    return set
  }, [nextSteps, interactive])

  // Secili tasin (1+ zarla, birlesik dahil) ulasabilecegi hedefler -> step dizisi
  const dragTargets = useMemo(() => {
    if (!interactive || selectedFrom === null) return new Map<number | 'off', Step[]>()
    return reachableFromChecker(turnStart, played, selectedFrom)
  }, [interactive, selectedFrom, turnStart, played])

  const targets = useMemo(() => new Set(dragTargets.keys()), [dragTargets])

  const remainingDice = useMemo(() => {
    const dice = turnStart.dice.slice()
    for (const st of played) {
      const idx = dice.indexOf(st.die)
      if (idx >= 0) dice.splice(idx, 1)
    }
    return dice
  }, [turnStart, played])

  // freshBank=true: yeni MAC -> rezerv bankasi bastan dolar.
  // freshBank=false: mac ici SONRAKI oyun -> rezerv bankasi korunur (Galaxy: mac-basi saat),
  //   sadece hamle gecikmesi sifirlanir.
  // bankTarget: rezerv bankasi HANGI mac uzunluguna gore dolsun. VARSAYILAN `match.target`
  // STALE'dir (setMatch ayni render'da state'i degistirmez) -> yeni mac baslatan cagirici
  // hedefi ACIKCA gecmelidir; aksi halde 9'luk mactan 3'luk maca gecerken saat 9 dk kalirdi.
  function resetGameUi(freshBank = true, bankTarget = match.target) {
    setPlayed([])
    setSelectedFrom(null)
    setCubePending(null)
    setGameEnd(null)
    setLastError(null)
    setRanked(null)
    setCurrentProbs(null)
    setTurnsPlayed(0)
    setOpening('roll') // her yeni oyun acilis atisiyla baslar
    setOpeningResult(null)
    if (freshBank) {
      setClock(freshMatchClock(bankTarget))
    } else {
      setClock((c) => ({ ...c, delay: clockRef.current.move }))
    }
    ratingReportedRef.current = false // yeni mac -> puan tekrar islenebilir
    setServerPr(null) // yeni mac -> onceki sunucu-PR'i gosterme
    prPollRef.current++ // aktif gnubg PR poll'unu iptal et
    setPrAnalyzing(false)
    setOppPrPending(false)
    setServerLuck(null) // yeni mac -> onceki sunucu-sansini gosterme
    setServerLuckMwc(null) // yeni mac -> onceki gnubg MWC-sansini gosterme
    setServerLuckEmg(null)
    setServerLuckJokers(null)
  }

  // PR: bu hamlede wildbg'ye gore kaybedilen equity'yi kaydet (senkron; tur basi analizini kullanir)
  function recordPR(before: GameState, steps: Step[]) {
    if (steps.length === 0) return
    const mover = before.turn
    const moves = generateMoves(before)
    const seq = turnsPlayed // bu turun sirasi (async bot kaydinda korunur)
    if (moves.length <= 1) {
      // Zorunlu/tek hamle -> karar SAYILMAZ (PR paydasına girmez). Debug modunda yine de logla
      // ki "forced rolls" sayısı görünsün (§13; kapalıyken sıfır maliyet).
      if (prDebugEnabled()) {
        const n = moveNotation({ steps, resultKey: '' }, mover)
        prDebugRecord({ player: mover, turn: seq, dice: [...(before.dice ?? [])], played: n, best: n, bestEquity: 0, playedEquity: 0, equityLoss: 0, forced: true, countedInPR: false })
      }
      return
    }
    // Money (coin) oyunu -> 1-puanlik maç ×1.5 faktörü UYGULANMAZ (yalniz gerçek 1-puanlik MAÇ).
    const isMoney = stakeRef.current > 0
    // Bot (pvb'de siyah): secilen hamlenin gercek equity kaybi (XG-style, analiz .then icinde)
    if (mode === 'pvb' && mover === BOT_PLAYER) {
      // Botun (rakip) hamlesini de analize kaydet: siralamayi arka planda hesapla.
      // INSAN daliyla SIMETRIK: pendingAnalysisRef ile izlenir + retry'li. (1) Mac-sonu flush
      // bu analizi BEKLER -> black kayitlari GONDERILEN log'a girer; eskiden izlenmiyordu ->
      // black entry'ler log'a gec kalip gnubg botu skorlayamiyordu -> "bot PR 0.00" bug'i.
      // (2) Gecici WASM hatasinda (analyzeMoves []) bot karari DUSMESIN diye birkac kez dener.
      const playedKey = boardKey(applyPlayed(before, steps))
      pendingAnalysisRef.current++
      const analyzeBotWithRetry = async (): Promise<RankedMove[]> => {
        let rk: RankedMove[] = []
        for (let i = 0; i < 5 && rk.length === 0; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 300))
          try {
            rk = await neuralRef.current.analyzeMoves(before)
          } catch {
            rk = []
          }
        }
        return rk
      }
      analyzeBotWithRetry()
        .then((ranks) => {
          if (ranks.length === 0) return
          const pl = ranks.find((r) => r.move.resultKey === playedKey) ?? ranks[0]
          // XG-style: obvious eleme; PR yalniz sayilan kararlardan. 1-puanlik macta equity =
          // win-prob (gammon alakasiz) -> best/worst win-prob'a gore (prMatchEquity). Cok-puanlik/
          // money'de money equity (ranks zaten money'ye gore sirali -> davranis AYNI).
          const prEqB = (r: RankedMove) => prMatchEquity(r.probs, r.equity, match.target, isMoney)
          const dec = checkerDecision(
            Math.max(...ranks.map(prEqB)),
            prEqB(pl),
            Math.min(...ranks.map(prEqB)),
            moves.length,
            match.target,
            isMoney,
          )
          if (prDebugEnabled()) {
            prDebugRecord({
              player: mover, turn: seq, dice: [...before.dice],
              played: moveNotation(pl.move, mover), best: moveNotation(ranks[0].move, mover),
              bestEquity: prEqB(ranks[0]), playedEquity: prEqB(pl),
              equityLoss: dec.normalizedEquityLoss, forced: false, countedInPR: dec.countsForPR,
            })
          }
          setPrStats((s) => ({
            ...s,
            black: {
              ...s.black,
              loss: s.black.loss + (dec.countsForPR ? dec.prAdjustedEquityLoss : 0),
              decisions: s.black.decisions + (dec.countsForPR ? 1 : 0),
              allLoss: (s.black.allLoss ?? 0) + dec.prAdjustedEquityLoss,
              allDecisions: (s.black.allDecisions ?? 0) + 1,
            },
          }))
          // Bot luck (sans): aktuel en iyi equity - 21 zarin beklenen en iyisi (tur basi bir kez).
          // Eskiden bot luck HIC hesaplanmiyordu -> ŞANS pvb'de hep 0 kaliyordu.
          const luckKey = `${mover}:${seq}`
          if (luckKey !== luckSigRef.current) {
            luckSigRef.current = luckKey
            const actualBest = ranks[0].equity
            neuralRef.current
              .expectedBestEquity(before, mover)
              .then((expEq) => setPrLuck((s) => ({ ...s, [mover]: s[mover] + (actualBest - expEq) })))
              .catch(() => {})
          }
          if ((ranks[0].probs?.length ?? 0) < 6) return // matchLog detayi icin probs sart
          const cands = ranks.slice(0, 5).map((r) => ({
            notation: moveNotation(r.move, mover),
            equity: r.equity,
            steps: r.move.steps,
          }))
          setMatchLog((log) => [
            ...log,
            {
              notation: moveNotation(pl.move, mover),
              best: moveNotation(ranks[0].move, mover),
              loss: dec.normalizedEquityLoss,
              pos: before,
              steps: ranks[0].move.steps,
              playedSteps: pl.move.steps,
              player: mover,
              dice: [...before.dice],
              cands,
              probs: pl.probs,
              seq,
              countsForPR: dec.countsForPR,
              prAdjustedEquityLoss: dec.prAdjustedEquityLoss,
              mctx: {
                score: match.score,
                cube: match.cube.value,
                cubeOwner: match.cube.owner,
                crawford: match.isCrawford,
                matchLen: match.target,
              },
            },
          ])
        })
        .catch(() => {})
        .finally(() => {
          pendingAnalysisRef.current = Math.max(0, pendingAnalysisRef.current - 1)
        })
      return
    }
    // Insan: hamlenin gercek equity kaybini NEURAL siralamayla kaydet.
    // Onemli: tur basi siralama (turnRankedRef) async oldugundan hizli oynanınca
    // (ozellikle otomatik zar) hazir olmayabilir. O yuzden hazirsa hizli yol,
    // degilse HER ZAMAN arka planda yeniden analiz ederek kaydi garanti et.
    const humanColor: Player = online ? myColor : 'white'
    const playedKey = boardKey(applyPlayed(before, steps))
    const record = (ranks: RankedMove[]) => {
      // PR/luck icin equity YETERLIDIR; probs (kazanma%) sadece basarim/rapor detayi.
      // Eskiden probs<6 ise TUM kayit dusuyordu -> analiz eksikse PR "—", luck 0 kaliyordu.
      if (ranks.length === 0) return
      const pl = ranks.find((r) => r.move.resultKey === playedKey) ?? ranks[0]
      // XG-style karar: obvious eleme (src/analysis/pr TEK KAYNAK). 1-puanlik macta equity =
      // win-prob (gammon alakasiz; prMatchEquity) -> XG hizalama; cok-puanlik/money'de money equity
      // (ranks money'ye gore sirali -> best=ranks[0], worst=ranks[last]; davranis AYNI).
      const prEqH = (r: RankedMove) => prMatchEquity(r.probs, r.equity, match.target, isMoney)
      const dec = checkerDecision(
        Math.max(...ranks.map(prEqH)),
        prEqH(pl),
        Math.min(...ranks.map(prEqH)),
        moves.length,
        match.target,
        isMoney,
      )
      const loss = dec.normalizedEquityLoss // log/error-journal ham (1pt faktörsüz) equity kaybı
      if (prDebugEnabled()) {
        prDebugRecord({
          player: mover, turn: seq, dice: [...before.dice],
          played: moveNotation(pl.move, mover), best: moveNotation(ranks[0].move, mover),
          bestEquity: prEqH(ranks[0]), playedEquity: prEqH(pl),
          equityLoss: loss, forced: false, countedInPR: dec.countsForPR,
        })
      }
      // PR yalnız SAYILAN kararlardan (zorunlu/obvious hariç); loss = prAdjusted (1pt faktörlü).
      // STRICT (countsForPR) PR'a girer; ANCAK her non-forced karar all*'a girer (PR "—" olmasın
      // diye garanti yedeği: strict 0 çıkarsa loose kullanılır).
      setPrStats((s) => ({
        ...s,
        [mover]: {
          ...s[mover],
          loss: s[mover].loss + (dec.countsForPR ? dec.prAdjustedEquityLoss : 0),
          decisions: s[mover].decisions + (dec.countsForPR ? 1 : 0),
          allLoss: (s[mover].allLoss ?? 0) + dec.prAdjustedEquityLoss,
          allDecisions: (s[mover].allDecisions ?? 0) + 1,
        },
      }))
      // Sans (luck): bu turun sansi = gercek zarin en iyi equity'si (ranks[0]) - 21 zarin
      // beklenen en iyisi. recordPR promise'i (analiz effect'i gibi) IPTAL EDILMEZ -> hizli
      // oynayinca bile guvenilir birikir. Tur basina bir kez (luckSig).
      const luckKey = `${mover}:${seq}`
      if (luckKey !== luckSigRef.current) {
        luckSigRef.current = luckKey
        const actualBest = ranks[0].equity
        neuralRef.current
          .expectedBestEquity(before, mover)
          .then((expEq) => setPrLuck((s) => ({ ...s, [mover]: s[mover] + (actualBest - expEq) })))
          .catch(() => {})
      }
      if (mover !== humanColor) return
      // Basarim: insanin gordugu en dusuk kazanma % (oynanan hamle sonrasi) + kurdugu yapi.
      // Kazanma% yalnizca probs varsa anlamli -> analiz eksikse basarim sinyalini bozma.
      if ((pl.probs?.length ?? 0) >= 1) {
        const wp = (pl.probs![0] ?? 1) * 100
        if (wp < achMinWpRef.current) achMinWpRef.current = wp
      }
      const feats = achBoardFeats(applyPlayed(before, steps), humanColor)
      if (feats.prime6) achPrime6Ref.current = true
      if (feats.closeout) achCloseoutRef.current = true
      // Her hamle icin tam analiz verisi: konum, zar, siralı adaylar (equity), kazanma%
      const cands = ranks.slice(0, 5).map((r) => ({
        notation: moveNotation(r.move, mover),
        equity: r.equity,
        steps: r.move.steps,
      }))
      setMatchLog((log) => [
        ...log,
        {
          notation: moveNotation(pl.move, mover),
          best: moveNotation(ranks[0].move, mover),
          loss,
          pos: before,
          steps: ranks[0].move.steps,
          playedSteps: pl.move.steps,
          player: mover,
          dice: [...before.dice],
          cands,
          probs: pl.probs,
          seq,
          // XG-style PR denetim alanları (backend prFromLog bunları toplar; yoksa eski loss'a düşer).
          countsForPR: dec.countsForPR,
          prAdjustedEquityLoss: dec.prAdjustedEquityLoss,
          // Karar anındaki maç bağlamı (match-aware EMG PR için — gnubg orchestrator kullanır).
          mctx: {
            score: match.score,
            cube: match.cube.value,
            cubeOwner: match.cube.owner,
            crawford: match.isCrawford,
            matchLen: match.target,
          },
        },
      ])
    }
    // Hizli yol: tur basi siralama tam ve bu turun konumuna aitse dogrudan kullan
    const pre = turnRankedRef.current
    if (
      pre &&
      pre.length > 0 &&
      (pre[0].probs?.length ?? 0) >= 6 &&
      pre.some((r) => r.move.resultKey === playedKey)
    ) {
      record(pre)
    } else {
      // Async analiz: mac-sonu kaydi bunun bitmesini bekleyebilsin diye say
      pendingAnalysisRef.current++
      ;(async () => {
        // Gecici olarak analyzeMoves BOS ([]) donebilir: (a) sinir agi henuz yuklenmemis
        // (ozellikle macin ilk hamleleri), (b) tek seferlik WASM hatasi. Eskiden bu insan
        // kararini TAMAMEN dusururdu (record 1229'da return) -> kisa macta decisions=0 ->
        // PR "—". Cozum: kisa gecikmelerle birkac kez YENIDEN dene (mac-sonu flush'i
        // pendingAnalysisRef'i bekler; ag yuklenince retry basarili). Karar ASLA dusmez.
        let ranks: RankedMove[] = []
        for (let i = 0; i < 5 && ranks.length === 0; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 300))
          try {
            ranks = await neuralRef.current.analyzeMoves(before)
          } catch {
            ranks = []
          }
        }
        if (ranks.length === 0) {
          // Son care (nadir): klasik (heuristik) degerlendirme. Pip-olcegini nöral equity
          // olcegine (~[-3,3]) tanh ile SIKIStIR ki PR sisip absurd olmasin.
          ranks = generateMoves(before)
            .map((move) => ({
              move,
              equity: Math.tanh(evaluatePosition(applyPlayed(before, move.steps), mover) / 50),
              probs: [] as number[],
            }))
            .sort((a, b) => b.equity - a.equity)
        }
        record(ranks)
      })()
        .catch(() => {})
        .finally(() => {
          pendingAnalysisRef.current = Math.max(0, pendingAnalysisRef.current - 1)
        })
    }
  }

  function commitTurn(finalPlayed: Step[]) {
    // pvb: INSAN (beyaz) bu turu commit etti -> hayalet-mac kalkani sayaci. Bot (siyah) turlari
    // ve online sayilmaz. 0 iken mac-sonu kaydi maci YAZMAZ (bkz humanTurnsRef aciklamasi).
    if (mode === 'pvb' && turnStart.turn === 'white') humanTurnsRef.current += 1
    // Her oyuncunun hamlesini PR'a ekle (online'da sadece kendi hamlelerim gecer)
    void recordPR(turnStart, finalPlayed)
    // Maç kaydı: bu turu (zar + hamle) logla (turnStart = hamle ONCESI durum).
    recordMatchTurn(turnStart, finalPlayed)
    // .mat TUR-SIRASI DOLGUSU: recordPR ZORUNLU (tek legal hamle) ve OYNANAMAYAN (dance) turlari
    // matchLog'a YAZMAZ. O turlarin zari .mat'te kaybolursa (ozellikle bear-off sonunda benim
    // zorunlu toplamalarim) XG sutun almasigi bozulur ve son hamleler parse edilmez. Cozum: bu
    // turlar icin hafif "fill" girdisi ekle (analiz YOK; zar + hamle sirasi korunur). native
    // buildMat ve backend (MatBuilder/PR) fill'i SUZER -> gnubg luck/PR DEGISMEZ; yalniz XG kullanir.
    {
      const mover = turnStart.turn
      const skippedByPR = finalPlayed.length === 0 || generateMoves(turnStart).length <= 1
      if (skippedByPR) {
        const notation = moveNotation({ steps: finalPlayed, resultKey: '' }, mover)
        setMatchLog((l) => [
          ...l,
          {
            notation,
            best: '',
            loss: 0,
            pos: cloneState(turnStart),
            steps: finalPlayed,
            playedSteps: finalPlayed,
            player: mover,
            dice: (turnStart.dice ?? []).slice(0, 2),
            seq: turnsPlayed,
            countsForPR: false,
            fill: true,
          },
        ])
      }
    }

    // ---- OTORİTER (Faz 2): SUNUCU = tek gerçek kaynak ----
    // Hamleyi sunucuya gönder; DÖNEN otoriter durumu (turn devri + skor + küp) uygula.
    // Optimistik yerel flip YOK -> istemci sunucudan sapmaz (desync/kilit önlenir). Sunucu
    // reddederse (yasadışı/erişimsiz) gerçek sebebi göster + poll ile otoriter duruma dön.
    if (online && authoritativeRef.current && room?.code) {
      if (moveInFlightRef.current) return // mükerrer commit yok
      // ZAR YOKKEN HAMLE YOLLAMA (kök fix "Önce zar at"): sıra bende ama turnStart'ta zar yoksa
      // (bot turundan sonra henüz atmadım / kısa desync) hamleyi SUNUCUYA YOLLAMA. Yoksa sunucu
      // "Önce zar at." (409) döner ve kullanıcı "zar atmadan taşa tıklayınca" saçma mesaj görür.
      // Bunun yerine SESSİZCE resync: appliedServerVersionRef=-1 poll'u tetikler -> doğru sıra+zar gelir.
      if (turnStart.dice.length === 0) {
        appliedServerVersionRef.current = -1
        return
      }
      moveInFlightRef.current = true
      // ANINDA geri bildirim: bot maçında Onayla'ya basılır basılmaz butonu kapat + "düşünüyor"
      // göster (sunucu/gnubg yanıtı beklenmeden). Sıra botta -> onun düşünmesi doğaldır.
      if (botMatch) setBotThinking(true)
      else setMoveSending(true) // insan maçı: buton "Gönderiliyor…" + disabled (yanıt gelene kadar)
      setSelectedFrom(null)
      setRanked(null)
      setCurrentProbs(null)
      const code = room.code
      // React'teki room.server_version polling nedeniyle bir render geriden gelebilir.
      // Otoriter hamlelerde gerçek son senkron sürümünü kullan; aksi halde sunucu
      // eski sürümle gelen hamleyi reddedip istemciyi tekrar senkronizasyona sokar.
      const expectedServerVersion =
        appliedServerVersionRef.current >= 0 ? appliedServerVersionRef.current : (room.server_version ?? 0)
      const moveKey = `${code}:${expectedServerVersion}:${JSON.stringify(finalPlayed)}`
      // Aynı render yarışında aynı tur iki kez gönderilirse ilk istek zarları
      // tüketir; ikinci istek gereksiz "Önce zar at" 409'u üretir.
      if (isDuplicateSubmit(lastSubmittedMoveRef.current, moveKey)) {
        moveInFlightRef.current = false
        setMoveSending(false)
        return
      }
      lastSubmittedMoveRef.current = nextSubmittedKey(lastSubmittedMoveRef.current, { type: 'submit', moveKey })
      serverMove(code, finalPlayed, expectedServerVersion)
        .then((r) => {
          if (r?.state) {
            appliedServerVersionRef.current = r.version
            appliedServerRoomRef.current = code // surum + ait oldugu oda BIRLIKTE yazilir
            applyServerBoard(r.state as GameState, r.match ?? null)
          }
          // BOT ODASI: insan hamlesinden sonra botun (siyah) senkron oynadığı tur(lar). gnubg
          // yoksa bot_status='unavailable' -> insan hamlesi KORUNDU, botu dürterek tekrar dene.
          if (!applyBotTurns(r?.bot) && r?.bot_status === 'unavailable') {
            scheduleBotNudge(code)
          }
        })
        .catch((e) => {
          // SIRA/ZAR DESYNC (409: "Önce zar at." / "Sıra sende değil."): korkutucu mesaj GÖSTERME.
          // appliedServerVersionRef=-1 zaten poll'u tetikler -> otoriter durum (doğru sıra+zar) geri
          // gelir (kendi kendini onarır). doRollAuthoritative da 409'u sessiz geçer — aynı desen.
          const err = e as { status?: number }
          // KILIT FIX ("Onayla takılıyor"): reddedilen hamle (409 dahil) SUNUCUDA UYGULANMADI ->
          // aynı hamlenin yeniden gönderilebilmesi için mükerrer-kilidini HER hatada temizle. Aksi
          // halde 409 sonrası sunucu server_version'ı ARTIRMADIĞI için (rejected=no bump) resync aynı
          // versiyona döner, kullanıcı aynı taşları tekrar oynayıp Onayla'ya basınca moveKey birebir
          // aynı çıkar ve dedup guard onu SESSİZCE yutar (kalıcı kilit). Eşzamanlı çift-submit'i zaten
          // moveInFlightRef (senkron) engeller. Bkz. authSync nextSubmittedKey + regresyon testi.
          lastSubmittedMoveRef.current = nextSubmittedKey(lastSubmittedMoveRef.current, { type: 'rejected' })
          // Geçici hata (offline/timeout; api.ts retry'yi zaten tüketti) = hamle SUNUCUYA ULAŞMADI.
          // Jenerik "ulaşılamadı" yerine aksiyon bildir: tahta zaten re-playable'a resync oluyor,
          // kullanıcıya yeniden bağlanınca hamlesini TEKRAR OYNAMASINI söyle (dev_bay AFK vakası).
          if (isTransientError(e)) notify.error(t('mp.moveConnLost'))
          else if (err?.status !== 409) notify.error(srvErr(e))
          appliedServerVersionRef.current = -1 // reddedildi -> poll otoriter durumu geri yükler
          // KÖK FIX (canlı "onaylaya bastıkça Geçersiz hamle" kilidi): reddedilen hamle (409/422/…)
          // SUNUCUDA UYGULANMADI ama istemci HÂLÂ mid-move'da (sıra bende + zar atılmış/step oynanmış).
          // Poll'un mid-move kalkanı (shouldApplyServerState) bu durumda otoriter durumu EZMEZ ->
          // yalnız appliedServerVersion=-1 bırakırsak yerel desync tahta KALICI kalır: kullanıcı aynı
          // (sunucuya göre yasadışı) hamleyi tekrar oynayıp Onayla'ya bastıkça sonsuza kadar 422 alır.
          // Bu yüzden HER r redde poll'u beklemeden tek seferlik DOĞRUDAN senkron yap (showRoom ->
          // applyServerBoard mid-move kalkanını atlar, turnStart+played'i otoriter tahtaya sıfırlar).
          // Önceden yalnız 409'da yapılıyordu; 422 ("Geçersiz hamle") dışarıda kalıp kilide yol açtı.
          void showRoom(code)
            .then((rv) => {
              if (!rv?.server_state) return
              applyServerBoard(rv.server_state, rv.server_match ?? null)
              appliedServerVersionRef.current = rv.server_version ?? 0
              appliedServerRoomRef.current = code
            })
            .catch(() => {
              // Normal polling bir sonraki turda yeniden deneyecek.
            })
        })
        .finally(() => {
          moveInFlightRef.current = false
          // Yanıt geldi (state + bot[] uygulandı / hata resync): "düşünüyor"u kaldır. Bot hamlesi
          // varsa applyBotTurns .then'de zaten animasyona başladı (tahtada görsel hareket sürer).
          setBotThinking(false)
          setMoveSending(false)
        })
      return
    }

    // ---- LEGACY / pvb / Faz 1: optimistik yerel uygula (legacy PUT sync effect'te gider) ----
    const s = applyPlayed(turnStart, finalPlayed)
    s.turn = opponent(s.turn)
    s.dice = []
    s.diceUsed = []
    setTurnStart(s)
    setPlayed([])
    setSelectedFrom(null)
    fullyForcedRef.current = false
    setRanked(null)
    setCurrentProbs(null)
    setTurnsPlayed((n) => n + 1)
    if (!winner(s)) setMessage(t('msg.turnOf', { name: pName(s.turn) }))
  }

  // ---- Maç kaydı (hamle+zar logu) ----
  // Bir turu kaydeder. Online'da SADECE kendi rengimin turlarini yazarim (rakip kendi
  // istemcisinde kendi turunu yazar; admin gorunumu seq'e gore birlestirir). pvb/pvp'de
  // tek istemci her iki rengi de yazar.
  function recordMatchTurn(before: GameState, steps: Step[]) {
    const log = gameRecordRef.current
    if (!log) return
    if (log.online && before.turn !== myColor) return
    log.events.push({
      g: log.gameNo,
      s: turnsPlayedRef.current,
      p: before.turn === 'white' ? 'W' : 'B',
      d: (before.dice ?? []).join('-'),
      m: turnNotation(steps, before.turn),
    })
  }

  // Kup (double) kararını kaydeder: katla / kabul / pas. Aktör oyuncu (player) yazar; her
  // istemci yalnız KENDİ kup eylemini kaydeder (online'da rakibinki kendi istemcisinde).
  // o<0 -> aynı seq'te ilgili hamleden ÖNCE sıralanır.
  function recordCubeEvent(player: Player, chosen: 'double' | 'take' | 'drop') {
    const log = gameRecordRef.current
    if (!log) return
    if (log.online && player !== myColor) return
    const m =
      chosen === 'double'
        ? `Katla → ${match.cube.value * 2}`
        : chosen === 'take'
          ? `Kabul (${match.cube.value * 2})`
          : 'Pas (çekildi)'
    log.events.push({
      g: log.gameNo,
      s: turnsPlayedRef.current,
      o: chosen === 'double' ? -3 : -2,
      k: 'cube',
      p: player === 'white' ? 'W' : 'B',
      d: '',
      m,
    })
  }

  // Oyun sonu özeti (kazanan · tür · puan). Her iki istemci de yazabilir; birleştirmede
  // oyun başına tekilleştirilir (bkz. GameLog::mergedTurns).
  function recordEndEvent(ge: GameEnd) {
    const log = gameRecordRef.current
    if (!log) return
    const type = ge.resigned
      ? 'Terk'
      : ge.timeout
        ? 'Süre doldu'
        : ge.dropped
          ? 'Kup pas'
          : ge.mult === 3
            ? 'Çifte mars'
            : ge.mult === 2
              ? 'Mars'
              : 'Normal'
    log.events.push({
      g: log.gameNo,
      s: turnsPlayedRef.current,
      o: 9,
      k: 'end',
      p: ge.winner === 'white' ? 'W' : 'B',
      d: '',
      m: `${ge.winner === 'white' ? 'Beyaz' : 'Siyah'} · ${type} · ${ge.points}p`,
    })
  }

  // Kaydı sunucuya gönderir (en iyi çaba). final=true → maç sonu: kazanan + skor + 'finished'.
  // keepalive=true → sayfa kapanırken/gizlenirken; tarayıcı unload sonrası bile teslim eder.
  function flushMatchLog(final: boolean, keepalive = false) {
    const log = gameRecordRef.current
    if (!log) return
    let p1: string | null
    let p2: string | null
    if (log.online) {
      const me = profile?.nickname ?? t('auth.guestNick')
      const opp = room?.oppName ?? null
      if (log.slot === 'p1') {
        p1 = me
        p2 = opp
      } else {
        p1 = opp
        p2 = me
      }
    } else if (log.mode === 'pvb') {
      p1 = profile?.nickname ?? t('auth.guestNick')
      p2 = AI_LEVELS[difficulty - 1] ?? 'AI'
    } else {
      p1 = pName('white')
      p2 = pName('black')
    }
    const mW = matchWinner(match)
    void submitGameLog(
      {
        uid: log.uid,
        slot: log.slot,
        mode: log.mode,
        target: log.target,
        p1_name: p1,
        p2_name: p2,
        status: final ? 'finished' : 'playing',
        winner: final ? (mW === 'white' || mW === 'black' ? mW : null) : null,
        score: final ? { white: match.score.white, black: match.score.black } : null,
        events: log.events,
      },
      { keepalive },
    )
    lastFlushLenRef.current = log.events.length
  }

  // Son gönderilen olay sayısı (periyodik ara-flush eşiği için). Yeni kayıtta 0'lanır.
  const lastFlushLenRef = useRef(0)
  // flushMatchLog'un EN YENİ kapanışını tutan ref: pagehide/visibility listener'ı
  // (mount'ta bir kez bağlanır) güncel maç durumuyla flush edebilsin diye.
  const flushLogRef = useRef<(final: boolean, keepalive?: boolean) => void>(() => {})
  flushLogRef.current = flushMatchLog

  // turnsPlayed'i ref'e yansit (commitTurn aninda ortak sira degeri icin).
  useEffect(() => {
    turnsPlayedRef.current = turnsPlayed
  }, [turnsPlayed])

  // Maç kaydı yaşam döngüsü: aktif bir maç başladığında yeni kayıt aç (uid üret / oda kodu).
  useEffect(() => {
    if (home) {
      // Aktif (oynanmış) maçı arka plana alırken/refresh'te kaydını KORU -> resume'da AYNI admin
      // kaydına devam (yeni uid = parçalanma yok). Mount'ta applySavedGame record'u geri yükler ama
      // home başlangıçta true; 0-tur+sonuçsuz DEĞİLSE null'lamayız (yoksa restore edilen uid hemen
      // silinip yeniden üretilirdi -> HUD'da farklı ID). Yalnız hiç oynanmamışta sıfırla.
      if (turnsPlayed === 0 && !gameEnd) {
        gameRecordRef.current = null
        setRecordUid(null)
      }
      return
    }
    if (online) {
      const code = room?.code
      if (!code || room?.status !== 'playing') return
      if (gameRecordRef.current?.uid !== code) {
        gameRecordRef.current = {
          uid: code,
          online: true,
          slot: room!.slot,
          mode: 'online',
          target: match.target,
          gameNo: 1,
          events: [],
          done: false,
        }
        prevGameEndRef.current = false
        gameResultsRef.current.length = 0 // yeni mac -> otoriter sonuclari sifirla
        lastFlushLenRef.current = 0 // yeni kayit -> periyodik ara-flush esigini sifirla
        setRecordUid(code)
      }
    } else if (mode === 'pvb' || mode === 'pvp') {
      // Yerel maç: taze maç (0-0, tur yok) ise yeni uid; bitmiş kayıttan sonra rovans -> rotasyon.
      const fresh = turnsPlayed === 0 && !gameEnd && match.score.white === 0 && match.score.black === 0
      const cur = gameRecordRef.current
      if (!cur || cur.online || (cur.done && fresh)) {
        const uid = genLocalUid()
        gameRecordRef.current = {
          uid,
          online: false,
          slot: 'p1',
          mode: mode === 'pvp' ? 'local' : 'pvb',
          target: match.target,
          gameNo: 1,
          events: [],
          done: false,
        }
        prevGameEndRef.current = false
        gameResultsRef.current.length = 0 // yeni mac -> otoriter sonuclari sifirla
        lastFlushLenRef.current = 0 // yeni kayit -> periyodik ara-flush esigini sifirla
        setRecordUid(uid)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, online, room?.code, room?.status, mode, turnsPlayed, gameEnd, match])

  // Oyun sonu: kısmi kaydı gönder (disconnect'e karşı) + sonraki oyun için gameNo artır.
  useEffect(() => {
    const has = !!gameEnd
    if (has && !prevGameEndRef.current && gameRecordRef.current) {
      if (gameEnd) {
        recordEndEvent(gameEnd)
        // XG .mat sonuc satiri icin OTORİTER sonucu sakla. gamePointsWon = cube × winMultiplier;
        // ayrıca çarpanı ve bitiş türünü de taşı (exporter DOĞRULAMA + izleme için kullanır —
        // bkz. matExport.resolveGameResult; "Wins 8 point" gibi imkânsız değerlerin önlenmesi).
        const terminationType = gameEnd.resigned
          ? 'resignation'
          : gameEnd.timeout
            ? 'timeout'
            : gameEnd.dropped
              ? 'drop'
              : 'bearoff'
        const winMultiplier =
          gameEnd.mult === 1 || gameEnd.mult === 2 || gameEnd.mult === 3 ? gameEnd.mult : undefined
        gameResultsRef.current.push({ winner: gameEnd.winner, points: gameEnd.points, winMultiplier, terminationType })
      }
      flushMatchLog(false)
      gameRecordRef.current.gameNo += 1
    }
    prevGameEndRef.current = has
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameEnd])

  // Maç sonu: kesin kaydı (kazanan + skor) gönder ve kilitle.
  useEffect(() => {
    if (matchOver && gameRecordRef.current && !gameRecordRef.current.done) {
      gameRecordRef.current.done = true
      flushMatchLog(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchOver])

  // PERİYODİK ARA-FLUSH: ilk oyun bitmeden TERK edilen maçlar da sunucuya düşsün.
  // Her tur değişiminde: aktif+bitmemiş kayıt, son flush'tan bu yana >=8 yeni olay
  // biriktiyse kısmi gönder (idempotent -> tekrar yazmak zararsız).
  useEffect(() => {
    const rec = gameRecordRef.current
    if (!rec || rec.done) return
    if (rec.events.length - lastFlushLenRef.current >= 8) {
      flushMatchLog(false) // lastFlushLenRef flushMatchLog içinde güncellenir
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnsPlayed])

  // Sayfa kapanışı/gizlenmesi + kuyruk kurtarma (mount'ta BİR KEZ bağlanır).
  //  - pagehide / visibilitychange(hidden): keepalive flush -> tarayıcı unload sonrası
  //    bile teslim eder (terk/kapatmada kayıp önlenir). flushLogRef güncel durumu tutar.
  //  - açılışta + ağ geri geldiğinde bekleyen (başarısız) kayıt kuyruğunu yeniden dener.
  useEffect(() => {
    const onHide = () => {
      const rec = gameRecordRef.current
      if (rec && !rec.done && rec.events.length > 0) flushLogRef.current(false, true)
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') onHide()
    }
    const onOnline = () => void flushGameLogQueue()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    void flushGameLogQueue() // açılışta bekleyenleri dene
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  function computeMoveError(finalPlayed: Step[]): MoveError | null {
    // Hata tespiti icin TUM turun siralamasini kullan (tur basinda hesaplanan)
    const turnRanked = turnRankedRef.current
    // Analiz paneli SADECE yapay zekaya karşı (pvb). Tek Oyun/Maç Oyunu/pvp'de asla
    // gösterme — hile önlemi (PR/istatistik hesabı arka planda yine calisir).
    if (!showAnalysis || !botMatch || !turnRanked || turnRanked.length === 0) return null
    const resultKey = boardKey(applyPlayed(turnStart, finalPlayed))
    const pl = turnRanked.find((r) => r.move.resultKey === resultKey)
    if (!pl) return null
    const best = turnRanked[0]
    const loss = Math.max(0, best.equity - pl.equity)
    const { key, cls } = classifyError(loss)
    return {
      loss,
      label: t(key),
      cls,
      best: moveNotation(best.move, turnStart.turn),
      played: moveNotation(pl.move, turnStart.turn),
    }
  }

  // Sunucu-otoriter zar (Faz 2c DRAFT): zar SUNUCUDAN alinir (serverRoll), istemci secemez.
  // authoritative oda + online iken doRoll bunu cagirir. CANLIDA TEST EDILMEDEN ACMA.
  async function doRollAuthoritative() {
    const code = room?.code
    if (!code) return
    if (Date.now() < apiBackoffUntilRef.current) return // 429 sonrası geri-çekilme penceresi
    // MAÇ BİTTİ: sunucu odayı 'finished' işaretlediyse (forfeit/timeout/normal son) ZAR ATMA.
    // Aksi halde biten maçta auto-roll POST /roll 409 "Oyun aktif değil" döngüsüne girer (#KVU8X).
    // Poll'un maç-sonu kesin-uygulama dalı zaten MatchResult'ı getirir; burada yalnız spam'i keseriz.
    if (room?.status === 'finished') return
    // SIRA-DEĞİL ZAR ATMA (kök fix, kullanıcı: "rakip sırası-değilken nasıl zar atar"): açılış
    // DIŞINDA, SUNUCUNUN bildiği en taze sıra (srvTurnStartRef) bende DEĞİLSE zar İSTEME. Auto-roll
    // bir an bayat React state'iyle (yerel turnStart) tetiklense bile bu REF kapısı out-of-turn
    // POST'u KÖKTEN engeller -> sunucu 409/not_turn üretmez. Yerel state bayatsa resync tetikle ki
    // poll doğru sırayı getirsin (auto-roll sonra doğru anda çalışır -> kilitlenme yok).
    if (openingRef.current !== 'roll') {
      const srvTurn = srvTurnStartRef.current?.turn
      if (srvTurn && srvTurn !== myColor) {
        appliedServerVersionRef.current = -1 // bayat yerel sıra -> poll otoriter durumu geri getirir
        return
      }
    }
    if (rollConflictRef.current) return
    if (rollInFlightRef.current) return // önceki serverRoll bitmeden yeni çağrı YOK (döngü kalkanı)
    rollInFlightRef.current = true
    setRollSending(true) // "Atılıyor…" + disabled: zar sunucudan gelene kadar (algı + çift-tık kalkanı)
    try {
      // NOT: try'in İÇİNDE — dışarıda atarsa uçuş kilidi (rollInFlightRef) asla açılmaz ve
      // o istemci bir daha ZAR ATAMAZ (açılışta: overlay'de kalıcı takılma).
      recordNoDoubleIfEligible() // katlamayip zar atmak = no-double kup karari (PR'a girer)
      const expectedServerVersion =
        appliedServerVersionRef.current >= 0 ? appliedServerVersionRef.current : (room?.server_version ?? 0)
      const r = await serverRoll(code, undefined, expectedServerVersion)
      // SIRA-DEĞİL: sunucu 409 yerine güncel durumu döndü (not_turn). Tur-geçişi anında yerel tur
      // bir an bayatken auto-roll tetiklenince olur; SESSİZCE otoriter durumu uygula (konsolda 409
      // spam OLMAZ). Zar gelmedi -> yeni tur kurma, yalnız server_state/match'i yansıt.
      if (r.not_turn) {
        if (r.state) {
          appliedServerVersionRef.current = r.version ?? appliedServerVersionRef.current
          appliedServerRoomRef.current = code
          applyServerBoard(r.state as GameState, r.match ?? null)
        }
        return
      }
      // AÇILIŞ (Faz 2): sunucu adil açılışı yaptı -> başlayan + iki zar geldi. Taze tahta kur.
      if (r.opening && (r.starter === 'white' || r.starter === 'black')) {
        const starter = r.starter
        const s = freshBoard(starter)
        s.dice = r.dice
        s.diceUsed = [false, false]
        playDice()
        setStarter(starter)
        setTurnStart(s)
        setPlayed([])
        setSelectedFrom(null)
        setLastError(null)
        setRanked(null)
        setCurrentProbs(null)
        // OTORİTE SÜRÜM MUHASEBESİ (KRİTİK): açılış eli uygulandı -> uygulanan server_version'i
        // KAYDET. Aksi halde appliedServerVersionRef, resetRoomSync'ten kalan -1'de kalır ve
        // açılıştan ÖNCE yola çıkmış (opened=false, version=0) UÇUŞTAKİ bir poll yanıtı sürüm
        // kapısını geçip (0 > -1) taze açılışı EZER: applyServerBoard tahtayı initialState'e (zarsız)
        // döndürür + openingStateFromMatch(opened=false) -> setOpening('roll'). Zar "geri alınır",
        // effect yeniden açılışı tetikler, sunucu reused döner, sonraki poll zarı geri getirir ->
        // kullanıcı raporu: "AI'a başlarken zar atıyor, geri alıyor, sonra tekrar atıyor". Sürümü
        // burada yazmak o bayat poll'u shouldApplyServerState'te (version <= applied) eler. Bot
        // başlatıcıysa applyBotTurns bunu daha da ilerletir (bt.version) — güvenli.
        appliedServerVersionRef.current = r.version
        if (code) appliedServerRoomRef.current = code
        setOpening(null) // reveal ekranını atla — sunucu başlayanı belirledi
        const moves = generateMoves(s)
        setMessage(
          hasNoMove(moves)
            ? t('msg.noMovePass', { name: pName(starter) })
            : t('msg.playing', { name: pName(starter), dice: r.dice.join(', ') }),
        )
        // BOT ODASI: açılış botu (siyah) başlatıcı yaptıysa botun turu yanıtta gelir -> uygula.
        if (!applyBotTurns(r.bot) && r.bot_status === 'unavailable') {
          scheduleBotNudge(code)
        }
        return
      }
      // reused (sunucuda zaten verilmiş el): YEREL uygulama YAPMA. newTurn yerel turn'ü korur;
      // açılışta gerçek BAŞLAYAN ikinci çağıran olduğunda reused starter taşımadığı için tahta
      // YANLIŞ turn'de kalır -> "oynayamıyorum". Bunun yerine poll'a bırak: applyServerBoard
      // doğru turn+zar+opened'i getirir. Döngü YOK: açılışta otomatik zar !opening ile gated, normal
      // turda diceRolled ile gated; poll opening overlay'ini kaldırır + rollInFlightRef korur.
      if (r.reused) return
      // Normal zar atışında da sunucu sürümü ilerler. Bunu yalnızca opening
      // dalında kaydetmek, sonraki move isteğinin bir sürüm geriden gitmesine
      // ve sunucunun stale-version 409 döndürmesine neden oluyordu.
      appliedServerVersionRef.current = r.version
      appliedServerRoomRef.current = code
      // Sunucu zari kanonik: 2 zar ise buyuk-once goster; cift ise 4 hane oldugu gibi.
      const dice = r.dice.length === 2 ? orderDice(r.dice) : r.dice
      playDice()
      const rolled = newTurn(turnStart, dice)
      setTurnStart(rolled)
      setPlayed([])
      setSelectedFrom(null)
      setLastError(null)
      setRanked(null)
      setCurrentProbs(null)
      const moves = generateMoves(rolled)
      setMessage(
        hasNoMove(moves)
          ? t('msg.noMovePass', { name: pName(rolled.turn) })
          : t('msg.playing', { name: pName(rolled.turn), dice: dice.join(', ') }),
      )
    } catch (e) {
      // Açılış/sıra yarışı: başlayan-olmayan taraf 409 alır -> SESSİZ (poll açılışı getirir).
      const err = e as { status?: number; message?: string }
      // 429 = "Too Many Attempts" (rate-limit). KRİTİK: 429'da EK İSTEK ATMA (showRoom bile) —
      // aksi halde flood daha da büyür ve poll bile 429 yer (yaşanan #3ZYS8 kilidi). Onun yerine
      // GERİ ÇEKİL: birkaç saniye roll+poll durur, kova boşalır, sonra normal akış döner. 429'da
      // rahatsız edici toast da gösterme.
      if (err?.status === 429) {
        apiBackoffUntilRef.current = Date.now() + 5000 // 5 sn geri çekil (roll + poll)
        return
      }
      if (err?.status !== 409) {
        notify.error(srvErr(e))
      }
      // Açılış/sıra yarışı (409) VEYA bitmiş maçta "Oyun aktif değil": sunucunun kanonik durumunu
      // çek + uygula. Maç bittiyse gameEnd kurulur -> matchOver -> auto-roll KALICI durur (döngü
      // biter). move tarafındaki 409 resync ile aynı güvenli yol.
      if (err?.status === 409 && code) {
        // Açılış yarışında NON-STARTER'ın 409'u BEKLENEN/iyi huyludur (starter açılışı tetikledi,
        // poll server_state'i getirir). rollConflictRef'i burada LATCH ETMEK, açılış sonrası sıra
        // bu oyuncuya geçince İLK gerçek zarı 3129'da KALICI bloklar; 1 puanlık maçta manuel buton
        // olmadığı için oyuncu AFK'ye düşer (canlı vaka #XR37P). Mandalı yalnız OYUN-İÇİ 409'da kur;
        // açılışta sadece resync yap (appliedServerVersionRef=-1 + showRoom). Açılış effect'i 2.5sn
        // aralıkla zaten yeniden dener -> mandal olmadan spam riski yok.
        if (openingRef.current !== 'roll') rollConflictRef.current = true
        appliedServerVersionRef.current = -1
        void showRoom(code)
          .then((rv) => {
            if (!rv?.server_state) return
            applyServerBoard(rv.server_state as GameState, rv.server_match ?? null)
            appliedServerVersionRef.current = rv.server_version ?? 0
            appliedServerRoomRef.current = code
          })
          .catch(() => {
            // Normal polling sonraki turda yeniden deneyecek.
          })
      }
    } finally {
      rollInFlightRef.current = false // uçuş kilidi her durumda serbest bırakılır
      setRollSending(false)
    }
  }

  function doRoll() {
    // Sunucu-otoriter oda (tam Faz 2c) VEYA BAGIMSIZ Faz 1 (yalniz zar): zari SUNUCUDAN al
    // (async), lokal zar URETME. Ikisinde de doRollAuthoritative zari serverRoll'dan ceker;
    // fark move tarafinda (Faz 1'de commitTurn LEGACY PUT kullanir, serverMove'a gitmez).
    if (online && (authoritativeRef.current || diceAuthorityRef.current)) {
      void doRollAuthoritative()
      return
    }
    // Insan katlamak yerine zar atti -> "no-double" karari olarak PR'a isle (guclu tavsiyeyi
    // kacirdiysa equity kaybi sayilir). Kup danismani (pvb) olsun olmasin kaydedilir.
    recordNoDoubleIfEligible()
    const dice = orderDice(fairRef.current.next()) // varsayilan: buyuk zar once (tikla-degistir mevcut)
    playDice()
    const rolled = newTurn(turnStart, dice)
    setTurnStart(rolled)
    setPlayed([])
    setSelectedFrom(null)
    setLastError(null)
    setRanked(null)
    setCurrentProbs(null)
    const moves = generateMoves(rolled)
    setMessage(
      hasNoMove(moves)
        ? t('msg.noMovePass', { name: pName(rolled.turn) })
        : t('msg.playing', { name: pName(rolled.turn), dice: dice.join(', ') }),
    )
  }

  // ---- Kup ----
  // Insan kup kararini (teklif/pas/take/drop) danisman tavsiyesiyle karsilastir
  // ve mac raporuna kaydet. Yalnizca insanin kendi karari loglanir.
  // Küp kararı PR + kayıt (XG-style). Karar anındaki pozisyonu (turnStart) sinir ağıyla değerlendirir
  // -> cubeEquity ile aksiyon equity KAYBI (en iyi − seçilen). prStats'a (overall PR'a cube dahil)
  // ekler + matchLog'a TEK cube girdisi yazar (hem .mat hem backend PR: countsForPR+prAdjusted).
  // Online: yalnız KENDİ kararım (rakibinki kendi istemcisinde). authoritative dalı handler'da
  // erken döner -> burası legacy/pvb/pvp; motor tarayıcıda mevcut (checker PR gibi).
  function recordCubePR(player: Player, kind: 'offer' | 'take', chosen: 'double' | 'no-double' | 'take' | 'drop') {
    if (online && player !== myColor) return // online: sadece kendi kararım
    const pos = turnStart
    const seq = turnsPlayed
    const isMoney = stakeRef.current > 0
    neuralRef.current
      .evalPosition(pos, player)
      .then((probs) => {
        if (!probs || probs.length < 6) return
        const res =
          kind === 'offer'
            ? offerLoss(probs, chosen === 'double' ? 'double' : 'no-double')
            : takeLoss(probs, chosen === 'take' ? 'take' : 'pass')
        const loss = res.normalizedEquityLoss
        const prAdjusted = loss * onePointFactor(match.target, isMoney)
        setPrStats((s) => ({
          ...s,
          [player]: {
            ...s[player],
            loss: s[player].loss + (res.countsForPR ? prAdjusted : 0),
            decisions: s[player].decisions + (res.countsForPR ? 1 : 0),
            cubeLoss: (s[player].cubeLoss ?? 0) + (res.countsForPR ? prAdjusted : 0),
            cubeDecisions: (s[player].cubeDecisions ?? 0) + (res.countsForPR ? 1 : 0),
            allLoss: (s[player].allLoss ?? 0) + prAdjusted,
            allDecisions: (s[player].allDecisions ?? 0) + 1,
          },
        }))
        const win = (probs[0] + probs[1] + probs[2]) * 100
        const equity = probs[0] - probs[3] + 2 * (probs[1] - probs[4]) + 3 * (probs[2] - probs[5])
        setMatchLog((log) => [
          ...log,
          {
            notation: '',
            best: '',
            loss,
            player,
            pos,
            seq,
            cube: { win, equity, recommended: res.bestAction, chosen, correct: loss < 0.001 },
            countsForPR: res.countsForPR,
            prAdjustedEquityLoss: prAdjusted,
            mctx: {
              score: match.score,
              cube: match.cube.value,
              cubeOwner: match.cube.owner,
              crawford: match.isCrawford,
              matchLen: match.target,
            },
          },
        ])
      })
      .catch(() => {})
  }

  // "Katlamama" (no-double) DA bir küp kararıdır (XG): zar atıldığı anda oyuncu küpü teklif
  // edebiliyorduysa PR'a no-double olarak yazılır. Eskiden yalnız küp DANIŞMANI hint'i varken
  // (mode==='pvb') sayılıyordu -> online/pvp maçlarda hiç küp kararı oluşmuyor, sonuç ekranındaki
  // "Küp PR" satırı hep boş kalıyordu. Burası danışmanı GÖSTERMEZ (online'da hile olurdu),
  // yalnızca kararı kaydeder. Uygunluk koşulları küp danışmanı effect'iyle BİREBİR aynı.
  function recordNoDoubleIfEligible() {
    cubeHintRef.current = null
    const c: Player = online ? myColor : turnStart.turn
    if (gameEnd || gameWon || matchOver || cubePending !== null || diceRolled) return
    if (turnsPlayed <= 0 || turnStart.turn !== c) return
    if (!canDouble(match, c, false, isMoneyGame)) return
    recordCubePR(c, 'offer', 'no-double')
  }

  // Sunucu (authoritative) çağrısı hatasını okunur mesaja çevir: HTTP hatasında sunucunun
  // gerçek mesajını (ör. "Crawford oyununda küp kullanılamaz"), ağ kopukluğunda genel uyarı.
  // Sunucu tarafı geçici arıza (502/504/HTML hata sayfası; api.ts tekrar denemeyi zaten tüketti)
  // "ulaşılamadı" DEĞİL -> ayrı, doğru mesaj.
  function srvErr(e: unknown): string {
    const err = e as { status?: number; message?: string }
    if (err?.status && isTransientError(e)) return t('mp.serverBusy')
    return err?.status ? err.message || t('mp.connError') : t('mp.connError')
  }

  function handleDouble(player: Player) {
    if (diceRolled || !canDouble(match, player, cubePending !== null, isMoneyGame)) return
    // OTORİTER (Faz 2): küp teklifi SUNUCUYA (kurallar sunucuda: sıra/sahiplik/Crawford).
    // Yerel mutasyon YOK -> poll server_match ile cubePending'i senkronlar (forge yok).
    if (online && authoritativeRef.current) {
      // Küp kararı SUNUCUDA uygulanır ama PR/.mat kaydı istemcide tutulur -> sunucu teklifi
      // KABUL ettiyse (2xx) kendi kararımı da logla; yoksa online maçta Küp PR hiç oluşmuyordu.
      if (room?.code) {
        // İYİMSER + ANINDA (take/drop ile aynı): teklifi çeker çekmez "rakip bekleniyor" durumunu
        // GÖSTER. Eskiden yerel mutasyon yoktu -> teklif eden bir sonraki poll'e (~1-2sn) kadar
        // hiçbir geri bildirim görmüyordu = "küp çekerken takılma" (tüm otoriter maçlarda). Sunucu
        // teklifi zaten cube.pending=offerer yapar; poll bunu doğrular. Ret olursa .catch geri alır.
        setCubePending(player)
        setMessage(t('msg.doubled', { name: pName(player), value: match.cube.value * 2 }))
        // SÜRÜM: serverMove/handleTake ile AYNI — iyimser ref (bayat room.server_version -> 409 stale).
        const ev = appliedServerVersionRef.current >= 0 ? appliedServerVersionRef.current : (room.server_version ?? 0)
        void serverCubeOffer(room.code, ev)
          .then((r) => {
            // Otoriter sürümü benimse -> araya giren bayat poll iyimser durumu EZMESIN.
            if (r?.version != null) appliedServerVersionRef.current = r.version
            recordCubePR(player, 'offer', 'double') // XG cube PR + .mat kaydı
            recordCubeEvent(player, 'double') // maç kaydı (okunur)
            // BOT ODASI: bot teklifi AYNI yanıtta yanıtlar (bot_cube = take|drop). Çözülen durumu
            // HEMEN uygula -> "rakip yanıtı bekleniyor" örtüsünü kaldır + küp/skoru senkronla. YOKSA
            // cubePending 'white'ta asılı kalır ve POLL de temizleyemez (appliedServerVersionRef bu
            // sürüme set edildi -> aynı/eski sürümlü poll atlanır) -> insan zar atamaz, saati boşa
            // akar = "bot küpü kabul etmiyor, sürem gidiyor" (yüzlerce şikayetin FE kökü).
            const bc = (r as { bot_cube?: string; match?: ServerMatch })?.bot_cube
            if (botMatch && bc) {
              // Board küp take'te değişmez; applyServerBoard match'i (cube + pending=null) uygular ->
              // cubePending temizlenir, sıra insana (zar) döner. PR/.mat SUNUCU-otoriter -> burada
              // KAYIT YOK (çift kayıt/yanlış atıf olmasın).
              applyServerBoard(turnStart, (r as { match?: ServerMatch }).match ?? null)
            }
          })
          .catch((e) => {
            setCubePending(null) // reddedildi (409/kural) -> iyimser durumu geri al; poll gerçeği getirir
            notify.error(srvErr(e))
          })
      }
      return
    }
    recordCubePR(player, 'offer', 'double') // XG cube PR + .mat kaydı
    recordCubeEvent(player, 'double') // maç kaydı (okunur)
    setCubePending(player)
    setMessage(t('msg.doubled', { name: pName(player), value: match.cube.value * 2 }))
  }
  function handleTake() {
    if (!cubePending) return
    if (online && authoritativeRef.current) {
      if (room?.code && !cubeBusyRef.current) {
        cubeBusyRef.current = true
        const srvTaker = opponent(cubePending) // karar anındaki alan taraf (= ben)
        // İYİMSER + ANINDA: kabul edilen teklifi HEMEN kaldır. Sunucu zaten cube.pending=null yapar;
        // yerelde beklemezsek "Kabul/Pas" kutusu 2-3sn asılı kalmaz. KÖK FIX (kutu GERİ GELİYOR):
        // eskiden kutu yalnız botThinking ile gizleniyordu; botThinking .finally'de (yanıt gelince)
        // temizlenirken cubePending henüz null olmuyordu (bot hamlesi animasyonla geç uygular) ->
        // arada humanRespond tekrar true olup AYNI teklif ekranı bir daha geliyordu. cubePending'i
        // burada null yaparak pencereyi kapat (server not_turn/409'da poll zaten null'a senkronlar).
        setCubePending(null)
        if (botMatch) setBotThinking(true)
        const code = room.code
        // SÜRÜM: serverMove ile AYNI — iyimser ref (appliedServerVersionRef) kullan, room.server_version
        // DEĞİL. KÖK FIX ("küp kabul ettim ama zar gelmedi, sürem bitti"): bot teklifi/redouble İNSAN
        // hamlesinin yanıtında SATIR-İÇİ gelir (appliedServerVersionRef'i bump eder) ama room.server_version
        // (React state) bir sonraki poll'e kadar BAYAT kalır. Bayat sürümle gönderilen take/drop sunucuda
        // staleCommand ile 409 yenir, .catch 409'u sessizce yutardı, cubePending iyimser null'da kalır ve
        // POLL de geri getiremez (appliedServerVersionRef zaten güncel sürümde) -> kutu kalıcı kaybolur,
        // insan yanıt veremeden AFK ile kaybeder (yüzlerce "bot küpü verince donup kaybettim" şikayeti).
        const ev = appliedServerVersionRef.current >= 0 ? appliedServerVersionRef.current : (room.server_version ?? 0)
        void serverCubeRespond(code, 'take', ev)
          .then((r) => {
            // BEKLEYEN TEKLİF YOK (yarış): sunucu not_turn+güncel durum döndü -> sessizce senkronla,
            // PR/olay KAYDETME (teklif yoktu). Konsolda 409 spam olmaz.
            if (r?.not_turn) {
              if (r.state) {
                appliedServerVersionRef.current = r.version ?? appliedServerVersionRef.current
                applyServerBoard(r.state as GameState, r.match ?? null)
              }
              return
            }
            if (r?.version != null) appliedServerVersionRef.current = r.version
            recordCubePR(srvTaker, 'take', 'take') // XG cube PR + .mat kaydı
            recordCubeEvent(srvTaker, 'take') // maç kaydı (okunur)
            // BOT ODASI: insan botun küpünü TAKE etti -> sıra botta; botun hamlesi yanıtta gelir.
            if (!applyBotTurns(r?.bot) && r?.bot_status === 'unavailable') scheduleBotNudge(code)
          })
          // Hata (409 bayat-sürüm/çift-tıklama DAHİL): toast GÖSTERME ama MUTLAKA resync et. appliedServer
          // Version=-1 + showRoom -> otoriter durumu geri yükle. Take gerçekten uygulanmadıysa cube.pending
          // yine black döner (kutu GERİ GELİR, insan tekrar yanıtlayabilir); zaten uygulandıysa null döner
          // (kutu kapalı kalır). İYA KUTU KALICI KAYBOLMAZ (haksız AFK kaybının önlenmesi).
          .catch((e) => {
            if ((e as { status?: number })?.status !== 409) notify.error(srvErr(e))
            appliedServerVersionRef.current = -1
            void showRoom(code)
              .then((rv) => {
                if (!rv?.server_state) return
                applyServerBoard(rv.server_state, rv.server_match ?? null)
                appliedServerVersionRef.current = rv.server_version ?? 0
              })
              .catch(() => {})
          })
          .finally(() => {
            cubeBusyRef.current = false
            setBotThinking(false)
          })
      }
      return
    }
    const doubler = cubePending
    const taker = opponent(doubler)
    recordCubePR(taker, 'take', 'take') // XG cube PR + .mat kaydı
    recordCubeEvent(taker, 'take') // maç kaydı (okunur)
    setMatch((m) => ({ ...m, cube: { value: m.cube.value * 2, owner: taker } }))
    setCubePending(null)
    setMessage(t('msg.took', { name: pName(taker), doubler: pName(doubler) }))
  }
  function handleDrop() {
    if (!cubePending) return
    if (online && authoritativeRef.current) {
      if (room?.code && !cubeBusyRef.current) {
        cubeBusyRef.current = true
        const code = room.code
        const srvDropper = opponent(cubePending) // pas geçen taraf (= ben)
        setCubePending(null) // iyimser: pas edilen teklifi ANINDA kaldır (take ile aynı; kutu geri gelmez)
        // SÜRÜM: handleTake ile AYNI kök fix — iyimser ref kullan (bayat room.server_version -> 409 stale).
        const ev = appliedServerVersionRef.current >= 0 ? appliedServerVersionRef.current : (room.server_version ?? 0)
        void serverCubeRespond(code, 'drop', ev)
          .then((r) => {
            // BEKLEYEN TEKLİF YOK (yarış): not_turn -> sessizce senkronla, PR/olay kaydetme.
            if (r?.not_turn) {
              if (r.state) {
                appliedServerVersionRef.current = r.version ?? appliedServerVersionRef.current
                applyServerBoard(r.state as GameState, r.match ?? null)
              }
              return
            }
            if (r?.version != null) appliedServerVersionRef.current = r.version
            recordCubePR(srvDropper, 'take', 'drop') // XG cube PR + .mat kaydı
            recordCubeEvent(srvDropper, 'drop') // maç kaydı (okunur)
            // KÖK FIX (vaka S8SR7 "bot küp çekti pasladım oyun kilitlendi"): drop yanıtını DOĞRUDAN
            // uygula. drop eden KENDİ turunda olduğu için poll'un mid-move kalkanı senkronu bloklar +
            // version zaten yukarıda yazıldı -> poll bir sonraki OYUN (opened=false) / maç-sonu durumunu
            // HİÇ getiremez. Backend artık state döner; resign ile birebir aynı desen.
            if (r?.state) {
              appliedServerRoomRef.current = code
              applyServerBoard(r.state as GameState, r.match ?? null)
            }
          })
          // Hata (409 DAHİL): resync et (bkz handleTake) -> drop uygulanmadıysa kutu geri gelir.
          .catch((e) => {
            if ((e as { status?: number })?.status !== 409) notify.error(srvErr(e))
            appliedServerVersionRef.current = -1
            void showRoom(code)
              .then((rv) => {
                if (!rv?.server_state) return
                applyServerBoard(rv.server_state, rv.server_match ?? null)
                appliedServerVersionRef.current = rv.server_version ?? 0
              })
              .catch(() => {})
          })
          .finally(() => {
            cubeBusyRef.current = false
            setBotThinking(false)
          })
      }
      return
    }
    const doubler = cubePending
    recordCubePR(opponent(doubler), 'take', 'drop') // XG cube PR + .mat kaydı
    recordCubeEvent(opponent(doubler), 'drop') // maç kaydı (okunur)
    const points = match.cube.value
    setMatch((m) => scoreGame(m, doubler, points))
    setGameEnd({ winner: doubler, points, mult: 1, dropped: true })
    setCubePending(null)
  }

  // ---- Pes etme / cekilme ----
  // resignLoser: kim teslim oluyor (online -> ben; pvb -> insan/beyaz; pvp -> sırası gelen).
  const resignLoser: Player = online ? myColor : mode === 'pvp' ? turnStart.turn : 'white'
  // SİSTEM-belirlenen pes değeri (1/2/3): ŞU ANKİ tahtadan (SAF KONUM). Kullanıcı SEÇMEZ — sistem gösterir.
  // Rakip evinde/barında taş -> backgammon(3), hiç toplamadı -> gammon(2), topladı -> single(1).
  const resignVal = resignationValue(turnStart, resignLoser, !!match.classic)
  const resignType = resignationTypeForValue(resignVal)
  const resignPoints = calculateResignationPoints(resignType, match.cube.value)
  const resignWinner = opponent(resignLoser)
  // Maç kazanılıyor mu? (rakip bu puanla hedefe ulaşır) -> ekranda "Rakibin maçı kazanacak."
  const resignWinsMatch = match.target > 0 && match.score[resignWinner] + resignPoints >= match.target

  // MERKEZİ RESIGN (kesin kural): oyuncu SINGLE/GAMMON/BACKGAMMON SEÇER; puan = küp × çarpan
  // (calculateResignationPoints — tek kaynak). Tahtadan TAHMİN YOK. Skor TEK KEZ güncellenir
  // (setMatch + gameEnd birlikte); gameEnd -> interactive false -> sonrasında hamle YAPILAMAZ.
  function handleResign(type: ResignationType) {
    setResignOpen(false)
    // OTORİTER online: pes SUNUCUYA (tür ile) -> sunucu küp × çarpan uygular. YANITI DOĞRUDAN
    // uygula (applyServerBoard): pes eden KENDİ turunda (zar atılmış) olduğu için poll'un mid-move
    // kalkanı (shouldApplyServerState) senkronu bloklar -> sonuç/yeni-oyun durumu HİÇ gelmez,
    // "pes ettim ama sayfa olduğu yerde kaldı" bug'ı. serverMove ile aynı desen.
    if (online && authoritativeRef.current) {
      if (room?.code) {
        const code = room.code
        // Poll ile gelen room.server_version bir render geriden gelebilir. İlk
        // açılış zarı/AI hamlesi sonrası gerçek uygulanan sürüm ref'tedir;
        // eski sürümü gönderirsek sunucu 409 dönüp pes işlemini reddeder.
        const expectedServerVersion =
          appliedServerVersionRef.current >= 0 ? appliedServerVersionRef.current : (room.server_version ?? 0)
        serverResign(code, type, expectedServerVersion)
          .then((r) => {
            if (r?.state) {
              appliedServerVersionRef.current = r.version
              appliedServerRoomRef.current = code
              applyServerBoard(r.state as GameState, r.match ?? null)
            }
          })
          .catch((e) => notify.error(srvErr(e)))
      }
      return
    }
    const w = opponent(resignLoser)
    setMatch((m) => scoreGame(m, w, calculateResignationPoints(type, m.cube.value)))
    setGameEnd({
      winner: w,
      points: calculateResignationPoints(type, match.cube.value),
      mult: resignMultiplier(type),
      dropped: false,
      resigned: true,
      resignType: type,
    })
  }

  // MAÇTAN ÇEKIL: skordan BAGIMSIZ — tum maci birakirsin, rakip maci kazanir.
  // Online: /leave ucu (ABANDON) rakibi maç galibi ilan eder (presence beklemeden, ANINDA).
  // Offline: rakibin skorunu hedefe cekip mac-sonu ekranini acar.
  function handleQuitMatch() {
    setResignOpen(false)
    if (online && room?.code) {
      const code = room.code
      roomLeavingRef.current = code
      syncEnabledRef.current = false
      void leaveRoom(code).finally(() => handleLeaveRoom())
      return
    }
    const w = opponent(resignLoser)
    setMatch((m) => ({ ...m, score: { ...m.score, [w]: m.target } }))
    setGameEnd({ winner: w, points: match.cube.value, mult: 1, dropped: false, resigned: true })
  }

  // KLASIK TAVLA: match.classic'i TEK KAYNAKTAN (otoriter oda bayrağı room.classic) aynala. Böylece
  // hangi giriş yolu (matchmaking/arkadaş/bot) olursa olsun küp UI'si gizlenir (cubeAvailability +
  // shouldAutoRoll m.classic okur) ve yerel (legacy arkadaş) skor/pes değeri mars=2 ile sınırlanır.
  useEffect(() => {
    const rc = !!room?.classic
    setMatch((m) => (!!m.classic === rc ? m : { ...m, classic: rc }))
  }, [room?.classic])

  // ---- Oyun sonu (bear off) cozumleme ----
  useEffect(() => {
    // OTORİTER (Faz 2): oyun-sonu puanını SUNUCU hesaplar (move() → server_match); yerelde
    // SKORLAMA -> çifte sayım olur. Skoru poll (applyServerBoard) server_match'ten alır.
    if (online && authoritativeRef.current) return
    if (gameEnd || cubePending) return
    // KRİTİK (eski "Maç Sonucu" flash'ının GERÇEK kaynağı): yeni maç başlarken match/gameEnd
    // sıfırlansa da BOARD (turnStart/played) bir an ESKİ bitmiş pozisyon kalabiliyor. Online
    // başlangıçta `await matchmake` boşluğunda room=null -> `online` FALSE olur -> üstteki
    // authoritative guard'ı ATLANIR -> bu effect stale kazanan board'dan gameEnd'i YENİDEN
    // kurup maçı skorluyordu -> MatchResult flash. turnsPlayed=0 iken (her reset'te 0) HİÇBİR
    // oyun kazanılmış olamaz (0 turda bear-off imkânsız) -> güvenli, kesin guard.
    if (turnsPlayed === 0) return
    const w = winner(working)
    if (!w) return
    const outcome = gameOutcome(working, !!match.classic)
    if (!outcome) return
    const points = match.cube.value * outcome.multiplier
    setMatch((m) => scoreGame(m, w, m.cube.value * outcome.multiplier))
    setGameEnd({ winner: w, points, mult: outcome.multiplier, dropped: false })
  // BİLEREK `online` yok: online/otoriter durum authoritativeRef ile okunur; online true->false
  // geçişinde (maç arası room=null) effect'i yeniden koşturmak eski tahtayı skorlatabilirdi.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working, gameEnd, cubePending, match.cube.value, turnsPlayed])

  // ---- Bot sirasi: kup teklifi -> zar -> oyna ----
  useEffect(() => {
    // PERF: lobide (home) DEGIL. Aksi halde kaydedilmis "bot sirasi" oyun lobide arka planda
    // bot hamlesini tetikler -> 26MB ONNX motoru landing'de bosuna yuklenir. Oyuna girince
    // (home=false, "Maça Dön"/Başla) calisir; motor gercek oyun basinda yuklenir.
    if (home) return
    if (!isBotTurn || gameEnd || matchOver || cubePending || botAnim || opening || played.length > 0)
      return
    let cancelled = false
    let timer: number
    if (!diceRolled) {
      timer = window.setTimeout(async () => {
        // Bota EK kup kisiti YOK (kullanici direktifi): ne olu-kup engeli ne de 8 tavani.
        // Tek kural canDouble (Crawford / sahiplik / 64 tavani) — insanla BIREBIR ayni.
        if (turnsPlayed > 0 && canDouble(match, BOT_PLAYER, false, isMoneyGame)) {
          try {
            const probs = await neuralRef.current.evalPosition(turnStart, BOT_PLAYER)
            const w = probs[0] + probs[1] + probs[2]
            if (!cancelled && w >= 0.7 && w <= 0.97) {
              recordCubePR(BOT_PLAYER, 'offer', 'double') // XG cube PR + .mat kaydı
              recordCubeEvent(BOT_PLAYER, 'double') // maç kaydı
              setCubePending(BOT_PLAYER)
              setMessage(t('msg.doubledAsk', { value: match.cube.value * 2 }))
              return
            }
            // Katlamadi -> bu da bir kup karari (no-double): XG'de paydaya girer.
            if (!cancelled) recordCubePR(BOT_PLAYER, 'offer', 'no-double')
          } catch {
            /* ag yuklenemedi - kupsuz devam */
          }
        }
        if (!cancelled) doRollFor(turnStart)
      }, BOT_ROLL_DELAY)
    } else {
      timer = window.setTimeout(async () => {
        const moves = generateMoves(turnStart)
        if (hasNoMove(moves)) {
          // Bot "hamle yok": hemen gecme -> popup 2sn gorunsun (botDance effect gecer)
          if (!cancelled) setBotDance(true)
          return
        }
        let move: Move
        try {
          setMessage(t('msg.neuralThinking'))
          move = await chooseBotMove(turnStart)
        } catch (e) {
          // Sinir agi yuklenemedi -> oyun takilmasin, hizli bota dus
          console.error('Sinir ağı hatası, hızlı bota geçildi:', e)
          if (!cancelled) setMessage(t('msg.neuralFailed'))
          move = heuristicRef.current.chooseMove(turnStart)
        }
        if (cancelled) return
        // Tas tas oynat: animasyonu baslat (bkz. bot animasyon effect'i)
        if (move.steps.length === 0) commitTurn([])
        else {
          setPlayed([])
          setBotAnim({ steps: move.steps, index: 0 })
        }
      }, BOT_MOVE_DELAY)
    }
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, isBotTurn, gameEnd, matchOver, cubePending, botAnim, opening, diceRolled, played, turnStart, engine, match, turnsPlayed])

  // ---- Bot "hamle yok" -> popup 2sn goster, sonra sirayi gec ----
  useEffect(() => {
    if (!botDance) return
    const name = pName(turnStart.turn)
    setMessage(t('msg.noMovePass', { name }))
    const timer = window.setTimeout(() => {
      setBotDance(false)
      commitTurn([])
    }, 2100)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botDance])

  // ---- Bot hamlesini tas tas oynat ----
  useEffect(() => {
    if (!botAnim) return
    if (botAnim.index >= botAnim.steps.length) {
      // Tum taslar oynandi -> kisa bekle, sirayi gec. DANCE (adim yok): bot zarini + "Hamle Yok"
      // overlay'ini (online && !myTurn) daha uzun goster ki kullanici botun ne attigini GORSUN.
      const sf = botAnim.serverFinal
      // Maçı bitiren hamlede son pozisyon sonuç ekranından ÖNCE okunabilsin diye biraz daha uzun bekle.
      const endDelay = botAnim.steps.length === 0 ? BOT_DANCE_DELAY : sf?.match?.done ? BOT_FINAL_DELAY : BOT_END_DELAY
      const t = window.setTimeout(() => {
        if (sf) {
          // SUNUCU-OTORİTER BOT: sunucu hamleyi zaten uyguladı -> commitTurn YERİNE otoriter durumu
          // uygula (tekrar serverMove YOLLAMA). srvTurnStartRef = animasyon başı (rollState) korunur.
          appliedServerVersionRef.current = sf.version
          if (room?.code) appliedServerRoomRef.current = room.code
          if (pendingBotFinalRef.current?.version === sf.version) pendingBotFinalRef.current = null
          applyServerBoard(sf.state, sf.match)
        } else {
          commitTurn(botAnim.steps)
        }
        setBotAnim(null)
      }, endDelay)
      return () => window.clearTimeout(t)
    }
    // Sonraki tasi oyna. ILK adimdan once daha uzun bekle (BOT_REVEAL_DELAY) -> bot zari net okunsun;
    // sonraki adimlar snappy (BOT_STEP_DELAY). Tur-devri hizini (BOT_END_DELAY) etkilemez.
    const stepDelay = botAnim.index === 0 ? BOT_REVEAL_DELAY : BOT_STEP_DELAY
    const t = window.setTimeout(() => {
      setPlayed(botAnim.steps.slice(0, botAnim.index + 1))
      // serverFinal KORUNMALI: eskiden ilk taştan sonra düşüyordu -> animasyon sonunda otoriter durum
      // (ve maç-sonu ekranı) uygulanmıyor, tahta poll'u bekliyordu.
      setBotAnim({ ...botAnim, index: botAnim.index + 1 })
    }, stepDelay)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botAnim])

  function doRollFor(base: GameState) {
    const dice = orderDice(fairRef.current.next()) // buyuk zar once (gorunum)
    playDice()
    setTurnStart(newTurn(base, dice))
    setMessage(t('msg.botPlaying', { dice: dice.join(', ') }))
  }

  // ---- Bot kup cevabi (insan katladiginda) ----
  useEffect(() => {
    if (mode !== 'pvb' || cubePending !== 'white') return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const probs = await neuralRef.current.evalPosition(turnStart, 'white')
        const botWin = probs[3] + probs[4] + probs[5]
        if (cancelled) return
        if (botWin >= 0.24) handleTake()
        else handleDrop()
      } catch {
        if (!cancelled) handleTake()
      }
    }, 800)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubePending, mode, turnStart])

  // ---- Analiz (her zar sonrasi guncellenir) ----
  // Not: PR/hata tespiti icin tur basi siralama panel KAPALIYKEN de hesaplanir.
  useEffect(() => {
    if (!interactive || !diceRolled || gameWon) return
    if (remainingDice.length === 0) return // tur tamamlandi, analiz yok
    // Panel kapali VE ogrenme modu kapali: mid-turn analiz yok (sadece tur basi -> PR)
    if (!showAnalysis && !learnMode && played.length > 0) return
    // Analiz durumu: hic oynanmadiysa tur basi; oynandiysa mevcut konum + kalan zarlar
    const analysisState =
      played.length === 0
        ? turnStart
        : (() => {
            const s = cloneState(working)
            s.dice = remainingDice.slice()
            s.diceUsed = remainingDice.map(() => false)
            return s
          })()
    let cancelled = false
    setAnalysisLoading(true)
    ;(async () => {
      try {
        const [r, cp] = await Promise.all([
          neuralRef.current.analyzeMoves(analysisState),
          neuralRef.current.evalPosition(analysisState, analysisState.turn),
        ])
        if (!cancelled) {
          if (played.length === 0) {
            turnRankedRef.current = r // tur basi siralama (PR + hata)
            // Sans (luck) artik burada DEGIL: recordPR icinde hesaplaniyor (bu effect
            // hizli oynayinca cleanup ile iptal olup luck'i kaybediyordu).
          }
          if (r.length > 0) {
            const b = r[0]
            setCurBest({
              notation: moveNotation(b.move, analysisState.turn),
              equity: b.equity,
              reasons: explainMove(analysisState, b.move, analysisState.turn),
            })
          }
          if (showAnalysis) {
            setRanked(r)
            setGnubgMoves(null) // gnubg hazır olana kadar wildbg listesi (aşağıda override edilir)
            setCurrentProbs(cp)
            setAnalysisBoard(analysisState)
          }
        }
        // HAKEM=gnubg: panel açık/öğrenme modunda GÖSTERİLEN ipucu+liste+equity gnubg'den olsun
        // (giriş yapılmış + servis erişilebilir). wildbg turnRankedRef (PR arka planı) korunur;
        // gnubg move nesnesi vermediğinden MiniBoard oku wildbg en iyi hamlesinde kalır (kozmetik).
        if (!cancelled && (showAnalysis || (learnMode && played.length === 0)) && botMatch && getToken()) {
          const dice2 = analysisState.dice.slice(0, 2)
          if (dice2.length === 2) {
            try {
              const g = await analyzePosition({
                points: analysisState.points,
                bar: analysisState.bar,
                turn: analysisState.turn,
                dice: dice2,
                cube: { value: match.cube.value, owner: match.cube.owner },
                score: { white: match.score.white, black: match.score.black },
                matchLength: match.target,
                plies: 2,
              })
              if (!cancelled && g.moves && g.moves.length > 0) {
                const gb = g.moves[0]
                setCurBest({ notation: gb.notation, equity: gb.equity, reasons: [] })
                if (showAnalysis) {
                  setGnubgMoves(g.moves)
                  if (gb.probs && gb.probs.length >= 6) setCurrentProbs(gb.probs)
                }
              }
            } catch {
              /* gnubg erişilemedi -> wildbg gösterimi kalır */
            }
          }
        }
      } catch (e) {
        // Sinir agi yuklenemedi/hata -> hizli (heuristik) siralama
        console.error('Analiz: sinir agi hatasi, hizli tahmine geciliyor:', e)
        if (!cancelled) {
          const mover = analysisState.turn
          const ranks = generateMoves(analysisState)
            .map((move) => ({
              move,
              equity: evaluatePosition(applyPlayed(analysisState, move.steps), mover),
              probs: [] as number[],
            }))
            .sort((a, b) => b.equity - a.equity)
          if (played.length === 0) turnRankedRef.current = ranks
          if (ranks.length > 0) {
            const b = ranks[0]
            setCurBest({
              notation: moveNotation(b.move, mover),
              equity: b.equity,
              reasons: explainMove(analysisState, b.move, mover),
            })
          }
          if (showAnalysis) {
            setRanked(ranks)
            setCurrentProbs(null)
            setAnalysisBoard(analysisState)
          }
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnalysis, learnMode, interactive, diceRolled, played, turnStart, working, remainingDice, gameWon])

  // ---- Kup danismani (insan) ----
  // Roll oncesi insan katlayabiliyorsa: teklif tavsiyesi. Insan kup teklifiyle
  // karsilastiysa: take/drop tavsiyesi. Sinir agiyla pozisyonu 1-ply degerlendirir.
  useEffect(() => {
    const humanColor: Player = online ? myColor : 'white'
    // Kup danismani SADECE bota karsi (pvb): online/pvp'de gostermek hile olur.
    const onRollCanDouble =
      botMatch &&
      interactive &&
      !diceRolled &&
      !gameWon &&
      turnsPlayed > 0 &&
      cubePending === null &&
      turnStart.turn === humanColor &&
      canDouble(match, humanColor, false, isMoneyGame)
    const facingDouble =
      botMatch &&
      cubePending !== null &&
      cubePending !== humanColor &&
      opponent(cubePending) === humanColor
    if (!onRollCanDouble && !facingDouble) {
      setCubeHint(null)
      cubeHintRef.current = null
      return
    }
    let cancelled = false
    // ADIM 5 (HAKEM=gnubg): küp danışmanı probs'u gnubg /analyze-position'dan (pvb + giriş + servis);
    // erişilemezse wildbg evalPosition fallback. Öneri mantığı (cubeAdvice/takeDecision) aynı kalır,
    // yalnız değerlendirme (kazanma%/gammon) gnubg olur.
    ;(async () => {
      let probs: number[] | null = null
      if (getToken()) {
        try {
          const g = await analyzePosition({
            points: turnStart.points,
            bar: turnStart.bar,
            turn: humanColor,
            dice: [],
            cube: { value: match.cube.value, owner: match.cube.owner },
            score: { white: match.score.white, black: match.score.black },
            matchLength: match.target,
            plies: 2,
          })
          if (g.probs && g.probs.length >= 6) probs = g.probs
        } catch {
          /* gnubg erişilemedi -> wildbg */
        }
      }
      if (!probs) {
        try {
          probs = await neuralRef.current.evalPosition(turnStart, humanColor)
        } catch {
          return
        }
      }
      if (cancelled || (probs?.length ?? 0) < 6) return
      const hint: CubeHint = onRollCanDouble
        ? { kind: 'offer', ...cubeAdvice(probs) }
        : { kind: 'respond', ...takeDecision(probs) }
      setCubeHint(hint)
      cubeHintRef.current = hint
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, interactive, diceRolled, gameWon, turnsPlayed, cubePending, turnStart, match, online, myColor])

  // Ogrenme modu tercihini sakla
  useEffect(() => {
    try {
      localStorage.setItem('tavla.learn', learnMode ? '1' : '0')
    } catch {
      /* yok */
    }
  }, [learnMode])

  // Tur/hamle degisince ipucu gorunumu sifirlansin (ogrenme modunda otomatik geri gelir)
  useEffect(() => {
    setHintShown(false)
    setCurBest(null)
  }, [turnStart, played.length])

  // Tur bastan sona zorunlu mu oynandi (oyuncu hic secim yapmadi)? -> otomatik onay.
  const fullyForcedRef = useRef(false)
  // Insan sirasi: hamle yok -> otomatik gec; ZORUNLU adim (baska alternatifi olmayan
  // zar) -> otomatik oyna (YAVAS, gorunur). Adim adim ilerler: sonraki adim da
  // zorunluysa o da oynanir. Secim varsa durur (oyuncu oynar).
  useEffect(() => {
    if (!interactive || !diceRolled) return
    // Mevcut pozisyon: tur basi -> turnStart; mid-turn -> working + kalan zarlar
    const cur =
      played.length === 0
        ? turnStart
        : (() => {
            const s = cloneState(working)
            s.dice = remainingDice.slice()
            s.diceUsed = remainingDice.map(() => false)
            return s
          })()
    const moves = generateMoves(cur)
    // Tur basi + hic hamle yok -> otomatik "hamle yok" deyip gec
    if (played.length === 0 && hasNoMove(moves)) {
      const name = pName(turnStart.turn)
      setMessage(t('msg.noMovePass', { name }))
      const timer = window.setTimeout(() => {
        commitTurn([])
      }, 2100) // "hamle yok" dark panel ~2sn ekranda kalsin
      return () => window.clearTimeout(timer)
    }
    // Yavas oto-oyna temposu: kullanici hamleyi net gorsun.
    const AUTO_STEP_MS = 1000
    // Pozisyon TAMAMEN zorunlu (moves.length === 1, hicbir alternatif yok) ->
    // sonraki tek adimi yavas + gorunur oynat. Effect kalan adim(lar) icin tekrar
    // calisir; boylece adim adim ilerler. Bir secim cikarsa durur (oyuncu oynar).
    if (moves.length === 1 && moves[0].steps.length > 0) {
      if (played.length === 0) fullyForcedRef.current = true
      // Tur BASTAN zorunlu degilse (oyuncu bir yerde secim yapti) kalan tek-yasal zari da
      // OTOMATIK OYNAMA -> kullanici kendi oynasin. Or. 5-3'te 5 oynanmaz + 3 cok sekilde, ya da
      // 6-2'de 6 cok sekilde + 2 zorunlu: elin tamami elle oynanir, kalan zar da elle.
      if (!fullyForcedRef.current) return
      setMessage(t('msg.forcedAuto'))
      const timer = window.setTimeout(() => playSteps([moves[0].steps[0]]), AUTO_STEP_MS)
      return () => window.clearTimeout(timer)
    }
    // Oyuncuya secim birakan bir pozisyon -> tur artik "tamamen zorunlu" degil.
    if (moves.length > 1) fullyForcedRef.current = false
    // Tur bastan sona zorunlu oynandiysa (oyuncu hic secim yapmadi) ve tum zarlar
    // bittiyse -> otomatik onayla (sirayi rakibe ver).
    if (fullyForcedRef.current && played.length > 0 && remainingDice.length === 0) {
      const timer = window.setTimeout(() => {
        fullyForcedRef.current = false
        handleConfirm()
      }, AUTO_STEP_MS)
      return () => window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, diceRolled, played.length, turnStart, working, remainingDice])

  // ---- Tur OTOMATIK tamamla: KAZANILDI ya da elde oynanamayan zar kaldi (baska hamle yok) ----
  // KRITIK: gameWon iken `interactive` FALSE olur -> yukaridaki oto-oyna effect'i calismaz; ayrica
  // oynanamayan zar kalinca (5-5 gelip 2 tas kalmasi gibi) o effect "Onayla"yi bekler. Iki durumda
  // da oyuncunun yapacagi baska sey yok -> el biter bitmez OTOMATIK onayla. Aksi halde oyuncu
  // "Onayla"yi beklerken sunucu saati biter ve KAZANDIGI eli HAKSIZ kaybeder (yasanan bug).
  useEffect(() => {
    if (!diceRolled || played.length === 0 || opening || cubePending || gameEnd || matchOver) return
    if (!myTurn) return
    const stuckLeftover = nextSteps.length === 0 && remainingDice.length > 0
    // stuckLeftover oto-onay YALNIZ tur tamamen zorunlu oynandiginda. Oyuncunun secimi vardiysa
    // (or. 5-3'te 5 oynanmaz, 3'u 2-3 sekilde) geri alip secebilsin, kalan oynanamayan zari KENDI
    // onaylasin. gameWon ise her halukarda oto-onay (saat kaybi onlenir).
    if (!gameWon && !(stuckLeftover && fullyForcedRef.current)) return
    const timer = window.setTimeout(() => handleConfirm(), 900) // el net gorunsun, sonra kapat
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameWon, diceRolled, played.length, nextSteps.length, remainingDice.length, myTurn, opening, cubePending, gameEnd, matchOver])

  // Acilis atisi sonucunu uygula: yuksek zar baslar (esit olamaz - cagiran garanti eder).
  function resolveOpening(w: number, b: number) {
    const winner: Player = w > b ? 'white' : 'black'
    setOpeningResult({
      white: w,
      black: b,
      winner,
      winnerDie: Math.max(w, b),
      loserDie: Math.min(w, b),
    })
    setOpening('reveal')
    setMessage(t('msg.openingResult', { name: pName(winner), a: Math.max(w, b), b: Math.min(w, b) }))
  }

  // Lokal: rasgele iki farkli zar.
  function handleOpeningRoll() {
    let w = secureDie()
    let b = secureDie()
    while (w === b) {
      w = secureDie()
      b = secureDie()
    }
    resolveOpening(w, b)
  }

  // Online: oda kodu + oyun no'dan DETERMINISTIK acilis -> iki istemci ayni sonucu
  // uretir (ekstra senkron gerekmez). Her oyunda skor toplamiyla degisir.
  function seededOpening(code: string, gameNo: number) {
    const seed = `${code}:${gameNo}`
    let h = 2166136261
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const w = (Math.abs(h) % 6) + 1
    let b = (Math.abs(h >> 5) % 6) + 1
    if (b === w) b = (b % 6) + 1 // esitse kaydir (asla berabere degil)
    resolveOpening(w, b)
  }

  // Acilis sonucunu goster, sonra kazananin turuyla basla (iki FARKLI zar -> ilk hamle asla cift degil)
  useEffect(() => {
    if (opening !== 'reveal' || !openingResult) return
    const { winner, winnerDie, loserDie } = openingResult
    const timer = window.setTimeout(() => {
      const s = freshBoard(winner)
      s.dice = [winnerDie, loserDie]
      s.diceUsed = [false, false]
      setTurnStart(s)
      setStarter(winner)
      setOpening(null)
      setMessage(t('msg.playing', { name: pName(winner), dice: `${winnerDie}, ${loserDie}` }))
    }, 1700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening, openingResult])

  // Acilis zarini OTOMATIK at (tum oyunlarda). Lokal -> rasgele; online -> oda
  // kodu + oyun no'dan deterministik (iki istemci ayni). Kimin baslayacagini belirler.
  useEffect(() => {
    // PERF: lobide (home) acilisi OTO-atma. Taze ziyaretcide varsayilan pvb oyunu opening='roll'
    // ile baslar; lobide atarsa bot sirasi gelir ve 26MB ONNX landing'de yuklenir. Oyuna girince
    // (home=false) acilis atilir. (Online zaten oynarken home=false; bu kosul onu etkilemez.)
    if (home) return
    if (opening !== 'roll' || cubePending || gameEnd || matchOver) return
    // Online'da rakip hazir olana kadar bekle (mm_waiting / tek kisi)
    if (online && (!onlineReady || room?.status !== 'playing')) return
    const fire = () => {
      if (online && room && authoritativeRef.current) {
        if (rollConflictRef.current) return
        // Faz 2: açılışı SUNUCU yapar (adil, deterministik). serverRoll opening+starter döner;
        // doRollAuthoritative taze tahtayı kurar. Sıra-değil hatası olursa (diğer taraf tetikledi)
        // poll server_state ile senkron gelir -> sessiz geç.
        void doRollAuthoritative()
      } else if (online && room) {
        // Faz 1/legacy: oyun no = maçta toplanan puan (iki istemci deterministik aynı açılış).
        seededOpening(room.code, match.score.white + match.score.black)
      } else {
        handleOpeningRoll()
      }
    }
    const id = window.setTimeout(fire, 800)
    // TEK ATIŞ YETMEZ (canlı bug: "Açılış zarı atılıyor…"da kalıcı takılma). İlk deneme ağ
    // hatasına/409'a/uçuş kilidine takılırsa hiçbir şey tekrar denemiyordu; overlay durdukça
    // periyodik yeniden dene. Sunucu açılışı IDEMPOTENT'tir (opened=true ise ikinci çağrı yeni
    // zar üretmez, reused/409 döner) -> tekrar güvenli. Overlay kalkınca effect temizlenir.
    // Retry HEM online HEM pvb (canlı bug: pvb'de sonraki oyun "Açılış zarı atılıyor…"da
    // takılıyordu — tek atış iptal olursa pvb'nin kurtarıcısı yoktu). fire() opening'i 'reveal'e
    // çevirince effect yeniden çalışır, guard erken döner, interval temizlenir -> güvenli.
    const retry = window.setInterval(fire, 2500)
    return () => {
      window.clearTimeout(id)
      window.clearInterval(retry)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, opening, online, onlineReady, room?.status, cubePending, gameEnd, matchOver])

  // SELF-HEAL ("Acilis zari atiliyor" kilidi kalkani): opening==='roll' + hala duran gameEnd/
  // cubePending = GECERSIZ kombinasyon. Bu, onceki oyun daha bitis-sonucu beklerken acilisin
  // ERKEN tetiklendigi anlamina gelir (race). Iki sonuc birden olur ve KILITLENIR:
  //   1) render acilis overlay'ini gameEnd'den ONCE cizer -> "Sonraki Oyun" kutusu gizlenir,
  //   2) otomatik-acilis effect'i guard'da gameEnd gorup timer'i bile kurmadan cikar -> zar hic
  //      atilmaz (retry de kurulmaz) -> SONSUZ takilma (kullanici raporu: "gene burda takildi").
  // Cozum: gameEnd'i SILME (bear-off effect'i yeniden tetikleyip CIFTE SKORLAR); bunun yerine
  // erken acilisi IPTAL et (opening=null). Boylece bekleyen oyun-sonu kutusu gorunur ve kullanicinin
  // "Sonraki Oyun"u (nextGame) TAM temiz reset yapar. Refresh'te applySavedGame'in yaptigi
  // (opening=null) ile ayni kurtarma; artik refresh gerekmez. Happy-path'te (gameEnd zaten null) no-op.
  useEffect(() => {
    if (opening === 'roll' && !matchOver && (gameEnd || cubePending)) {
      setOpening(null)
    }
  }, [opening, gameEnd, cubePending, matchOver])

  // Oyun durumunun imzasi (sadece oyunu ilgilendiren alanlar) -> echo tespiti
  function stateSig(
    m: MatchState,
    st: Player,
    tp: number,
    ts: GameState,
    pl: Step[],
    cp: Player | null = null,
    ge: GameEnd | null = null,
  ): string {
    return JSON.stringify({
      match: m,
      starter: st,
      turnsPlayed: tp,
      turnStart: ts,
      played: pl,
      cubePending: cp,
      // Sadece senkronla gosterilen bitisler imzayi degistirsin (normal galibiyet lokal)
      gameEnd: ge && (ge.dropped || ge.timeout || ge.resigned) ? ge : null,
    })
  }

  // ---- Oyun saati ----
  // Yeni tur/hamle sirasi baslayinca hamle gecikmesini sifirla.
  useEffect(() => {
    // ONLINE: saat TAMAMEN sunucu demirinden (clockAnchorRef -> interpClock) türetilir; delay'i
    // burada YEREL preset'le ezersek tur değişiminde bir an yanlış/yerel delay flaşlanır (sunucu
    // delay'i moda/hold'a göre farklı olabilir) = "anlamsız saniye" sınıfı titreme. Online'da dokunma.
    if (online) return
    // OFFLINE (pvb): yeni tur -> yalnizca hamle gecikmesini sifirla; rezerv bankasi tukenmeye devam eder.
    setClock((c) => ({ ...c, delay: clockRef.current.move }))
  }, [turnStart.turn, turnsPlayed, online])

  // Her saniye: once 12sn gecikme, o bitince ek sure (30+30) azalir.
  // KUP TEKLIFI beklerken saat DURMAZ: karar YANITLAYANIN oldugu icin sure onun
  // bankasindan isler (sunucu tarafinda ayni kural: MatchClock::turnSlotFromState).
  useEffect(() => {
    if (!clockOn || gameEnd || matchOver || opening || gameWon) return
    if (online && !onlineReady) return
    const active: Player = cubePending ? opponent(cubePending) : turnStart.turn

    if (online) {
      // ONLINE: ekranı sunucu demirinden (clockAnchorRef) yerel olarak türet. Poll (1.2sn)
      // sadece demiri tazeler; rakamı burada ~250ms'de yeniden hesaplarız -> her tam saniye
      // gösterilir, atlama olmaz. Kayıp kararı yine sunucuda (offline timeout efekti online'da devre dışı).
      const id = window.setInterval(() => {
        const a = clockAnchorRef.current
        if (!a) return
        // HOLD (bot-reveal grace): started_at gelecekteyken sunucu delay'i SABİT tutar. İstemci de
        // hold sn boyunca geri saymamalı (eff=0) yoksa 10'dan 9'a iner, her poll 10'a döner = titreme.
        // Türetme SAF interpClock'ta (src/online/clockView + test): NaN/negatif ekrana düşmez.
        const next = interpClock(a, Date.now())
        const cur = clockStateRef.current
        if (next.delay === cur.delay && next.white === cur.white && next.black === cur.black) return
        setClock(next)
      }, 250)
      return () => window.clearInterval(id)
    }

    // OFFLINE (pvb): poll yok -> yerel saniye sayacı zaten pürüzsüz.
    const id = window.setInterval(() => {
      setClock((c) => {
        if (c.delay > 0) return { ...c, delay: c.delay - 1 }
        // Gecikme bitti -> aktif oyuncunun rezerv bankasi azalir
        if (active === 'white') return { ...c, delay: 0, white: Math.max(0, c.white - 1) }
        return { ...c, delay: 0, black: Math.max(0, c.black - 1) }
      })
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockOn, gameEnd, matchOver, opening, cubePending, gameWon, turnStart.turn, online, onlineReady])

  // AFK geri sayimi (sunucu-otoriter): son 15sn'de saniye saniye akit (poll her ~1.2sn
  // duzeltir). Yalniz online'da; gercek kayip sunucuda ilan edilir.
  useEffect(() => {
    if (!online || afkLeft == null) return
    const id = window.setInterval(() => setAfkLeft((a) => (a == null ? a : Math.max(0, a - 1))), 1000)
    return () => window.clearInterval(id)
  // BİLEREK afkLeft değil `afkLeft == null`: değer her saniye değişir; dep olursa interval her
  // tikte yeniden kurulur. Sayım setAfkLeft(fn) ile yapılır, güncel değer gerekmez.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, afkLeft == null])

  // Ek sure bitti -> sirasi gelen oyuncu oyunu kaybeder.
  // ONLINE: karar SUNUCUDA verilir (state.gameEnd olarak gelir) -> burada lokal karar YOK
  // (aksi halde latency/drift ile haksiz kayip olur). Yalniz pvb (bota karsi) lokal calisir.
  useEffect(() => {
    if (online) return
    if (!clockOn || gameEnd || matchOver) return
    // Kup teklifi beklerken suresi akan taraf YANITLAYANDIR -> suresi biterse o kaybeder.
    const who: Player = cubePending ? opponent(cubePending) : turnStart.turn
    const bank = who === 'white' ? clock.white : clock.black
    if (clock.delay > 0 || bank > 0) return
    if (online && myColor !== who) return // online'da sadece suresi biten ilan etsin
    const w = opponent(who)
    // Rezerv saati mac-basidir: bitince maci komple kaybedersin (Galaxy tarzi forfeit)
    setMatch((m) => scoreGame(m, w, Math.max(m.cube.value, m.target - m.score[w])))
    setGameEnd({ winner: w, points: match.cube.value, mult: 1, dropped: false, timeout: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, clockOn, gameEnd, matchOver, turnStart.turn, cubePending, online, myColor])

  // Online analiz: oyun basinda sinir agini ONCEDEN yukle -> recordPR ilk hamleden
  // itibaren hazir (aksi halde tembel yukleme yavas kalir, ilk hamleler kaydedilmez).
  useEffect(() => {
    if (online && room?.status === 'playing') void neuralRef.current.ready().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.status])

  // BELLEK (Safari sekme-atma azaltma): lobide bosa dururken sinir agi ONNX session'larini serbest
  // birak. Olcum: native reload'larin cogu oyun ekraninda WASM yukluyken -> idle'da bu belle gi
  // tutmak iOS Safari'nin arka plan sekmeyi oldurup native reload etme baskisini artiriyordu. Idle =
  // aktif oyun yok (matchOver / hic oynanmamis + sonuc ekrani yok) + online-playing degil + analiz
  // modali kapali. init() mac/analiz acilinca tekrar tembel yukler. 30sn gecikme hizli lobi
  // gecislerinde gereksiz bosalt/yeniden-yukle savrulmasini onler.
  const hasActiveGameForMem = !matchOver && (turnsPlayed > 0 || !!gameEnd)
  useEffect(() => {
    if (hasActiveGameForMem) return
    if (online && room?.status === 'playing') return
    if (analyzerOpen) return
    const id = window.setTimeout(() => void neuralRef.current.dispose(), 30_000)
    return () => window.clearTimeout(id)
  }, [hasActiveGameForMem, online, room?.status, analyzerOpen])

  // ---- Turnuva maci: rakip 1dk icinde GELMEZSE hukmen (walkover) kazan ----
  // Yalniz bekleyen (status='waiting') turnuva macinda calisir; opponent odaya girince
  // status 'playing' olur -> effect cleanup timer'i iptal eder. Sunucu 60sn esigini +
  // rakibin gercekten girmedigini (slot token bos) DOGRULAR (istemci saati otoriter degil).
  useEffect(() => {
    const tm = tournMatchRef.current
    if (!online || !tm || room?.status !== 'waiting' || !room?.code) return
    const id = window.setTimeout(() => {
      tournamentNoShow(tm.tid, tm.matchKey)
        .then(() => {
          notify.success(t('tourn.walkover'))
          handleLeaveRoom()
        })
        .catch(() => {
          // rakip bu arada girdi / sure dolmadi -> sessizce beklemeye devam
        })
    }, 65000) // 60sn sunucu esigi + ag payi
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.status, room?.code])

  // ---- Turnuva bekleme: maç ekranındaki 60sn geri sayımı (görsel; yukarıdaki no-show hükmen verir)
  useEffect(() => {
    const tm = tournMatchRef.current
    if (!online || !tm || room?.status !== 'waiting' || !room?.code) {
      setTournWaitSec(60)
      return
    }
    const started = Date.now()
    setTournWaitSec(60)
    const id = window.setInterval(() => {
      setTournWaitSec(Math.max(0, 60 - Math.floor((Date.now() - started) / 1000)))
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.status, room?.code])

  // ---- Online mac bitince Elo puanini bildir (sadece giris yapmis kullanici) ----
  useEffect(() => {
    if (!online || !user || ratingReportedRef.current) return
    const mW = matchWinner(match)
    if (!mW) return
    ratingReportedRef.current = true
    const won = mW === myColor
    const oppRating = room?.oppRating ?? 1500
    const before = user.rating ?? 1500
    const reportRoomCode = room?.code ?? null
    // Bekleyen (async) hamle analizleri bitene kadar bekle (max ~1.5s) -> online analiz
    // log'u TAM kaydolsun (son hamleler kaybolmasin). Sonra en guncel log ile bildir.
    void (async () => {
      // PR LOADER'I HEMEN GÖSTER (kullanıcı raporu: "PR hesaplanıyor…" notu 3-4sn geç geliyordu): bu
      // akış rapor ÖNCESİ ~9sn bekleyebilir (analiz flush + sunucu 'finished' bekleme); setPrAnalyzing
      // eskiden YALNIZ rapor DÖNÜNCE true oluyordu -> sonuç ekranı o süre boyunca loader'sız "—"
      // gösteriyordu. Tüm online maçlar gnubg ile analiz edilir -> iyimser aç; rapor
      // gnubg_authoritative=false derse (aşağıda) ya da rapor tümden başarısızsa KAPAT.
      setPrAnalyzing(true)
      if (reportRoomCode && !room?.bot) setOppPrPending(true)
      for (let i = 0; i < 30 && pendingAnalysisRef.current > 0; i++) {
        await new Promise((res) => setTimeout(res, 100))
      }
      // Son setPrStats'lerin flush olması için kısa bekleme; sonra EN GUNCEL prStatsRef'ten
      // oku (rapor closure'undaki stale prStats degil) -> kendi PR'im "—" dusmesin.
      await new Promise((res) => setTimeout(res, 200))
      prDebugSummary() // PR DEBUG (§13): açıksa karar tablosu + toplam/PR konsola (online)
      // The local AI board can finish before the authoritative room is marked
      // finished. Wait for the server result before sending the rating report.
      if (reportRoomCode) {
        for (let i = 0; i < 20; i++) {
          try {
            const serverRoom = await showRoom(reportRoomCode)
            if (serverRoom?.status === 'finished') break
          } catch {
            // Retry the room poll below.
          }
          await new Promise((res) => setTimeout(res, 300))
        }
      }
      const prRef = (c: Player): number | null => {
        const s = prStatsRef.current[c]
        return s.decisions > 0 ? (s.loss / s.decisions) * 500 : null
      }
      const achExtra = buildAchExtra()
      // Tavlai Luck V1: .mat TEK KAYNAKTAN backend'de kurulur (stored log -> MatBuilder ->
      // MatSerializer). İstemcinin ürettiği .mat SUNUCUDA KULLANILMAZ (istemci kısmi-log'una
      // güvenilmez, "biri 0" bug'ı) -> boşa istemci-taraflı .mat üretmeyiz; yalnız TAM log gider.
      const doReport = () =>
        reportRating(
          won,
          oppRating,
          match.target,
          prRef(myColor),
          prLuck[myColor], // HAM kendi-renk luck -> sunucu iki oyuncunun hamını saklar, net'i istemci hesaplar (tutarlı)
          match.score[myColor],
          match.score[opponent(myColor)],
          room?.oppName ?? null,
          prRef(opponent(myColor)),
          // slice(-1000): TAM maçı kapsa. gnubg luck merge (MatBuilder) oyunları açılış-tespitiyle
          // böler; -250 truncation uzun çok-oyunlu maçta erken oyunları kırpıp bölmeyi bozuyordu
          // (luck sessizce yanlış). 1000 giriş gerçekçi tüm maçları kapsar + 1.2MB validation altında.
          JSON.stringify({ hc: myColor, log: matchLogRef.current.slice(-1000) }),
          !friendlyRef.current, // ranked: eslesme/solo puanli; ARKADASLIK maci puansiz
          room?.bot ? 'ai' : stakeRef.current > 0 ? 'coin' : 'match', // Bot=ai; Jeton=coin; N-puanlik=match
          room?.code ?? null, // oda kodu -> backend friendly odayi kesin puansiz yapar
          achExtra, // basarim sinyalleri (mars/katmerli, min WP, prime6/closeout)
          null, // .mat: backend stored log'dan (MatBuilder) kurar; istemci .mat'i kullanılmaz
        )
      // Gecici ag/sunucu hatasi tek denemede "puanin kaydedilemedi" gostermesin -> 3 kez dene.
      let r: Awaited<ReturnType<typeof reportRating>> | null = null
      let lastReportError: { status?: number } | null = null
      for (let attempt = 1; attempt <= 12 && !r; attempt++) {
        try {
          r = await doReport()
          lastReportError = null
        } catch (e) {
          lastReportError = e as { status?: number }
          // The authoritative room can become terminal a fraction after the local
          // result screen opens (especially after the bot's final server turn). Pull
          // the room and retry 409 until the canonical result is visible.
          if (lastReportError.status === 409 && reportRoomCode) {
            try {
              await showRoom(reportRoomCode)
            } catch {
              // The next attempt/poll will retry the room read.
            }
            if (attempt < 12) await new Promise((res) => setTimeout(res, 1000))
          } else if (attempt < 3) {
            await new Promise((res) => setTimeout(res, 800 * attempt))
          }
        }
      }
      if (!r) {
        // 3 denemede de olmadi -> kullaniciyi uyar + KURTARMA: raporu sakla, sonra (açılış/yeniden-
        // bağlanma) tekrar dene. Backend idempotent (oda+kullanıcı tek satır) -> düşen istemcinin
        // rating + analiz satırı + coin'i kaybolmaz. Log otoriter (sunucu skoru/PR'ı yeniden hesaplar).
        notify.error(t('net.ratingFailed'))
        savePendingReport([
          won,
          oppRating,
          match.target,
          prRef(myColor),
          prLuck[myColor], // HAM kendi-renk luck (bkz doReport) — pending retry de aynı semantik
          match.score[myColor],
          match.score[opponent(myColor)],
          room?.oppName ?? null,
          prRef(opponent(myColor)),
          JSON.stringify({ hc: myColor, log: matchLogRef.current.slice(-1000) }),
          !friendlyRef.current,
          room?.bot ? 'ai' : stakeRef.current > 0 ? 'coin' : 'match',
          room?.code ?? null,
          achExtra,
          null, // .mat: backend stored log'dan kurar; istemci .mat'i kullanılmaz
        ])
        // Rapor 12 denemede de gelmedi -> erken açtığımız PR loader'ını KAPAT (sonsuz "hesaplanıyor"
        // takılmasın; kurtarma raporu açılışta tekrar dener).
        setPrAnalyzing(false)
        setOppPrPending(false)
      } else {
        // Not YALNIZ sunucu AÇIKÇA rated:false derse (eski backend rated göndermez -> undefined ->
        // not gösterme; puanlı maçlar yanlışlıkla "puansız" etiketi almasın).
        // before = SUNUCU-otoriter rating_before (yerel user.rating drift edip sahte +1 gösterebilir).
        setRatingChange({ before: r.rating_before ?? before, after: r.rating, reason: r.rated === false ? (r.rating_reason ?? 'casual') : null, limit: r.friendly_rating_limit })
        setUser((u) => (u ? { ...u, rating: r!.rating } : u))
        if (r.achievements?.length) setAchUnlocked(r.achievements)
        // Sunucu-otoriter PR (iki oyuncuda AYNI). Rakip henuz raporlamadiysa poll et.
        const code = room?.code ?? null
        let oppPr = r.pr_opponent ?? null
        setServerPr({
          self: r.pr_self ?? null,
          opp: oppPr,
          checkerSelf: r.pr_checker_self ?? null,
          checkerOpp: r.pr_checker_opponent ?? null,
          cubeSelf: r.pr_cube_self ?? null,
          cubeOpp: r.pr_cube_opponent ?? null,
        })
        // Rakip PR'ı online insan maçında ayrı/geç gelir -> gelene kadar onun hücresinde "…" tut
        // (boş "—" değil). Bot/terk/forfeit'te rakip satırı olmayabilir; aşağıdaki poll ~90sn'de
        // gelmezse tavan vurup kapatır (sonsuz loader yok).
        setOppPrPending(!!code && !room?.bot && oppPr == null)
        // HAKEM=gnubg (online): kendi PR'ımı da gnubg gelene kadar LOADER göster, gnubg gelince
        // değiştir (wildbg sayısı gösterilmez). Rakip PR aşağıdaki matchPr poll'undan (o da gnubg).
        if (r.match_result_id) matchResultIdRef.current = r.match_result_id
        if (r.gnubg_authoritative && r.match_result_id) void pollGnubgPr(r.match_result_id)
        else setPrAnalyzing(false) // gnubg yok -> erken açtığımız loader'ı kapat (serverPr zaten dolu)
        // Sunucu-otoriter SANS: self/opp HAM luck'ı renge (white/black) eşle -> iki istemci
        // AYNI çifti tutar -> net TUTARLI. Gelmeyen (null) değeri önceki değeri korur (merge).
        const setLuckPair = (selfL?: number | null, oppL?: number | null) =>
          setServerLuck((prev) => {
            const next = { white: prev?.white ?? null, black: prev?.black ?? null }
            if (selfL != null) next[myColor] = selfL
            if (oppL != null) next[opponent(myColor)] = oppL
            return next
          })
        setLuckPair(r.luck_self, r.luck_opp)
        // Tavlai Luck V1: gnubg NATIVE MWC-luck (%) — renge eşle (self->myColor). Async (analyse
        // match) olduğundan ilkin null; poll ederek doldur. İkisi de gelince BAĞIMSIZ % gösterilir.
        const setLuckMwcPair = (selfL?: number | null, oppL?: number | null) =>
          setServerLuckMwc((prev) => {
            const next = { white: prev?.white ?? null, black: prev?.black ?? null }
            if (selfL != null) next[myColor] = selfL
            if (oppL != null) next[opponent(myColor)] = oppL
            return next
          })
        setLuckMwcPair(r.luck_mwc_self, r.luck_mwc_opp)
        // Maç Özeti: luck cost (emg) + joker — aynı renk eşlemesi (self->myColor).
        const setColorPair = (
          setter: typeof setServerLuckEmg,
          selfV?: number | null,
          oppV?: number | null,
        ) =>
          setter((prev) => {
            const next = { white: prev?.white ?? null, black: prev?.black ?? null }
            if (selfV != null) next[myColor] = selfV
            if (oppV != null) next[opponent(myColor)] = oppV
            return next
          })
        setColorPair(setServerLuckEmg, r.luck_emg_self, r.luck_emg_opp)
        setColorPair(setServerLuckJokers, r.luck_jokers_self, r.luck_jokers_opp)
        let oppLuckDone = r.luck_opp != null
        let mwcDone = r.luck_mwc_self != null && r.luck_mwc_opp != null
        if ((oppPr == null || !oppLuckDone || !mwcDone) && code) {
          // Rakip PR'ı (kaybedenin KENDİ gnubg satırı) otoriter kaynaktır; gnubg tek-thread/kuyrukta
          // yavaş olabildiğinden ~90sn poll et (eski 18sn penceresi kısa kalıp "—"da bırakıyordu).
          // 0 GERÇEK bir değerdir (kusursuz oyun): sunucu hazır değilken NULL döner, hesaplandıysa
          // gerçek değeri (0 dahil). Bu yüzden yalnız null'da poll'a devam; 0 gelirse 0 yaz (atma).
          for (let i = 0; i < 60 && (oppPr == null || !oppLuckDone || !mwcDone); i++) {
            await new Promise((res) => setTimeout(res, 1500))
            const pair = await matchPr(code)
            if (pair.opponent != null) {
              oppPr = pair.opponent
              setOppPrPending(false) // rakip PR geldi -> "…" kapan, sayı göster
              // Rakip raporunu YENI tamamladiysa kirilim da o an gelir; gelmeyen ONCEKI kalir.
              setServerPr((prev) => ({
                self: pair.self ?? prev?.self ?? r!.pr_self ?? null,
                opp: pair.opponent,
                checkerSelf: pair.checker_self ?? prev?.checkerSelf ?? null,
                checkerOpp: pair.checker_opponent ?? prev?.checkerOpp ?? null,
                cubeSelf: pair.cube_self ?? prev?.cubeSelf ?? null,
                cubeOpp: pair.cube_opponent ?? prev?.cubeOpp ?? null,
              }))
            }
            if (pair.luck_opp != null || pair.luck_self != null) {
              setLuckPair(pair.luck_self, pair.luck_opp)
              if (pair.luck_opp != null) oppLuckDone = true
            }
            if (pair.luck_mwc_self != null || pair.luck_mwc_opp != null) {
              setLuckMwcPair(pair.luck_mwc_self, pair.luck_mwc_opp)
              if (pair.luck_mwc_self != null && pair.luck_mwc_opp != null) mwcDone = true
            }
            setColorPair(setServerLuckEmg, pair.luck_emg_self, pair.luck_emg_opp)
            setColorPair(setServerLuckJokers, pair.luck_jokers_self, pair.luck_jokers_opp)
          }
        }
        setOppPrPending(false) // poll bitti (geldi ya da ~90sn tavan) -> sonsuz "…" bırakma
      }
    })()
    // Bahisli oyun (Tek Oyun sabit / Mac Oyunu %) -> coin transferi.
    // Sunucu kazanani yetkili belirler; rakip beyani/durum gec gelirse pending doner,
    // settleRoomConfirmed birkac kez deneyip guncel bakiyeyi getirir.
    if (!friendlyRef.current && (stakeRef.current > 0 || betPctRef.current > 0) && room?.code) {
      settleRoomConfirmed(room.code, won)
        .then((r) => {
          if (typeof r.coins === 'number') setUser((u) => (u ? { ...u, coins: r.coins } : u))
          // Mac sonu coin gosterimi. Komisyon: kazanan won_amount (stake x (1-komisyon)) alir,
          // kaybeden TAM stake oder -> ASIMETRIK (kazanan +861 / kaybeden -1013 gibi).
          if (r.ok && typeof r.stake === 'number') {
            const wonAmt = typeof r.won_amount === 'number' ? r.won_amount : r.stake
            setCoinDelta(won ? wonAmt : -r.stake)
            setCoinPair({ won: wonAmt, lost: r.stake })
          } else if (!r.ok && r.pending) {
            // rakip henuz sonucu bildirmedi -> coin askida (uyar)
            notify.error(t('net.settlePending'))
          }
        })
        .catch(() => {
          notify.error(t('net.settleFailed'))
          // KURTARMA: settle'ı sakla, açılış/yeniden-bağlanmada tekrar dene (settle atomik+idempotent).
          if (room?.code) savePendingSettle(room.code, won)
        })
      stakeRef.current = 0
      betPctRef.current = 0
    }
    // Turnuva maciysa sonucu otomatik bildir (bracket ilerlesin)
    const tm = tournMatchRef.current
    if (tm && user) {
      const winnerId = won ? user.id : tm.oppId
      reportTournament(tm.tid, tm.matchKey, winnerId).catch(() => {})
      tournMatchRef.current = null
    }
    // Hata gunlugu: bu macin en kotu hamlelerini kaydet (yalnizca kendi hamlelerim)
    if (user) {
      // Mac baglami: hangi mac / kiminle / kac kac (online rakip = insan)
      const ctx = {
        opp: room?.oppName ?? null,
        ai_level: null,
        score_me: match.score[myColor],
        score_opp: match.score[opponent(myColor)],
        won,
      }
      const bl = matchLog
        // Yalnız CHECKER hamleleri: küp girdilerinde notation/best BOŞ ('') olur; backend
        // 'played'/'best' required -> boş string 422 verir ve TEK bozuk item TÜM kaydı düşürür
        // (geçerli hamle blunder'ları da kaybolur). Küp hataları zaten KÜP PR'da görünür.
        .filter((e) => e.loss >= 0.08 && e.player === myColor && !!e.notation)
        .sort((a, b) => b.loss - a.loss)
        .slice(0, 5)
        .map((e) => ({
        loss: e.loss,
        played: e.notation,
        best: e.best,
        pos: e.pos ? JSON.stringify(e.pos) : undefined,
        steps: e.steps ? JSON.stringify(e.steps) : undefined,
        player: e.player,
        ...ctx,
      }))
      saveBlunders(bl).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, user, match, myColor, room])

  // pvb: bot PR'ı artık SENTETİK değil — insan gibi GERÇEK ölçülür (prStats[black] pool'u).
  // (Kullanıcı kararı: bot da aynı cetvelle ölçülsün; "Hedef PR" seviye vaadleri kaldırıldı.)

  // HAKEM=gnubg: maç sonrası gnubg PR (async job) hazır olana kadar poll'la; hazır olunca
  // gösterilen PR'ı gnubg ile DEĞİŞTİR (wildbg sayısı asla kalıcı gösterilmez). Servis yavaş/kapalı
  // ise ~50sn sonra fallback (istemci değeri serverPr'da zaten var). Yeni rapor/maç eski poll'u iptal.
  async function pollGnubgPr(id: number) {
    const token = ++prPollRef.current
    setPrAnalyzing(true)
    let prDone = false
    let luckDone = false
    // gnubg hazır olana kadar poll et (~3 dk). wildbg'ye ASLA düşme; hazır değilse LOADER kalır.
    for (let i = 0; i < 90 && !(prDone && luckDone); i++) {
      await new Promise((res) => setTimeout(res, 2000))
      if (prPollRef.current !== token) return // iptal edildi (yeni maç/rapor)
      try {
        const g = await matchGnubgPr(id)
        if (prPollRef.current !== token) return
        if (!prDone && g.ready) {
          // pvb: bot (rakip) gnubg PR de aynı job'la geldi -> opp/checkerOpp/cubeOpp doldur (yoksa
          // önceki değeri koru; online'da null gelir, matchPr poll'u karşı satırdan doldurur).
          setServerPr((prev) => ({
            self: g.pr,
            opp: g.opponent_pr ?? prev?.opp ?? null,
            checkerSelf: g.checker_pr,
            checkerOpp: g.opponent_checker_pr ?? prev?.checkerOpp ?? null,
            cubeSelf: g.cube_pr,
            cubeOpp: g.opponent_cube_pr ?? prev?.cubeOpp ?? null,
          }))
          setPrAnalyzing(false)
          prDone = true
        } else if (!prDone && g.settled) {
          // ANALİZ BİTTİ AMA PR YOK (forfeit / çok kısa maç = değerlendirilecek karar yok -> sunucu
          // mezar taşı: gnubg_pr null + gnubg_pr_at set). Eskiden `ready` hiç true olmayıp loader
          // SONSUZA dek dönüyordu (#ABBAB 2-hamle hükmen -> 5 dk spinner). Dürüst "—" göster.
          setPrAnalyzing(false)
          prDone = true
        }
        // ADIM 4: gnubg NATIVE şans (Luck V1) hazır olunca swap. pvb: insan=beyaz, bot=siyah.
        if (!luckDone && g.luck_ready) {
          setServerLuckMwc({ white: g.luck_mwc, black: g.opponent_luck_mwc })
          // Maç Özeti: luck cost (emg) + joker — aynı renk eşlemesi (pvb: insan=beyaz, bot=siyah).
          setServerLuckEmg({ white: g.luck_emg ?? null, black: g.opponent_luck_emg ?? null })
          setServerLuckJokers({ white: g.luck_jokers ?? null, black: g.opponent_luck_jokers ?? null })
          luckDone = true
        }
      } catch {
        /* geçici hata -> tekrar dene */
      }
    }
    // TIMEOUT (gnubg ~3dk gelmedi): wildbg SAYISINI GÖSTERME (kullanıcı direktifi: yalnız gnubg PR).
    // AMA loader'ı da SONSUZA dek döndürme -> dürüst "—" (kesin gnubg PR "Maç Analizleri"nde görünür).
    // Güvenlik ağı: settled hiç gelmese bile (ör. job hiç dispatch edilmedi) ~3dk sonra spinner durur.
    if (prPollRef.current === token && !prDone) setPrAnalyzing(false)
  }

  // RAKİP PR EMNİYET AĞI (kök fix "rakip gene yok"): sonuç ekranı açıkken rakip PR hâlâ gelmemişse
  // matchPr'ı BAĞIMSIZ poll et. doReport içindeki tek-atış inline döngüsü (effect re-run / oda kodu
  // yarışı / token yok) rakip değerini KAÇIRABİLİYORDU -> ekran "—"da kalıyordu (oysa DB'de hazır:
  // rakibin kendi satırı VEYA benim gnubg_opponent_pr'ım). Bu effect, serverPr.opp null olduğu sürece
  // (online, bot değil, oda kodu var) ~3 dk boyunca poll eder; geldiğinde serverPr.opp'u + kırılımı
  // yazar ve oppPrPending'i kapatır. Geldi/gelmedi 3dk sonra pending kapanır (sonsuz "…" yok).
  useEffect(() => {
    const code = room?.code
    if (!online || !matchOver || !mWinner || room?.bot || !code) return
    if (!serverPr || serverPr.opp != null) return // zaten var -> poll gereksiz
    let cancelled = false
    setOppPrPending(true)
    void (async () => {
      for (let i = 0; i < 60 && !cancelled; i++) {
        await new Promise((res) => setTimeout(res, 3000))
        if (cancelled) return
        try {
          const pair = await matchPr(code)
          if (cancelled) return
          if (pair.opponent != null) {
            setServerPr((prev) => ({
              self: pair.self ?? prev?.self ?? null,
              opp: pair.opponent,
              checkerSelf: pair.checker_self ?? prev?.checkerSelf ?? null,
              checkerOpp: pair.checker_opponent ?? prev?.checkerOpp ?? null,
              cubeSelf: pair.cube_self ?? prev?.cubeSelf ?? null,
              cubeOpp: pair.cube_opponent ?? prev?.cubeOpp ?? null,
            }))
            setOppPrPending(false)
            return
          }
        } catch {
          /* geçici hata -> tekrar dene */
        }
      }
      if (!cancelled) setOppPrPending(false) // ~3dk geldi gelmedi -> dürüst "—" (loader sonsuz dönmesin)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, matchOver, mWinner, room?.code, room?.bot, serverPr?.opp])

  // Bota karsi mac bitince de puan islensin (bot puani zorluga gore).
  // Casual (rankedMatch=false) macta puana/lig'e etki yok; PR + hata gunlugu kalir.
  useEffect(() => {
    if (mode !== 'pvb' || !user || ratingReportedRef.current) return
    const mW = matchWinner(match)
    if (!mW) return
    // HAYALET MAÇ KORUMASI: "Maçtan Çekil" INSAN daha HIC hamle yapmadan basılınca oynanmamış
    // bir AI KAYBI "Maç Analizleri"ne yazılıyordu. ONEMLI: açılış zarı BOTA (siyah) başlama
    // hakkı verirse bot ÖNCE oynar -> turnsPlayed>0 + matchLog dolu olur ama insan hâlâ hiç
    // oynamamıştır; bu yüzden (matchLog boş && turnsPlayed==0) guard'ı YETMEZ. İnsanın (beyaz)
    // commit ettiği tur sayısı 0 ise maçı KAYDETME (bkz humanTurnsRef).
    if (humanTurnsRef.current === 0) return
    ratingReportedRef.current = true
    // Giris yapmis kullanicinin AI maci HER ZAMAN kaydedilir (misafir haric).
    // Casual'da rating degismez: ranked=false -> backend Elo/lig islemez, delta=0 kaydeder.
    const botRating = 900 + difficulty * 100 // seviye 1 -> 1000, seviye 10 -> 1900
    const won = mW === 'white' // pvb'de insan beyaz
    const before = user.rating ?? 1500
    void (async () => {
      // Bekleyen (async) hamle analizleri bitene kadar bekle (max ~3s) -> PR/luck/log TAM
      // olsun; sonra stale closure yerine EN GUNCEL ref'lerden oku. (Online tarafiyla ayni.)
      for (let i = 0; i < 30 && pendingAnalysisRef.current > 0; i++) {
        await new Promise((res) => setTimeout(res, 100))
      }
      await new Promise((res) => setTimeout(res, 200)) // son setPrStats/setPrLuck flush'i
      prDebugSummary() // PR DEBUG (§13): açıksa karar tablosu + toplam/PR konsola (pvb)
      const prRef = (c: Player): number | null => {
        const s = prStatsRef.current[c]
        return s.decisions > 0 ? (s.loss / s.decisions) * 500 : null
      }
      const logNow = matchLogRef.current
      // match_type='ai' -> "Mac Analizleri"nde gorunur AMA rating/WXP/median/performans
      // istatistiklerine GIRMEZ (backend ranked=false zorlar + MatchResult::real haric tutar).
      const args = [
        won,
        botRating,
        match.target,
        prRef('white'),
        // MUTLAK kendi-renk (insan=beyaz) HAM luck'i -> MatchResult ekraniyla AYNI semantik.
        // (Eskiden white-black goreceli gonderiliyordu; bot luck'i hicbir yere yazilmadigindan
        //  "Mac Analizleri"nde AI'nin sansi HIC gozukmuyordu.)
        prLuckRef.current.white,
        match.score.white,
        match.score.black,
        `${AI_LEVELS[difficulty - 1]}`,
        prRef('black'), // bot PR: GERÇEK ölçüm (sentetik seviye değeri kaldırıldı)
        JSON.stringify({ hc: 'white', log: logNow.slice(-1000) }),
        rankedMatch,
        'ai', // match_type -> yapay zeka
        room?.code ?? null, // sunucu-otoriter AI odasi -> backend sonucu oda skorundan dogrular
        buildAchExtra(), // basarim sinyalleri (mars/katmerli, min WP, prime6/closeout)
        null, // mat yok (pvb'de gnubg NATIVE MWC job'i calismaz -> ham luck gosterilir)
        prLuckRef.current.black, // rakip (bot) HAM luck'i -> opponent_luck kolonuna yazilir
      ]
      // ONLINE ile AYNI DAYANIKLILIK: 3 deneme + basarisizsa pending-retry (acilis/online'da
      // tekrar denenir). Onceki `.catch(()=>{})` ag hatasinda AI macini SESSIZCE kaybediyordu.
      let r: Awaited<ReturnType<typeof reportRating>> | null = null
      for (let attempt = 1; attempt <= 3 && !r; attempt++) {
        try {
          r = await reportRating(...(args as Parameters<typeof reportRating>))
        } catch {
          if (attempt < 3) await new Promise((res) => setTimeout(res, 800 * attempt))
        }
      }
      if (!r) {
        savePendingReport(args as unknown[]) // sonra (acilis/online) tekrar denenir (idempotent)
      } else {
        // Not YALNIZ sunucu AÇIKÇA rated:false derse (eski backend rated göndermez -> undefined ->
        // not gösterme; puanlı maçlar yanlışlıkla "puansız" etiketi almasın).
        // before = SUNUCU-otoriter rating_before (yerel user.rating drift edip sahte +1 gösterebilir).
        setRatingChange({ before: r.rating_before ?? before, after: r.rating, reason: r.rated === false ? (r.rating_reason ?? 'casual') : null, limit: r.friendly_rating_limit })
        setUser((u) => (u ? { ...u, rating: r!.rating } : u))
        if (r.achievements?.length) setAchUnlocked(r.achievements)
        // pvb: kendi PR + BOT PR ikisi de gnubg (authoritative) -> pollGnubgPr doldurur. Başlangıçta
        // opp=null; analyzingBoth ile iki tarafta da loader gösterilir (wildbg sayısı ASLA gösterilmez).
        setServerPr({ self: r.pr_self ?? null, opp: null })
        // HAKEM=gnubg: gösterilen PR gnubg olsun. Job async -> "…" göster, gnubg gelince swap.
        if (r.match_result_id) matchResultIdRef.current = r.match_result_id
        if (r.gnubg_authoritative && r.match_result_id) void pollGnubgPr(r.match_result_id)
        else setPrAnalyzing(false)
      }

      // Hata gunlugu: bu macin en kotu hamlelerini kaydet (yalnizca insan; bot degil)
      const ctx = {
        opp: null,
        ai_level: difficulty,
        score_me: match.score.white,
        score_opp: match.score.black,
        won: mW === 'white',
      }
      const bl = logNow
        // Yalnız CHECKER hamleleri (küp girdileri boş notation -> backend 422). Bkz online dalı.
        .filter((e) => e.loss >= 0.08 && e.player === 'white' && !!e.notation)
        .sort((a, b) => b.loss - a.loss)
        .slice(0, 5)
        .map((e) => ({
          loss: e.loss,
          played: e.notation,
          best: e.best,
          pos: e.pos ? JSON.stringify(e.pos) : undefined,
          steps: e.steps ? JSON.stringify(e.steps) : undefined,
          player: e.player,
          ...ctx,
        }))
      saveBlunders(bl).catch(() => {})
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user, match, difficulty])

  // ---- Online: sunucudan gelen durumu uygula ----
  function applyOnlineState(snap: SavedGame) {
    // Uygulanan durumu imzala ki geri gonderme (echo) olmasin
    lastSyncRef.current = stateSig(
      snap.match,
      snap.starter,
      snap.turnsPlayed,
      snap.turnStart,
      snap.played ?? [],
      snap.cubePending ?? null,
      snap.gameEnd ?? null,
    )
    setMatch(snap.match)
    setStarter(snap.starter)
    setTurnsPlayed(snap.turnsPlayed)
    setTurnStart(snap.turnStart)
    setPlayed(snap.played ?? [])
    // Rakibin gonderdigi saati al
    if (snap.clock)
      setClock({
        delay: snap.clock.delay ?? MOVE_DELAY,
        white: snap.clock.white ?? snap.clock.over ?? OVER_TOTAL,
        black: snap.clock.black ?? snap.clock.over ?? OVER_TOTAL,
      })
    setSelectedFrom(null)
    setCubePending(snap.cubePending ?? null) // rakibin kup teklifi/yaniti senkron
    // Rakibin PR + Sans'ini kendi renginden al (kendi rengimi lokal hesaplarim)
    const oppColor = opponent(myColor)
    if (snap.pr?.[oppColor]) {
      setPrStats((s) => ({ ...s, [oppColor]: snap.pr![oppColor] }))
    }
    if (snap.luck && typeof snap.luck[oppColor] === 'number') {
      setPrLuck((s) => ({ ...s, [oppColor]: snap.luck![oppColor] }))
    }
    // Rakibin analiz hamlelerini birlestir: kendi hamlelerim + rakibin gonderdikleri.
    // KAYIPSIZ: snapshot rakibin logunun yalniz SON 80 girdisini tasir (~tek uzun oyun);
    // gelen listeyle EZMEK cok oyunlu macta rakibin erken oyunlarini siliyordu -> .mat'te
    // o oyunlarin sag sutunu bos kaliyordu. mergeOppLog ortusmeyi bulup oncesini KORUR.
    if (snap.moves) {
      const oppMoves = snap.moves.filter((e) => e.player === oppColor)
      setMatchLog((prev) => [
        ...prev.filter((e) => e.player === myColor),
        ...mergeOppLog(
          prev.filter((e) => e.player === oppColor),
          oppMoves,
        ),
      ])
    }
    setBotAnim(null)
    setOpening(null)
    setOppStarted(true)
    // Oyun sonu (normal galibiyet DAHIL) senkronla: aliciya gameEnd, kendi kazanma
    // effect'inden ONCE set edilir -> effect `if (gameEnd) return` ile atlar (cift-sayim
    // yok) ve skor iki istemcide de tutar. null senkronlanmaz (sonraki-oyun gecisinde
    // rakibin sonuc ekrani erken kapanmasin; her oyuncu kendi "sonraki oyun"uyla ilerler).
    if (snap.gameEnd) setGameEnd(snap.gameEnd)
  }

  // §5.2 replay zamanlayıcılarını + durumunu TEMİZLE (yeni otoriter durum geldi / oda değişti / ayrıldı).
  function clearOppReplay() {
    oppReplayTimersRef.current.forEach((t) => window.clearTimeout(t))
    oppReplayTimersRef.current = []
    if (oppReplayRef.current) {
      oppReplayRef.current = null
      setOppReplay(null)
    }
  }

  // §5.2 ONAYLI rakip hamlesini adım adım oynat (COSMETIC). `base` = rakibin tur-başı tahtası (zarlı),
  // `steps` = reconstruct edilen hamle, `oc` = rakip rengi. Otoriteye (turnStart/skor/saat) DOKUNMAZ;
  // tahta gösterimini (boardDisplay) kısa süre base+adımlar olarak tutar, bitince otoriter sonuca döner.
  function maybeReplayOppMove(base: GameState, steps: Step[], oc: Player) {
    if (!online || room?.bot) return // bot'un kendi reveal animasyonu var (botAnim) — çift oynatma yok
    const canAnim =
      animOn && moveStyle !== 'off' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!canAnim || steps.length === 0) return
    if (resultShowingRef.current || inLobbyRef.current) return
    const start = replayStartIndex(oppLiveShownRef.current, steps)
    if (start >= steps.length) return // canlı önizleme (room.live) zaten tamamını gösterdi
    clearOppReplay()
    setOppReplay({ base, steps, shown: start, color: oc })
    oppReplayRef.current = { base, steps, shown: start, color: oc }
    const timers: number[] = []
    for (let i = start; i < steps.length; i++) {
      timers.push(
        window.setTimeout(
          () => {
            const st = steps[i]
            const r = sourceRect(st.from) // o anki (replay) tahtada kaynağı yakala -> hedefe uçur
            if (r) pendingOppFlightRef.current = { to: st.to, srcRect: r, offColor: oc }
            if (!resultShowingRef.current && !inLobbyRef.current) {
              const pre = applyPlayed(base, steps.slice(0, i))
              const moverSign = oc === 'white' ? 1 : -1
              const hit =
                typeof st.to === 'number' &&
                pre.points[st.to] !== 0 &&
                Math.sign(pre.points[st.to]) !== moverSign &&
                Math.abs(pre.points[st.to]) === 1
              if (hit) Sound.hit()
              else Sound.move()
            }
            setOppReplay((cur) => (cur ? { ...cur, shown: i + 1 } : cur))
          },
          (i - start + 1) * 450,
        ),
      )
    }
    // GÜVENLİK: her koşulda temizle (stick engeli) — son adımdan ~0.6sn sonra otoriter sonuca dön.
    timers.push(window.setTimeout(() => clearOppReplay(), (steps.length - start) * 450 + 600))
    oppReplayTimersRef.current = timers
  }

  // Sunucu-otoriter durumu (server_state + server_match) uygula (Faz 2). Yalniz TUR SINIRINDA
  // cagirilir (mid-move'u ezmemek icin poll'da korunur). Otorite SUNUCU: tahta + skor + KUP +
  // Crawford + mac-bitti hepsi sunucudan gelir; istemci yalniz yansitir (forge edemez).
  function applyServerBoard(gs: GameState, sm?: ServerMatch | null) {
    // Önceki hamlenin replay'i (varsa) bitmeden yeni otoriter durum geldi -> replay'i bitir (truth göster).
    if (oppReplayRef.current) clearOppReplay()
    // RAKIBIN HAMLESINI GERI URET. Otoriter modda applyOnlineState CALISMAZ; rakip
    // hamlelerini matchLog'a katan tek yer orasiydi (snap.moves birlestirmesi) ->
    // matchLog tek tarafli kaliyor, disa aktarilan .mat'te rakip sutunu BOMBOS oluyor
    // ve XG "The game contains some invalid moves" diyor (gnubg luck/PR de eksik).
    // Otoriter gecis rakibin hamlesini tek anlamli belirler: rakibin tur-basi durumu
    // (zarlariyla) + yeni tahta -> ayni tahtaya goturen legal/maksimal terminal.
    const prev = srvTurnStartRef.current
    // Rakip KAZANAN hamlesinde sunucu sirayi DEVRETMEZ (oyun bitti) -> gs.turn === prev.turn olur.
    // O yuzden oyun-bitti (sm.done) durumunda tur-devri sartini ARAMA; aksi halde rakibin son
    // (kazanan) toplamasi loga girmez ve .mat sonuc satiri OLMADAN kesilir (tavlatv-mac(4) bug'i).
    const ended = !!sm?.done
    // GÜVENLİK (KAYBEDEN KİLİDİ KÖK FIX): rakip-hamle rekonstrüksiyonu SALT maç-kaydı/.mat export
    // içindir. reconstructOppMove/notation kazananın BİTİREN (bear-off) hamlesinde throw edebilir;
    // try/catch ile sararız ki aşağıdaki setTurnStart/setMatch/setGameEnd HER ZAMAN çalışsın. Aksi
    // halde applyServerBoard burada kesilir, maç-durumu (matchOver/gameEnd) HİÇ uygulanmaz ve
    // KAYBEDEN taraf maç-sonu ekranını GÖREMEZ (poll her seferinde yeniden throw -> kalıcı kilit).
    try {
    // RAKIP ZAR/HAMLE GECIKMESI KÖK FIX: taban artık `prev.dice`'a BAĞLI DEĞİL. Rakibin "zar
    // atıldı-ama-oynanmadı" ara pollü kaçtığında (hızlı oyuncu/bot/çift zar) prev zarsızdı ->
    // reconstruct null -> snap. oppMoveBase, zarı otoriter `sm.lastMove`'tan tamamlayıp doğru
    // tur-başı tabanını kurar (tahta düzeni zaten hamle-öncesi). Böylece hamle HER ZAMAN adım adım
    // oynanır ve rakibin zarı adımlardan ÖNCE (replay base'inde) görünür.
    const oppBase = online ? oppMoveBase(prev, gs, sm?.lastMove, myColor, ended) : null
    if (oppBase) {
      const sig = `${boardKey(oppBase)}|${oppBase.dice.join('')}|${boardKey(gs)}`
      if (sig !== oppLoggedRef.current) {
        // Dance (oynanamayan tur) bos dizi olarak doner -> o da yazilir; aksi halde
        // .mat'te tur atlanir ve sutun almasigi bozulur. Cozulemezse null -> kayit YOK
        // (uydurma satir yazmaktansa eksik birakmak yeglenir).
        const steps = reconstructOppMove(oppBase, gs, ended)
        if (steps) {
          oppLoggedRef.current = sig
          const oc = oppBase.turn
          setMatchLog((l) => [
            ...l,
            {
              notation: moveNotation({ steps, resultKey: '' }, oc),
              best: '',
              loss: 0,
              pos: cloneState(oppBase),
              steps,
              playedSteps: steps,
              player: oc,
              dice: oppBase.dice.slice(0, 2),
              seq: turnsPlayedRef.current,
            },
          ])
          // MAÇ KAYDI (game_logs): rakibin turunu KENDİ kolonuma da yaz. Böylece TEK istemcinin
          // flush'ı bile sunucuda TAM .mat üretir (yarım-kolon "rakip sütunu boş" bug'ı çözülür).
          // seq matchLog ile AYNI (ortak sıra); sunucu merge (g,s,o) ile tekilleştirir -> iki
          // istemci de yazınca çiftlenme olmaz. (Küp kararı hâlâ tek-yazar; hamleler artık iki-taraflı.)
          const rec = gameRecordRef.current
          if (rec && !rec.done) {
            rec.events.push({
              g: rec.gameNo,
              s: turnsPlayedRef.current,
              p: oc === 'white' ? 'W' : 'B',
              d: (oppBase.dice ?? []).join('-'),
              m: turnNotation(steps, oc),
            })
          }
          // §5.2: onaylı rakip hamlesini adım adım OYNAT (snap yerine). Oyun bittiyse (ended) ATLA —
          // maç/oyun sonu ekranı ayrı akış; bitiren hamleyi replay'e bağlamak kırılgan olur.
          if (!ended) maybeReplayOppMove(oppBase, steps, oc)
        }
      }
    }
    } catch {
      /* reconstruct/notation SALT kayıt içindir; hata durum senkronunu BLOKLAMAZ (kaybeden kilidi fix) */
    }
    syncEnabledRef.current = true
    setTurnStart(gs)
    setPlayed([])
    setSelectedFrom(null)
    setRanked(null)
    setCurrentProbs(null)
    if (sm) {
      // Skor + KÜP (değer/sahip/bekleyen) SAF reduce'la (src/online/authSync + 2-istemci sim testi).
      const lm = serverMatchToLocal(sm, match.target)
      setMatch((m) => ({
        ...m,
        target: lm.target,
        score: lm.score,
        cube: { value: lm.cubeValue, owner: lm.cubeOwner },
        isCrawford: lm.crawford, // Crawford'da kup YASAK (sunucu da reddeder) -> buton cikmasin
      }))
      setCubePending(lm.cubePending)
      // RAKİP ZAR GÖSTERİMİ: rakibin (color !== myColor) son hamlesinin zarını, YENİ (v) ise kısa
      // süre göster -> poll/push "zar atıldı ama oynanmadı" ara durumunu kaçırsa bile rakibin ne
      // attığı sırası açılınca görünür (rapor: "sıra rakipteyken gelen zarları göremedim"). Cosmetic.
      const oppLastMove = sm.lastMove
      if (
        online && oppLastMove && oppLastMove.color !== myColor &&
        Array.isArray(oppLastMove.dice) && oppLastMove.dice.length >= 1 &&
        oppLastMove.v !== lastOppRollVRef.current
      ) {
        lastOppRollVRef.current = oppLastMove.v
        setOppRoll({ dice: oppLastMove.dice.slice(0, 2), at: Date.now() })
      }
      // TUR SAYACI otoriter modda SUNUCUDAN gelir: commitTurn authoritative dalinda erken
      // doner (yerel setTurnsPlayed calismaz) -> sayac 0'da kalirsa `turnsPlayed > 0` sarti
      // hic saglanmaz: "Katla" butonu HIC gorunmez ve shouldAutoRoll her turu otomatik atar.
      setTurnsPlayed(lm.turns)
      // Açılış overlay kararı da saf: opened=false->'roll' (yeni oyun), true->null (kaldır), done->keep.
      const os = openingStateFromMatch(sm)
      if (os !== 'roll') rollConflictRef.current = false
      if (os === 'keep') {
        // MAÇ BİTTİ (sunucu). KRİTİK: authoritative modda yerel oyun-sonu effect'i (winner(working))
        // ATLANIR -> gameEnd'i burada SUNUCU sonucundan kurmazsak MatchResult ekranı HİÇ açılmaz;
        // skor güncellenip matchOver true olur ama sonuç görünmez ("oyun bitmedi" + sadece hata
        // toast'i yaşanan bug). Yalnız bir kez yaz (mevcut null ise).
        if (sm.done && sm.winner) {
          const w = sm.winner
          setGameEnd((g) => g ?? { winner: w, points: lm.cubeValue, mult: 1, dropped: false })
        }
      } else {
        if (os === 'roll') setOppRoll(null) // yeni oyun başladı -> önceki oyunun rakip-zarı bayat kalmasın
        setGameEnd(null) // yeni oyun -> önceki oyun-sonu ekranını temizle
        setOpening(os)
      }
    }
    if (!winner(gs)) setMessage(t('msg.turnOf', { name: pName(gs.turn) }))
  }

  // ---- SUNUCU-OTORİTER BOT: botun (siyah) sunucuda oynadığı turu istemcide uygula ----
  // Botun hamlesi serverRoll/serverMove/botNudge yanıtındaki bot[] turlarında GELİR (yerel motor
  // YOK). Her tur applyServerBoard ile uygulanır; reconstructOppMove'un prev'i = bt.rollState
  // (zar-atılmış tur-başı) -> botun hamlesi tek anlamlı çözülür + matchLog'a yazılır (.mat/PR).
  function applyBotTurn(bt: BotTurn, animate = false) {
    const steps = (bt.steps ?? []) as Step[]
    const rollDice = ((bt.rollState as GameState)?.dice ?? []) as number[]
    // SNAP (animasyon YOK): (a) çoklu tur (nadir oyun geçişi) VEYA (b) ZAR YOK = küp teklifi/pas
    // VEYA (c) MAÇ-SONU turu (bt.match.done). Zar yoksa gösterilecek zar da yoktur; küp teklifinde
    // tahta değişmez (pending gösterilir).
    // NOT: "hamle yok" (dance) ARTIK snap DEĞİL -> zarı VAR, aşağıda gösterilir (kullanıcı raporu:
    // "bot gele attı göremedim" = dance'te bot zarı hiç görünmeden snap'leniyordu).
    // MAÇ-SONU (c) KÖK FIX (#HM9V4 "bot zar atmıyor"): maç BOTUN kazanan hamlesiyle biterse sonuç
    // (done=true) durumunu botAnim timer'ına bağlamak kırılgandır — araya giren bir setBotAnim(null)
    // (poll/başka effect) bekleyen serverFinal timeout'unu iptal eder, gameEnd HİÇ kurulmaz ve
    // kaybeden ölü tahtada kilitli kalır (settle de çalışmaz). Maç-sonunu DAİMA senkron uygula.
    // MAÇ-SONU turu artık ANİMASYONLA oynanır (kullanıcı: "botun son hamlesini göremiyorum, direkt
    // sonuç ekranı geliyor"). #HM9V4 kilitlenmesine karşı: son durum pendingBotFinalRef'e yazılır ve
    // animasyondan BAĞIMSIZ bir güvenlik zamanlayıcısı onu her koşulda uygular (iptal edilse bile).
    const matchDone = !!(bt.match as ServerMatch)?.done
    if (!animate || rollDice.length === 0 || (matchDone && steps.length === 0)) {
      srvTurnStartRef.current = bt.rollState as GameState // reconstruct için prev (bot dice dolu)
      appliedServerVersionRef.current = bt.version
      if (room?.code) appliedServerRoomRef.current = room.code
      if (steps.length > 0) playDice()
      applyServerBoard(bt.state as GameState, (bt.match as ServerMatch) ?? null)
      return
    }
    // ZAR VAR (normal hamle VEYA dance): önce rollState'i (bot zarı dolu tur-başı) göster; botAnim
    // effect adımları tek tek oynatır (dance'te 0 adım -> zar + "Hamle Yok" overlay'i BOT_DANCE_DELAY
    // kadar görünür, sonra serverFinal uygulanır). commitTurn YOK -> tekrar serverMove YOLLANMAZ.
    // appliedServerVersionRef'i ŞİMDİ yaz -> poll animasyonu KESİP snap'lemesin.
    srvTurnStartRef.current = bt.rollState as GameState
    appliedServerVersionRef.current = bt.version
    if (room?.code) appliedServerRoomRef.current = room.code
    playDice()
    setTurnStart(bt.rollState as GameState)
    setPlayed([])
    const serverFinal = { state: bt.state as GameState, match: (bt.match as ServerMatch) ?? null, version: bt.version }
    if (matchDone && room?.code) {
      const code = room.code
      pendingBotFinalRef.current = { code, ...serverFinal }
      const budget = BOT_REVEAL_DELAY + steps.length * BOT_STEP_DELAY + BOT_FINAL_DELAY + 1500
      window.setTimeout(() => flushPendingBotFinal(code, serverFinal.version), budget)
    }
    setBotAnim({ steps, index: 0, serverFinal })
  }
  // Bekleyen maç-sonu durumunu (henüz uygulanmadıysa) uygula. Oda değiştiyse (oyuncu çıktı/yeni maç)
  // eski maçın sonu yeni tahtaya ASLA yazılmaz.
  function flushPendingBotFinal(code: string, version: number) {
    const p = pendingBotFinalRef.current
    if (!p || p.code !== code || p.version !== version) return
    pendingBotFinalRef.current = null
    if (appliedServerRoomRef.current !== code) return
    applyServerBoard(p.state, p.match)
    setBotAnim(null)
  }
  function applyBotTurns(turns?: BotTurn[] | null): boolean {
    if (!turns || turns.length === 0) return false
    // TEK bot turu -> zarı göster + tas-tas animasyon (dance dahil: zar + "Hamle Yok" görünür).
    // Nadir çoklu tur (oyun geçişi) -> snap (animasyon zincirlemesi karmaşık; tahta yine doğru kalır).
    const animate = turns.length === 1
    for (const bt of turns) applyBotTurn(bt, animate)
    return true
  }
  // gnubg geçici yoksa (bot_status='unavailable') botu tekrar dener. Backend senkron sürer;
  // servis gelince tur döner. Birkaç deneme sonra bırakır (poll yine de nihai durumu getirir).
  function scheduleBotNudge(code: string, tries = 0) {
    if (botNudgeTimerRef.current) window.clearTimeout(botNudgeTimerRef.current)
    if (tries > 6) return
    botNudgeTimerRef.current = window.setTimeout(() => {
      botNudge(code)
        .then((r) => {
          if (!applyBotTurns(r?.bot) && r?.bot_status === 'unavailable') {
            scheduleBotNudge(code, tries + 1)
          }
        })
        .catch(() => scheduleBotNudge(code, tries + 1))
    }, 1500)
  }

  // Poll (stale-closure) icin guncel tur/oynanan + authoritative ref'lerini tazele.
  useEffect(() => {
    srvTurnStartRef.current = turnStart
  }, [turnStart])
  useEffect(() => {
    srvPlayedRef.current = played
  }, [played])
  useEffect(() => {
    botAnimRef.current = botAnim !== null
  }, [botAnim])
  useEffect(() => {
    openingRef.current = opening
  }, [opening])
  useEffect(() => {
    authoritativeRef.current = !!room?.authoritative
  }, [room?.authoritative])
  useEffect(() => {
    diceAuthorityRef.current = !!room?.dice_authority
  }, [room?.dice_authority])

  // Online: yerel degisikligi odaya gonder (senkron)
  // ONEMLI: bagimliliklarda tum `room` nesnesi YOK -> her yoklamada (oppName/status
  // yenilenince) tekrar gondermeyi onler. Ayrica imza ayni ise (echo) gondermez;
  // aksi halde iki istemci birbirinin eski durumunu yeniden uygulayip hamleyi siler.
  const roomCode = room?.code
  const roomStatus = room?.status
  // DİREKTİF: TÜM MAÇLAR OTORİTER -> legacy tum-state PUT (updateRoom) senkronu KALDIRILDI.
  // Otoriter oda legacy PUT'u acceptsLegacyState=false ile 409 reddeder; ayrıca authoritative
  // bayrağı gecikince bu debounce yarışla PUT atıp "PUT /rooms 409 (Conflict)" üretiyordu.
  // Durum artık yalnız server_state'te: roll/move uçları günceller, poll geri okur.
  // (Maç-sonu 'finished' yazımı da sunucu tarafında applyGameResult/applyClockEnd ile yapılır.)
  void roomStatus // deps sadeleştirildi; roomStatus başka yerde de okunuyor (unused değil)

  // Online MAÇ SONU: son tahtayı + 'finished'i ODAYA GARANTİ yaz (izleyiciler donmasın).
  // SORUN: yukarıdaki sync 200ms debounce'lu + yalnız status==='playing' iken çalışır; maç
  // bitince (matchOver) istemci MatchResult'a geçip sync'i kapatınca son push İPTAL olabiliyor
  // -> izleyici son-öncesi karede DONUYOR ve 'finished' hiç gelmiyor (sonuç görünmez). Burada
  // matchOver olur olmaz ANINDA (debounce yok) tek sefer final snapshot + 'finished' gönderilir.
  const finalPushedRef = useRef(false)
  useEffect(() => {
    if (!matchOver) {
      finalPushedRef.current = false // yeni maç/rövanş için sıfırla
      return
    }
    if (
      finalPushedRef.current ||
      !online ||
      !roomCode ||
      authoritativeRef.current ||
      room?.authoritative ||
      roomLeavingRef.current === roomCode
    ) return
    finalPushedRef.current = true
    const snap = {
      mode,
      difficulty,
      match,
      starter,
      turnsPlayed,
      turnStart,
      played,
      clock: { delay: clock.delay, white: clock.white, black: clock.black },
      gameEnd,
      cubePending,
      pr: prStats,
      luck: prLuck,
      moves: matchLog.filter((e) => e.player === myColor).slice(-80),
    }
    updateRoom(roomCode, snap, 'finished').catch(() => {
      finalPushedRef.current = false // hata -> tekrar denenebilsin
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchOver, online, roomCode])

  // MAÇ-SONU EMNİYET SUBABI (KAYBEDEN KİLİDİ — #FSYZH): sunucu maçı bitirdiyse (room.status
  // 'finished'; poll bunu KOŞULSUZ yazar) ama yerelde hâlâ matchOver DEĞİLSE, TAM durumu sunucudan
  // (since'siz -> server_state + server_match GARANTİ) çek ve KOŞULSUZ uygula. Poll'un içindeki
  // terminal-apply herhangi bir edge'de (server_match eksik/sürüm muhasebesi/istisna) kaçırsa bile
  // KAYBEDEN taraf MatchResult'ı görür. Bir kez çalışır: matchOver true olunca dep değişir, durur.
  useEffect(() => {
    if (!online || !room?.code || room.status !== 'finished' || matchOver) return
    let cancelled = false
    void showRoom(room.code)
      .then((rv) => {
        if (cancelled || !rv?.server_state) return
        appliedServerVersionRef.current = rv.server_version ?? appliedServerVersionRef.current
        appliedServerRoomRef.current = room.code
        applyServerBoard(rv.server_state as GameState, rv.server_match ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, matchOver, online, room?.code])

  // Online: odayi periyodik yokla (rakip hamlesi + durum)
  useEffect(() => {
    if (!online || !room) return
    setEndReason(null) // yeni oda/rövanş: önceki maçın saat-kaybı sebebini temizle
    let cancelled = false
    // PUSH YEDEĞİ (Faz 2 / gerçek-zamanlı): Reverb WS bağlıyken periyodik poll'u ~9sn'ye yavaşlat
    // (yalnız yedek); 'room.updated' olayı poll(true) ile ANINDA çeker. Bağlı değilken (push
    // kapalı/bağlanamadı) eski 1.2sn tam-poll aynen sürer -> sıfır davranış değişikliği.
    let realtimeConnected = false
    let lastFetchAt = 0
    const poll = async (force = false) => {
      if (cancelled) return // oda temizlendi (404 / unmount) -> interval son kez tetiklese de iş yapma
      if (Date.now() < apiBackoffUntilRef.current) return // 429 sonrası geri-çekilme: poll'u da durdur
      if (!force && realtimeConnected && Date.now() - lastFetchAt < 2500) return // push bağlı -> yedek ~2.5sn (soket boşluğunda bile en fazla 2.5sn'de güncelleme; hamleler zaten anında push)
      lastFetchAt = Date.now()
      try {
        // Oda sürümleri oda-yereldir. Son uygulanan sürümü gönderince backend
        // değişiklik yoksa 204 döner; büyük state her 1.2 saniyede yeniden taşınmaz.
        const isAuthoritative = authoritativeRef.current || !!room.authoritative
        const appliedVersion = isAuthoritative
          ? appliedServerVersionRef.current
          : appliedVersionRef.current
        // RÖVANŞ BEKLERKEN since GÖNDERME: rematch_code oda server_version'ını BUMP ETMEZ; maç bitince
        // (saat durunca) show 204 döner ve YENİ oda kodu poll ile HİÇ gelmezdi -> bekleyen taraf
        // (kabul edip rakibini bekleyen) maça yönlenmiyordu. Beklerken tam gövde al -> rematch.code gelsin.
        const rematchWaiting = rematchSentRef.current === 'yes' && rematchEnteredRef.current == null
        const since = rematchWaiting ? undefined : appliedVersion >= 0 ? appliedVersion : undefined
        const rv = await showRoom(room.code, since)
        if (cancelled || !rv) return
        // DAVET REDDEDILDI: hedefli davetin bekleme ekranindayiz ve rakip reddetti -> bildir +
        // lobiye don. (Eskiden red davet edene hic ulasmiyor, "{ad} bekleniyor"da kaliyordu.)
        if (rv.invite_declined && inviteDeclinedRef.current !== room.code) {
          inviteDeclinedRef.current = room.code
          notify.info(t('friends.inviteDeclined', { name: inviteWaitNameRef.current || t('mh.opponentFb') }))
          handleLeaveRoom()
          return
        }
        if (rv.pot != null) potRef.current = rv.pot // oynanan gercek pot (yuzde maçta eslesmede kesinlesir)
        setRoom((r) =>
          r
            ? {
                ...r,
                oppName: r.slot === 'p1' ? rv.p2_name : rv.p1_name,
                oppRating: r.slot === 'p1' ? rv.p2_rating : rv.p1_rating,
                oppAvatar: r.slot === 'p1' ? rv.p2_avatar : rv.p1_avatar,
                oppFrame: r.slot === 'p1' ? (rv.p2_frame ?? null) : (rv.p1_frame ?? null),
                oppCountry: r.slot === 'p1' ? (rv.p2_country ?? null) : (rv.p1_country ?? null),
                oppPremium: r.slot === 'p1' ? rv.p2_premium : rv.p1_premium,
                oppId: r.slot === 'p1' ? (rv.p2_user_id ?? null) : (rv.p1_user_id ?? null),
                status: rv.status,
                authoritative: rv.authoritative ?? r.authoritative,
                server_version: rv.server_version ?? r.server_version,
                dice_authority: rv.dice_authority ?? r.dice_authority,
                classic: rv.classic ?? r.classic, // Klasik Tavla bayrağı (küp yok + mars=2)
                live: rv.live ?? null, // canlı rakip önizlemesi (cosmetic)
              }
            : r,
        )
        if (rv.messages) setChat(rv.messages)
        // ROVANS: rakibin cevabini yansit; kod gelince (iki taraf da 'yes') ayni ayarlarla
        // acilan YENI odaya gec. Ayar ref'leri once set edilir -> puan/bahis/tempo korunur.
        if (rv.rematch) {
          const rm = rv.rematch
          const srvMine = room.slot === 'p1' ? rm.p1 : rm.p2
          setRematch({
            // Sunucu cevabimi henuz yazmadiysa (istek ucusta) GONDERDIGIMI koru -> buton titremez.
            mine: srvMine ?? rematchSentRef.current,
            theirs: room.slot === 'p1' ? rm.p2 : rm.p1,
            code: rm.code,
          })
          if (srvMine) rematchSentRef.current = srvMine // sunucu yakaladi -> iyimser deger biter
          if (rm.code && rematchEnteredRef.current !== rm.code && rematchEnteringRef.current !== rm.code) {
            rematchEnteringRef.current = rm.code
            const tgt = rv.target ?? onlineTargetRef.current
            friendlyRef.current = rv.mode === 'friendly'
            stakeRef.current = rv.stake ?? 0
            betPctRef.current = rv.bet_pct ?? 0
            onlineTargetRef.current = tgt
            matchTargetSyncedRef.current = true
            // Odaya girmeyi BASARIRSAK kodu isaretle. Basarisizsa isaretleme: sonraki poll
            // yeniden dener (aksi halde ref pesin yazildigi icin iki taraf da sonuc ekraninda
            // kilitli kaliyordu ve rovans bir daha ASLA denenmiyordu).
            const ok = await enterOnlineByCode(rm.code, tgt)
            rematchEnteringRef.current = null
            if (ok) rematchEnteredRef.current = rm.code
            return
          }
        }
        // SUNUCU-OTORİTER MAÇ UZUNLUĞU: coklu-uzunluk secen bekleyen oyuncunun (p1) yerel `target`
        // degeri PLACEHOLDER'dir (secilenlerin max'i); gercek uzunlugu sunucu eslesmede belirler
        // (rv.target = ortak uzunluklarin en yukseigi). Bunu HER POLL'da otoriter kabul et: eski kod
        // yalniz `appliedVersion<0` iken (oyun baslamadan) uyguluyordu; p1 acilis zarini atinca
        // version ilerledigi icin duzeltme ENGELLENIP p1 placeholder'da (or. 11) TAKILI kaliyordu ->
        // iki istemci farkli uzunluk gosterirdi. GUVENLI: yalniz `target` alanini duzelt (skor/board'a
        // DOKUNMA). rv.target sabit oldugundan bir kez uygulanip esitlenir, tekrar tetiklenmez.
        if (rv.target != null && rv.target !== onlineTargetRef.current) {
          onlineTargetRef.current = rv.target
          matchTargetSyncedRef.current = true
          setMatch((m) => ({ ...m, target: rv.target as number }))
          setClock(freshMatchClock(rv.target))
          // Coklu bahis: bekleyen oyuncu eslesince sunucunun anlastigi tutari uygula.
          if (rv.stake != null && rv.stake > 0) stakeRef.current = rv.stake
        }
        // Sunucu-otoriter mod (Faz 2c DRAFT): bayragi yakala; server_state'i YALNIZ tur
        // sinirinda uygula (kendi zarim/hamlem elimdeyken ezme). Legacy state sync atlanir.
        authoritativeRef.current = rv.authoritative ?? authoritativeRef.current
        // BAGIMSIZ Faz 1: zar-otorite bayragini yakala (doRoll serverRoll'a gitsin). Legacy
        // PUT/move akisi degismez; yalniz zar kaynagi sunucu olur.
        diceAuthorityRef.current = rv.dice_authority ?? diceAuthorityRef.current
        // EMNIYET SUBABI: uygulanan surum BASKA ODAYA aitse sifirla (her yeni oda
        // server_version 0/1'den baslar; sifirlanmazsa "surum ilerledi mi" kontrolu KALICI
        // olarak basarisiz olur ve poll otoriter durumu bir daha ASLA uygulamaz -> acilisi
        // kaybeden taraf "Acilis zari atiliyor"da takilir). resetRoomSync giris noktalarinda
        // zaten sifirliyor; bu, kacan bir yol kalirsa kendini onarir.
        //
        // DIKKAT: bu karar SURUM SIRASINA BAKARAK verilemez. Ayni odada surumun geride gelmesi
        // "eski oda" degil, UCUSTA KALMIS ESKI BIR POLL YANITI demektir; onu eskimis sayip ref'i
        // sifirlamak eski durumu tahtaya uygulatiyor ve oyuncunun ONAYLADIGI HAMLE GERI ALINIYOR
        // (sonra sunucu "Sira sende degil"/"Once zar at" der). Bkz. serverSyncRoomChanged.
        if (serverSyncRoomChanged(appliedServerRoomRef.current, room.code)) {
          appliedServerVersionRef.current = -1
          appliedServerRoomRef.current = room.code
        }
        // MAÇ-SONU KESİN UYGULAMA (KÖK FIX #KVU8X): sunucu maçı bitirdiyse (status 'finished' VEYA
        // server_match.done) terminal durumu shouldApplyServerState/mid-move/turn kapısına TAKILMADAN
        // KOŞULSUZ uygula. Aksi halde forfeit/timeout ile biten maçta (özellikle yeni-oyun açılışı
        // sırasında: done=true AMA opened=true + zar + turn kalır) istemci "aktif tahta"da kalıp zar
        // atmayı sürdürür -> POST /roll 409 "Oyun aktif değil" spam + maç-sonu ekranı HİÇ gelmez.
        // setRoom zaten status'ü güncelliyor ama applyServerBoard (skor+gameEnd) kapıya takılıydı.
        // Sürüm ilerlediğinde bir kez uygula (idempotent; done bump'ı version'ı artırır). return YOK:
        // aşağıdaki saat-durdurma (srvDone) mantığı da çalışsın.
        const srvTerminal = !!(isAuthoritative && rv.server_state && (rv.status === 'finished' || rv.server_match?.done))
        // Botun maçı bitiren hamlesi ekranda oynanırken terminal durumu ERKEN uygulama (sonuç ekranı
        // animasyonun önüne geçmesin); animasyon sonu ya da güvenlik zamanlayıcısı uygular.
        const botFinalPending = pendingBotFinalRef.current?.code === room.code
        if (srvTerminal && !botFinalPending && (rv.server_version ?? 0) > appliedServerVersionRef.current) {
          try {
            applyServerBoard(rv.server_state as GameState, rv.server_match ?? null)
            appliedServerVersionRef.current = rv.server_version ?? 0
            appliedServerRoomRef.current = room.code
          } catch {
            appliedServerVersionRef.current = -1
          }
        }
        // AÇILIŞ KALKANI: hâlâ "Açılış zarı atılıyor…" ekranındayız ama sunucuda oyun ZATEN
        // açılmışsa surum muhasebesine BAKMADAN uygula. Acilisi ilk tetikleyemeyen taraf
        // (reused/409) tek bir kacirilmis apply'da sonsuza kadar bu ekranda kaliyordu.
        const stuckOpening = openingNeedsResync(openingRef.current === 'roll', rv)
        if (stuckOpening) appliedServerVersionRef.current = -1
        // Poll-apply kararı SAF fonksiyonda (src/online/authSync + test). midMove yalnız KENDİ
        // turumda geçerli; rakip turundaysak daima senkronla (açılış desync fix — bkz authSync).
        // srvTerminal iken normal apply ATLA (terminal dal zaten uyguladı; çift-apply yok).
        if (
          !srvTerminal &&
          (stuckOpening ||
          shouldApplyServerState(
            {
              turn: srvTurnStartRef.current?.turn ?? 'white',
              diceCount: srvTurnStartRef.current?.dice?.length ?? 0,
              playedCount: srvPlayedRef.current.length,
              appliedServerVersion: appliedServerVersionRef.current,
            },
            rv,
            myColor,
          ))
        ) {
          // ÖNCE uygula, SONRA "uygulandı" yaz. Ters sırada, applyServerBoard içinde atılan bir
          // istisna sürümü uygulanmış SAYDIRIYOR ve poll o durumu bir daha getirmiyordu
          // (kalıcı takılma). Hata olursa ref -1'e döner -> sonraki poll yeniden dener.
          try {
            applyServerBoard(rv.server_state as GameState, rv.server_match) // tahta + skor + kup + Crawford
            appliedServerVersionRef.current = rv.server_version ?? 0
            appliedServerRoomRef.current = room.code // surum + ait oldugu oda BIRLIKTE yazilir
          } catch {
            appliedServerVersionRef.current = -1
          }
        } else if (!rv.authoritative && rv.version > appliedVersionRef.current && rv.state) {
          appliedVersionRef.current = rv.version
          syncEnabledRef.current = true
          applyOnlineState(rv.state as SavedGame) // lastSyncRef'i kendi ayarlar (echo yok)
        }
        // Sunucu-otoriter saat: her poll'de (state degismese de) guncel saat + AFK.
        // Kayip (timeout/AFK) sunucu tarafinda ilan edilir ve state.gameEnd olarak gelir
        // (applyOnlineState onu uygular) -> lokal timeout karari online'da devre disi.
        // MAC BITTI -> sunucu saatini artik uygulama. Yerel sayac zaten gameEnd/matchOver
        // ile duruyordu ama otoriter modda saat POLL'dan geliyor: sonuc ekraninin ARKASINDA
        // sayac akmaya devam ediyordu. Sunucu tarafinda da tick durduruldu; bu istemci
        // korumasi deploy oncesi acilmis odalar icin de gecerli.
        const srvDone = !!rv.server_match?.done || rv.status === 'finished'
        // Saat/terk kaybı sebebini yakala (rv.clock.loss, srvDone'dan BAĞIMSIZ okunur; sonuç
        // ekranında "Süre doldu / Hareketsizlik / Terk" gösterilir). Normal bitişte loss=null.
        if (rv.clock?.loss?.reason) setEndReason(rv.clock.loss.reason)
        const sc = srvDone ? null : rv.clock
        // BOT ANIMASYONU (botAnim): bot hamlesi EKRANDA oynanirken sunucu saatini YAZMA. Sunucuda
        // bot aninda oynayip sirayi/saati insana (p1) devrettigi icin bu araligi yazmak "sira botta
        // ama beyaz sayim eriyor" desync'ini uretir. Animasyon bitip serverFinal uygulaninca (bir
        // sonraki poll) gercek saat (reveal-grace'li) yazilir; o ana kadar yerel saat (aktif=siyah).
        if (sc && !botAnimRef.current) {
          const act = sc.active === 'white' ? 'white' : sc.active === 'black' ? 'black' : null
          // Demiri tazele (ekrandaki rakamı DEĞİL): interpolasyon tick'i buradan pürüzsüz sayar.
          clockAnchorRef.current = { delay: sc.delay, hold: (sc as { hold?: number }).hold ?? 0, white: sc.white, black: sc.black, active: act, at: Date.now() }
          setSrvActive(act)
          setAfkLeft(sc.afk)
        } else if (srvDone) {
          setSrvActive(null) // aktif taraf vurgusu + AFK geri sayimi da dursun
          setAfkLeft(null)
        }
      } catch (e) {
        const st = (e as { status?: number })?.status
        // 404: oda SUNUCUDA YOK (silinmiş / süresi dolmuş). Bayat referansı temizle + poll'u durdur
        // -> aksi halde kullanıcı kurulum/ana sayfadayken bile her 1.2sn boşa 404 atılıyordu
        // (konsol kirliliği + gereksiz istek). Aktif maçta oda 404 VERMEZ (bitişten ~1 gün sonra
        // silinir) -> 404 = kesin yok, temizlemek güvenli. setRoom(null) effect cleanup'ı tetikler.
        if (st === 404) {
          cancelled = true
          setRoom(null)
          return
        }
        // 429 (Too Many Attempts): poll da rate-limit yedi -> GERİ ÇEKİL. Yoksa her 1.2sn tekrar
        // vurup kovayı dolu tutar (yaşanan #3ZYS8 kilidi). Kısa bekleyiş kovayı boşaltır.
        if (st === 429) {
          apiBackoffUntilRef.current = Date.now() + 5000
        }
        /* diğer geçici hatalar: sonraki tur yeniden dener */
      }
    }
    const id = window.setInterval(() => void poll(), 1200) // poll(force) -> interval arg'ı force sanılmasın
    poll()
    // GERÇEK-ZAMANLI PUSH (Faz 2): oda kanalına abone ol; 'room.updated' gelince ANINDA poll(true)
    // (tek yerde uygula -> desync yok). Bağlantı durumu değişince yedek-poll hızını ayarla. Dormant:
    // push kapalı/bağlanamazsa realtimeConnected hep false -> saf 1.2sn poll.
    const offConn = onRealtimeConn((c) => {
      realtimeConnected = c
      if (c && !cancelled) void poll(true) // bağlanınca kaçırılanları yakala
    })
    let offRoom = () => {}
    void subscribeRoom(room.code, () => {
      if (!cancelled) void poll(true)
    }).then((off) => {
      if (cancelled) off()
      else offRoom = off
    })
    // SEKMEYE/UYGULAMAYA DÖNÜNCE ANINDA RESYNC + PRESENCE TAZELE: arka planda tarayıcı poll
    // interval'ını kısar/askıya alır -> _seen (presence damgası, showRoom ucunda yazılır) tazelenmez
    // ve PRESENCE_TIMEOUT (45sn) dolunca rakip "terk etti" sanıp HAKSIZ ABANDON kazanır (vaka 2FLK9:
    // oyuncu kendi hamlesinden hemen sonra uygulamayı arka plana aldı, sırası gelince poll atan kimse
    // olmadı -> 45sn'de terk). Ayrıca sunucu-otoriter saat POLL'da lazy hesaplanır (MatchClock::tick)
    // -> arka planda süre/AFK ilan edilmez. Dönüşte force poll (push debounce'unu da ATLA) -> sunucu
    // _seen'i ANINDA günceller + gerçek geçen süreyi döndürür.
    //
    // visibilitychange TEK BAŞINA mobil PWA/Safari'de güvenilmez: bfcache restore (pageshow), pencere
    // focus ve ağ geri gelmesi (online) de tetiklesin. SINIR: arka planda polling SÜRDÜRÜLEMEZ
    // (tarayıcı timer'ı askıya alır); 45sn'yi AŞAN arka plan yine meşru terk sayılır. Buradaki koruma
    // "kısa süre arka plana alıp dönen" oyuncu için: dönüşte GARANTİLİ, anında re-poll ile _seen'i
    // 45sn penceresi kapanmadan tazelemek.
    const onResume = () => {
      if (!cancelled && document.visibilityState === 'visible') void poll(true)
    }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('focus', onResume)
    window.addEventListener('online', onResume)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('online', onResume)
      offConn()
      offRoom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.code])

  // İzleyenler: oyuncular da maçı kimlerin izlediğini + sayıyı görsün. watch endpoint'i
  // oyuncuyu izleyici olarak KAYDETMEZ (token slot'la eşleşir) ama listeyi+sayıyı döndürür.
  // Yalnız oynanan online maçta ~5sn'de bir yokla; bittiğinde temizle.
  useEffect(() => {
    if (!online || !room?.code || roomStatus !== 'playing') {
      setRoomViewers([])
      setViewerCount(0)
      return
    }
    let cancelled = false
    const code = room.code
    const beat = async () => {
      try {
        const r = await watchRoom(code)
        if (cancelled) return
        setRoomViewers(r.viewers)
        setViewerCount(r.count)
      } catch {
        /* geçici ağ hatası -> sonraki yoklama dener */
      }
    }
    beat()
    const id = window.setInterval(beat, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.code, roomStatus])

  // Dogrulama sonucu (link'ten ?verified=1/0): birlesik toast olarak goster ve
  // URL'den parametreyi temizle (refresh'te tekrar cikmasin). Tek sefer tetiklenir.
  const verifyNotifiedRef = useRef(false)
  useEffect(() => {
    if (!verifyNotice || verifyNotifiedRef.current) return
    verifyNotifiedRef.current = true
    if (verifyNotice === 'ok') notify.success(t('verify.ok'))
    else notify.error(t('verify.fail'))
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('verified')
      window.history.replaceState({}, '', url.pathname + url.search)
    } catch {
      /* yok */
    }
  }, [verifyNotice, notify, t])

  // E-posta dogrulama linkini tekrar gonder
  async function handleResendVerification() {
    if (resendState === 'sending') return
    setResendState('sending')
    try {
      await resendVerification()
      setResendState('sent')
    } catch {
      setResendState('idle')
    }
  }

  // Ses: her tas oynandiginda (played uzayinca) tas oynama; vurus varsa tas kirma
  const prevPlayedLenRef = useRef(0)
  useEffect(() => {
    const prev = prevPlayedLenRef.current
    if (played.length > prev) {
      Sound.move()
      // Yeni step'lerde vurus (hit) var mi? -> hedef nokta uygulanmadan ONCE
      // tek rakip tasi tasiyorsa vurustur (tas kirma sesi).
      try {
        const mover = turnStart.turn
        for (let i = prev; i < played.length; i++) {
          const st = played[i]
          if (st.to === 'off') continue
          const before = applyPlayed(turnStart, played.slice(0, i))
          const v = before.points[st.to as number]
          if (mover === 'white' ? v === -1 : v === 1) {
            Sound.hit()
            break
          }
        }
      } catch {
        /* yok */
      }
    }
    prevPlayedLenRef.current = played.length
  }, [played.length, turnStart, played])
  // Ses: oyun bitince kazanma/kaybetme.
  // ÇİFT ÇALMA FIX: eski guard yalnız `!gameEnd`'de sıfırlanıyordu; otoriter/online akışta oyun
  // biterken gameEnd bir an null olup TEKRAR kuruluyor (applyServerBoard new-game↔terminal titremesi
  // + poll), guard sıfırlanıp ses 2 kez çalıyordu. Artık ses SADECE null→dolu GEÇİŞİNDE çalar
  // (gameEnd dolu kalırken poll/room güncellemesi tekrar tetiklemez) + kısa debounce titremenin ikinci
  // geçişini yutar (gerçek sonraki oyun her zaman >2sn sonra olduğundan etkilenmez).
  const endSoundPrevRef = useRef(false)
  const lastEndSoundRef = useRef(0)
  useEffect(() => {
    const has = gameEnd != null
    const wasNull = !endSoundPrevRef.current
    endSoundPrevRef.current = has // prevRef'i home'dan ÖNCE güncelle (bir sonraki gerçek oyun-sonu sesi kaçmasın)
    // LOBİDE BASTIR (kullanıcı raporu "oyunda değilim maç kaybetme sesi geliyor"): maçtan çıktıktan
    // sonra uçuştaki bir poll/serverMove yanıtı applyServerBoard ile gameEnd'i (sm.done+winner)
    // yeniden kurup null->dolu geçişi tetikleyebilir -> home iken win/lose sesi ÇALMASIN.
    if (home) return
    if (!has || !wasNull) return // yalnız null->dolu geçişinde çal (dolu kalırken tekrar etme)
    const now = performance.now()
    if (now - lastEndSoundRef.current < 2000) return // titreme (null->dolu->null->dolu) ikinci geçişini yut
    lastEndSoundRef.current = now
    const humanColor: Player = mode === 'online' && room?.slot === 'p2' ? 'black' : 'white'
    if (gameEnd!.winner === humanColor) {
      Sound.win()
      // Basarim: bu oyunu insan mars/katmerli marsla mi kazandi (kup drop'u haric).
      if (!gameEnd!.dropped) {
        if (gameEnd!.mult === 3) achBgRef.current += 1
        else if (gameEnd!.mult === 2) achGammonRef.current += 1
      }
    } else Sound.lose()
  }, [gameEnd, mode, room, home])
  // Ses: kup teklifi
  useEffect(() => {
    if (cubePending) Sound.double()
  }, [cubePending])

  // Acilista takilma fix: kayitli oyun bot yarim-animasyonda kaydedildiyse
  // (sira bot + played>0) played temizlenir ki bot turunu bastan oynasin.
  useEffect(() => {
    if (saved && saved.mode === 'pvb' && saved.turnStart?.turn === BOT_PLAYER && (saved.played?.length ?? 0) > 0) {
      setPlayed([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Kalp atisi: giris yapiliysa cevrimici tut + gelen davetleri yokla
  useEffect(() => {
    if (!user) {
      setInvites([])
      setTournNotices([])
      setTournWaiting([])
      setNotifications([])
      setUnreadNotif(0)
      setDmUnread(0)
      seenNotifRef.current.clear()
      notifPrimedRef.current = false
      seenInviteIdsRef.current.clear()
      invitePrimedRef.current = false
      return
    }
    let cancelled = false
    const beat = () => {
      ping()
        .then((r) => {
          if (!cancelled) {
            const inv = r.invites ?? []
            // Yeni (daha once gorulmemis) oyun daveti -> SES ile uyar. Ilk ping'te (primed=false)
            // mevcut davetleri calma (sayfa yenileme/girişte eski davet ses cikarmasin).
            const freshInvite = inv.some((i) => !seenInviteIdsRef.current.has(i.id))
            inv.forEach((i) => seenInviteIdsRef.current.add(i.id))
            if (invitePrimedRef.current && freshInvite) Sound.invite()
            invitePrimedRef.current = true
            setInvites(inv)
            setTournNotices(r.tournament_matches ?? [])
            setTournWaiting(r.tourn_waiting ?? [])
            setRewardReady(!!r.reward_ready)
            setRewardSecs(r.reward_seconds ?? 0)
            if (typeof r.reward_coins === 'number') setRewardCoins(r.reward_coins)
            const notifs = r.notifications ?? []
            // Yeni (daha once gorulmemis) bildirimleri toast ile aktif uyar.
            // Ilk ping'te (primed=false) eski okunmamislari toast'lama, sadece kaydet.
            const fresh = notifs.filter((n) => !seenNotifRef.current.has(n.id))
            notifs.forEach((n) => seenNotifRef.current.add(n.id))
            // Çark modalı AÇIKKEN toast'lama: kazanç bildirimi çark dönerken erken
            // gelmesin (sonuç zaten modalda gösteriliyor). Bildirim yine kaydedilir (rozet/kutu).
            if (notifPrimedRef.current && fresh.length > 0 && !luckyWheelOpenRef.current) {
              notify.info(fresh[0].title) // notifs newest-first -> fresh[0] en yeni
            }
            notifPrimedRef.current = true
            setNotifications(notifs)
            setUnreadNotif(r.unread ?? 0)
            setDmUnread(r.dm_unread ?? 0)
            // durum secici sunucu ile senkron — AMA kullanıcı az önce (≤8sn) elle değiştirdiyse
            // bayat heartbeat EZMESIN (POST uçuşta). Aksi halde mobilde "değiştiriyorum ama eski haline
            // dönüyor" olur. Pencere dolunca server gerçeği (POST başarılıysa yeni değer) yansır.
            if (r.status && Date.now() - statusChangedAtRef.current > 8000) setMyStatus(r.status)
            if (typeof r.coins === 'number') setUser((u) => (u ? { ...u, coins: r.coins } : u))
          }
        })
        .catch(() => {})
    }
    beat()
    // 10sn: gelen davetler + iptal edilen/bayat davetler hızlı düşsün (eskiden 20sn -> davet
    // iptalinden sonra banner ~20sn asılı kalıyordu). Presence/bildirim/ödül de daha taze olur.
    const id = window.setInterval(beat, 10000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // KRİTİK: yalnız [user?.id] — coins güncellemesi (beat içindeki setUser) `user` kimliğini
    // değiştirip bu effect'i yeniden kurmasın; aksi halde her ping ANINDA yeni ping tetikler ->
    // KAÇAK DÖNGÜ (binlerce request). user?.id sadece giriş/çıkışta değişir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Odul geri sayimi: her saniye azalt (ping 20sn'de bir gercek degeri yeniler)
  useEffect(() => {
    if (rewardReady || rewardSecs <= 0) return
    const id = window.setInterval(() => setRewardSecs((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  // BİLEREK rewardSecs değil `rewardSecs > 0`: değer her saniye değişir; dep olursa interval her
  // tikte yeniden kurulur. Sayım setRewardSecs(fn) ile yapılır.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewardReady, rewardSecs > 0])

  // Bonus HAZIR OLDUGU AN (false->true gecisi) konfeti patlat. prevRef ile yalniz
  // geciste tetiklenir (her render'da degil). Buton yeni render oldugu icin rect'i
  // bir sonraki frame'de olcup body'ye portal konfeti sac.
  const prevRewardReadyRef = useRef(false)
  useEffect(() => {
    if (rewardReady && !prevRewardReadyRef.current) {
      requestAnimationFrame(() => burstConfettiAt(document.querySelector('.btn-reward'), 36))
    }
    prevRewardReadyRef.current = rewardReady
  }, [rewardReady])

  // Magaza: satin al / cerceve tak
  async function handleBuy(shopId: string) {
    try {
      const r = await buyItem(shopId)
      setUser((u) => (u ? { ...u, coins: r.coins, unlocks: r.unlocks } : u))
      // Tahta satin alindiysa dogrudan kusan (yeni tahtayi hemen gorsun)
      if (shopId.startsWith('theme.')) setBoardTheme(shopId.slice('theme.'.length))
    } catch {
      /* yetersiz coin vb. -> sessizce yoksay */
    }
  }
  async function handleEquipFrame(id: string | null) {
    try {
      const r = await selectFrame(id)
      setUser((u) => (u ? { ...u, avatar_frame: r.avatar_frame } : u))
    } catch {
      /* yoksay */
    }
  }
  async function handleEquipChecker(id: string | null) {
    // Optimistik: seçimi HEMEN uygula (board resin/finish'i anında gösterir, tahta rengine uyar).
    // Sunucu kalıcılaştıramazsa (örn. users.checker kolonu migration'ı henüz koşmadıysa) istemci
    // tarafında yine görünür; kalıcılık için sunucuda migrate şart.
    setUser((u) => (u ? { ...u, checker: id } : u))
    try {
      const r = await selectChecker(id)
      setUser((u) => (u ? { ...u, checker: r.checker } : u))
    } catch {
      /* sunucu yazamadı: istemci-taraflı seçim korunur */
    }
  }
  async function handleDaily() {
    try {
      const r = await claimDaily()
      setUser((u) => (u ? { ...u, coins: r.coins } : u))
      if (r.claimed) {
        setRewardReady(false)
        setRewardSecs(6 * 3600) // hemen 6 saat geri sayima gec (ping dogrular)
      }
      return { claimed: r.claimed, reward: r.reward }
    } catch {
      return { claimed: false }
    }
  }
  // Ust coin rozetine tiklaninca: odul hazirsa al, degilse magazayi ac
  async function handleCoinClick() {
    if (rewardReady) {
      const r = await handleDaily()
      if (r.claimed) Sound.win()
    } else {
      setShopOpen(true)
    }
  }

  const [menuOpen, setMenuOpen] = useState(false) // mobil hamburger menu acik mi
  // Esc acik mobil cekmeceyi kapatir (klavye kullanicilari icin standart cikis yolu).
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])
  const [gameMenuOpen, setGameMenuOpen] = useState(false) // oyun-ici menu (Galaxy tarzi)
  // Sag ust hesap dropdown'u: ada tiklayinca acilir; profil + tum bar kontrolleri icinde.
  // Panel position:fixed (ust bar overflow'una takilmasin) -> koordinat tetikten hesaplanir.
  const [acctMenuOpen, setAcctMenuOpen] = useState(false)
  const [acctMenuPos, setAcctMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const acctMenuRef = useRef<HTMLDivElement>(null)
  function toggleAcctMenu() {
    setAcctMenuOpen((o) => {
      if (!o && acctMenuRef.current) {
        const r = acctMenuRef.current.getBoundingClientRect()
        setAcctMenuPos({ top: Math.round(r.bottom + 8), right: Math.round(Math.max(8, window.innerWidth - r.right)) })
      }
      return !o
    })
  }
  useEffect(() => {
    if (!acctMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      // Durum seçicinin listesi document.body'ye PORTAL edilir (menünün DIŞINDA görünür). Ona
      // dokunmak "dışarı tıklama" sayılıp hesap menüsünü (ve seçiciyi) seçim işlenmeden kapatıyordu
      // -> mobilde kullanıcılar durumunu "Müsait" yapamıyordu (masaüstünde seçici üst çubukta).
      if ((e.target as Element | null)?.closest?.('.status-menu, .status-backdrop')) return
      if (acctMenuRef.current && !acctMenuRef.current.contains(e.target as Node)) setAcctMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAcctMenuOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [acctMenuOpen])
  // OYUN YONU (saga/sola topla) — tek ayar, tum modlarda (ve analiz sayfasinda) gecerli.
  const [boardDir] = useBoardDir() // ayar PROFİLDEN; burada yalnız okunur
  const boardMirror = boardDir === 'left'
  const [animOn, setAnimOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tavla.animoff') !== '1'
    } catch {
      return true
    }
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-anim', animOn ? 'on' : 'off')
    try {
      localStorage.setItem('tavla.animoff', animOn ? '0' : '1')
    } catch {
      /* yok */
    }
  }, [animOn])
  // OYUN SESİ (zar/pul/kazan-kaybet) — kalıcı kullanıcı tercihi (sound.ts muted state'i).
  // Efekt çağrıları (Sound.dice/move/win…) zaten oyun akışına bağlı; bu bayrak yalnız susturur.
  const [soundOn, setSoundOn] = useState<boolean>(() => !isMuted())
  // Ses seviyesi 0..100 (sound.ts 0..1 saklar). Slider (Oyun Menüsü) ile ayarlanır.
  const [soundVol, setSoundVolState] = useState<number>(() => Math.round(getVolume() * 100))
  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setMuted(!next) // localStorage + AudioContext hazırlığı sound.ts içinde
    // Sesi açarken seviye 0'da kalmışsa duyulur bir değere çek.
    if (next && soundVol === 0) {
      setVolume(0.7)
      setSoundVolState(70)
    }
  }
  // Slider: seviye 0 = kapat, >0 = aç (mute toggle ile senkron).
  const setSoundVol = (v: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(v)))
    setSoundVolState(clamped)
    setVolume(clamped / 100)
    if (clamped > 0 && !soundOn) {
      setSoundOn(true)
      setMuted(false)
    } else if (clamped === 0 && soundOn) {
      setSoundOn(false)
      setMuted(true)
    }
  }
  // Tas hareket animasyonu stili (kapali/kayma/yay/kaldir-birak) — kullanici secer
  // Tas hareket stili: Ayarlar'dan secici KALDIRILDI; mevcut localStorage degeri (varsa)
  // korunur, yoksa 'slide'. Artik degismedigi icin setter yok.
  const [moveStyle] = useState<MoveStyle>(() => {
    try {
      const v = localStorage.getItem('tavla.move')
      return v === 'off' || v === 'slide' || v === 'arc' || v === 'lift' ? v : 'slide'
    } catch {
      return 'slide'
    }
  })
  // FLIP: playSteps state'i guncellemeden ONCE kaynak dikdortgenini buraya yazar;
  // render sonrasi useLayoutEffect hedef tasi kaynaktan ucurur.
  const pendingFlightRef = useRef<{ to: number | 'off'; srcRect: DOMRect; offColor?: Player } | null>(null)

  // ---- CANLI hamle önizlemesi: GÖNDER (kendi turum) ----
  // Kendi turumda her adım/geri-almada güncel `played`'i odaya yaz -> rakip adım adım görür.
  // Cosmetic; otoriteye dokunmaz. 120ms debounce (hızlı çok-adımı topla) + imza (echo/spam önle).
  useEffect(() => {
    if (!online || !room?.code || room.status !== 'playing' || !myTurn) return
    const sig = `${myColor}:${turnsPlayed}:${played.map((s) => `${s.from}>${s.to}/${s.die}`).join('|')}`
    if (sig === liveSentRef.current) return
    liveSentRef.current = sig
    const code = room.code
    const snapshot = played.slice()
    const t = window.setTimeout(() => void postLive(code, snapshot, myColor, turnsPlayed), 120)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.code, room?.status, myTurn, myColor, turnsPlayed, played])

  // ---- CANLI hamle önizlemesi: AL + ANİMASYON (rakip turu) ----
  // Rakibin `live` adımlarını oku; delta'yı (yeni adım vs geri-alma) hesaplayıp adım adım oynat.
  useEffect(() => {
    if (!online || myTurn) {
      // Kendi turum / offline -> önizlemeyi temizle (bir sonraki rakip turuna hazır).
      if (oppLiveShownRef.current.length) {
        oppLiveShownRef.current = []
        setOppLive([])
      }
      return
    }
    const live = room?.live
    if (!live || !Array.isArray(live.steps) || live.slot === room?.slot) return
    if (live.turn && live.turn !== turnStart.turn) return // bu turun/rengin önizlemesi değil
    // KRİTİK: canlı önizleme YALNIZ içinde bulunulan tura ait olmalı. `room.live` sunucuda tur
    // değişiminde TEMİZLENMEZ (yalnız yeni POST üzerine yazılır). `seq`'i (turnsPlayed) denetlemezsek,
    // rakibin sırası tekrar geldiğinde (aynı renk, 2 ply önce) room.live hâlâ ÖNCEKİ turun adımlarını
    // taşır ve renk eşleştiği için o adımları —özellikle bardan girişi— güncel tahtaya HAYALET
    // animasyonla oynatıp gerçek durum gelince geri alırdık ("barda giremiyor ama sistem girmiş gibi
    // yapıp sonra geri alıyor" — canlı izleyenlerin şikayeti). Eski/uyumsuz seq'i yok say + temizle.
    if (typeof live.seq === 'number' && live.seq !== turnsPlayed) {
      if (oppLiveShownRef.current.length) {
        oppLiveShownRef.current = []
        setOppLive([])
      }
      return
    }
    const incoming = live.steps as Step[]
    const delta = liveMoveDelta(oppLiveShownRef.current, incoming)
    if (delta.reset) {
      // Geri alma / farklı dizi -> anında turnStart+incoming'e sıçra (geri-almayı net göster).
      oppLiveShownRef.current = incoming.slice()
      setOppLive(incoming.slice())
      return
    }
    if (delta.animate.length === 0) return
    const base = oppLiveShownRef.current.slice()
    const flip =
      moveStyle !== 'off' && animOn && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: number[] = []
    delta.animate.forEach((st, i) => {
      timers.push(
        window.setTimeout(() => {
          if (flip) {
            const r = sourceRect(st.from) // güncel gösterilen tahtada kaynağı yakala
            if (r) pendingOppFlightRef.current = { to: st.to, srcRect: r, offColor: turnStart.turn }
          }
          // Ses: rakibin bu adımı vuruş mu (rakip=benim taşım blot) yoksa normal hamle mi?
          // pre = bu adımdan ÖNCEKİ tahta (turnStart + o ana dek oynatılan base). Spectate deseni.
          if (!resultShowingRef.current && !inLobbyRef.current) {
            const pre = applyPlayed(turnStart, base)
            const moverSign = turnStart.turn === 'white' ? 1 : -1
            const hit =
              typeof st.to === 'number' &&
              pre.points[st.to] !== 0 &&
              Math.sign(pre.points[st.to]) !== moverSign &&
              Math.abs(pre.points[st.to]) === 1
            if (hit) Sound.hit()
            else Sound.move()
          }
          base.push(st)
          oppLiveShownRef.current = base.slice()
          setOppLive(base.slice())
        }, i * 450), // adımlar arası görünür gecikme (rakip tek tek oynuyor gibi)
      )
    })
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, myTurn, room?.live, room?.slot, turnStart, turnsPlayed, moveStyle, animOn])

  // Rakip önizleme adımı eklendikten sonra hedef taşı kaynaktan uçur (playSteps FLIP'inin eşi).
  useLayoutEffect(() => {
    const f = pendingOppFlightRef.current
    if (!f || moveStyle === 'off') {
      pendingOppFlightRef.current = null
      return
    }
    pendingOppFlightRef.current = null
    const el = destEl(f.to, f.offColor)
    if (el) flyChecker(el, f.srcRect, moveStyle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppLive, oppReplay]) // §5.2: replay adımı eklenince de (oppReplay.shown) uçuşu tetikle

  // Ses: RAKİBİN zar atışı (online insan/kılıç maçı). Kendi atışım doRoll -> playDice() ile çalar;
  // rakibin zarı yalnız poll/applyServerBoard ile geldiğinden buraya kadar sessizdi (kullanıcı raporu:
  // "rakibin zarını duymuyorum"). Yeni dolu dice + rakip turu -> bir kez çal. Maça rakip turunda
  // GİRİLDİĞİNDE ilk zarı ÇALMA (firstDiceRef); home/sonuç ekranında bastır (playDice ile aynı kapı).
  const oppDiceKeyRef = useRef('')
  const oppFirstDiceRef = useRef(true)
  // Yeni maça (oda kodu değişince) girişte "ilk rakip zarını çalma" korumasını sıfırla:
  // "Maça Dön" ile rakip turunun ortasına girince o anki zar hayalet ses çıkarmasın.
  useEffect(() => {
    oppFirstDiceRef.current = true
    oppDiceKeyRef.current = ''
    // Önceki odadan kalan CANLI-ÖNİZLEME izlerini temizle. Aksi halde yeni odada (rövanş / yeni
    // eşleşme — aynı sekme) rakibin ilk turunda bayat adımlar liveMoveDelta'da prefiks sanılıp bazı
    // adımlar ATLANABİLİR, ya da bekleyen bir uçuş (pendingOppFlightRef) yeni tahtaya düşüp "hayalet"
    // sıçrama üretebilir. lastOppRollVRef sıfırlanmazsa yeni odanın ilk rakip zarı (aynı v) GÖRÜNMEZ.
    oppLiveShownRef.current = []
    pendingOppFlightRef.current = null
    lastOppRollVRef.current = -1
    setOppLive([])
    setOppRoll(null)
    clearOppReplay() // §5.2: oda değişince bekleyen replay'i iptal et (yeni tahtaya düşmesin)
  }, [room?.code])
  useEffect(() => {
    if (!online || myTurn || !turnStart.dice || turnStart.dice.length === 0) {
      oppDiceKeyRef.current = ''
      return
    }
    const key = `${turnStart.turn}|${turnStart.dice.join(',')}`
    if (key === oppDiceKeyRef.current) return
    oppDiceKeyRef.current = key
    if (oppFirstDiceRef.current) {
      oppFirstDiceRef.current = false // maça rakip turunda girişte ilk zarı çalma
      return
    }
    if (resultShowingRef.current || inLobbyRef.current) return
    Sound.dice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, myTurn, turnStart.turn, turnStart.dice])

  // Otomatik zar: insanin sirasi gelince zar otomatik atilir (kucuk gecikme).
  // Kup teklif etme secenegi yoksa (1 puanlik oyun, Crawford, rakip kupu tutuyorsa
  // veya ilk el) beklemenin anlami yok -> otomatik at. Teklif mumkunse beklenir ki
  // oyuncu "Zar At"/"Katla" arasinda secim yapabilsin. (Ayar olarak sunulmuyor.)
  useEffect(() => {
    if (!interactive || diceRolled || opening || cubePending || gameWon) return
    if (oppReplay) return // §5.2: rakibin hamlesi ekranda oynanırken benim zarımı atma (replay bitince tekrar çalışır)
    if (!shouldAutoRoll(match, turnStart.turn, turnsPlayed, turnStart, isMoneyGame)) return
    setAutoRollStuck(false)
    // TEK ATIŞ YETMEZ (olu-kup maçta manuel buton yok): ilk deneme bir transiente yutulursa
    // (409/backoff/uçuş-kilidi/bayat srvTurn) yeniden denenmeli. Açılış effect'indeki (satir ~4096)
    // retry desenini birebir uygula. Poll BENİM zarsız turumda server_version'i ilerletmez -> bu
    // effect yeniden çalışmaz, dolayısıyla retry/timer'lar kesintisiz işler; zar atılınca (ya da
    // tur değişince) version ilerler -> effect cleanup timer'ları temizler. serverRoll idempotent.
    const first = window.setTimeout(() => doRoll(), 500)
    const retry = window.setInterval(() => doRoll(), 2500)
    // ACİL KAPI: ~4sn içinde zar atılmadıysa oto-zar takılmış demektir. Kurtarılabilir mandalları
    // temizle (rollConflictRef) + otoriter durumu zorla çek (version=-1 -> poll re-apply) ki hem
    // retry hem de açılacak MANUEL buton tıklaması ilerleyebilsin; sonra butonu göster.
    const reveal = window.setTimeout(() => {
      rollConflictRef.current = false
      appliedServerVersionRef.current = -1
      setAutoRollStuck(true)
    }, 4000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(retry)
      window.clearTimeout(reveal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, diceRolled, opening, cubePending, gameWon, turnStart, turnsPlayed, match, oppReplay])

  // NOT: Eski "telefonunu yan cevir" bloklayici uyari EKRANI kaldirildi (kullanici istegi).
  // Oyun artik hem DIKEY hem YATAY oynanabilir: portre'de @media (max-width:900px) sutun
  // duzeni + portre board olcegi devreye girer; kullanici telefonu yan cevirince
  // @media (orientation: landscape) kurallari otomatik yatay duzene gecer (JS gerekmez).
  // Tam ekran istegi icin .fs-toggle butonu (asagida) her zaman durur.

  // Manuel yatay: cihazin donme kilidi acikken (iPhone) fiziksel cevirmeden
  // gorunumu 90 dondurup yatay oynatir. Kullanici "yine de yatay oyna" ile secer.
  // Mobil portre: FIZIKSEL cevirme (native landscape) kullanilir. Kirik CSS 90°
  // rotate hack'i kaldirildi; eski kayitli flag temizlenir, class asla eklenmez.
  useEffect(() => {
    try {
      localStorage.removeItem('tv-force-landscape')
    } catch {
      /* yok */
    }
    document.getElementById('root')?.classList.remove('force-landscape')
  }, [])

  // Landscape TELEFON (yatay + kisa yukseklik): masaustu duzeni yerine kompakt MOBIL
  // kabuk (hamburger + drawer + dropdown bar). #root.lsphone -> ui/landscapePhone.css.
  // Esik 560px: tahtanin kompakt yatay duzeni (CSS @media max-height:560px) ile AYNI. Eskiden 500'du;
  // 501-560px yukseklikte kompakt tahta + masaustu kabugu karisik gorunuyordu. matchMedia canli takip.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(orientation: landscape) and (max-height: 560px)')
    const root = document.getElementById('root')
    const apply = () => root?.classList.toggle('lsphone', mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Tam ekran (browser Fullscreen API) — oyun ekraninda ac/kapa butonu.
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Mobil DIKEY ipucu: "telefonu yan cevir" (non-blocking pill). Sadece CSS ile
  // mobil-portre'de gorunur; kullanici cevirince yatay duzen otomatik acilir.
  // Kapatilinca oturum boyunca bir daha cikmaz (rahatsiz etmesin).
  const [rotateTipHidden, setRotateTipHidden] = useState(() => {
    try {
      return sessionStorage.getItem('tv-rotate-tip') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    const onFs = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      // Tam ekranda ust hesap barini gizle (CSS: html.fs-active .account-bar)
      document.documentElement.classList.toggle('fs-active', fs)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }
  // Oyundan lobiye/ana sayfaya dönünce TAM EKRANI KAPAT. Tam ekran yalnız oyun ekranında (fs-toggle)
  // açılır; home'a dönerken html fullscreen + html.fs-active kalırsa .app.lobby düzeni bozuluyordu
  // (account-bar gizli kalıp footer/sidebar üst üste biniyor, menü soluk görünüyordu — kullanıcı
  // şikayeti). home true olunca (menü→Lobi, maç sonu, resign, URL geri) fullscreen'den çık.
  useEffect(() => {
    if (home && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [home])

  // (Kaldirildi) Ozel "asagi cek-yenile" (pull-to-refresh): overlay'lerde (analiz vb.) kazara
  // reload tetikleyip sayfayi/dizilimi sifirliyordu. Tamamen kaldirildi; kullanici tarayicidan yeniler.

  // Online host (p1): rakip katilinca acilis atisini baslat
  useEffect(() => {
    if (!online || room?.slot !== 'p1' || room?.status !== 'playing') return
    if (syncEnabledRef.current) return
    roomLeavingRef.current = null
    rollConflictRef.current = false
    syncEnabledRef.current = true
    setTurnStart(freshBoard('white'))
    setPlayed([])
    setOpening('roll')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.slot, room?.status])

  async function handleCreateRoom(target = 1, tc?: TimeControl, unrated = false, classic = false) {
    roomLeavingRef.current = null
    rollConflictRef.current = false
    setRoomBusy(true)
    setRoomError('')
    setInviteWaitName(null) // generic oda: hedefli davet etiketi gosterme
    // Onceki BITMIS oyunu HEMEN temizle (matchOver true kalirsa oda kurma agi beklerken
    // game-view eski board'u FLASH ediyordu) -> spinner sorunsuz gorunur.
    setGameEnd(null)
    setTurnsPlayed(0)
    setMatch(newMatch(target))
    try {
      friendlyRef.current = true // davet ile kurulan oda = arkadaslik maci (puan/coin YOK)
      stakeRef.current = 0
      betPctRef.current = 0
      const tcUse = tc ?? timeControl // FriendGameSetup'tan gelen saat (state stale olmasin)
      classicRef.current = classic // KLASIK TAVLA arkadaş odası (rematch/HUD için sakla)
      const res = await createRoom(profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, tcUse, target, unrated, classic)
      resetRoomSync()
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      setOppStarted(false)
      setChat([])
      setRematch({ mine: null, theirs: null, code: null })
      rematchSentRef.current = null
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setCoinPair(null)
    setMatchLog([])
    oppLoggedRef.current = ''
    setRatingChange(null)
      setClock(freshMatchClock(onlineTargetRef.current))
      fairRef.current = new FairDice()
      setMatch(newMatch(target))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: null,
        oppRating: null,
        oppAvatar: null,
        oppFrame: null,
        oppId: null,
        status: res.room.status,
        classic: res.room.classic ?? false, // Klasik Tavla bayrağı (küp yok + mars=2) -> match.classic aynalanır
      })
    } catch {
      // Hata: bayat online durumda TAKILMA -> arkadas kurulum ekranina don + toast.
      notify.error(t('mp.connError'))
      setRoom(null)
      setHome(false)
      setFriendSetupOpen(true)
    } finally {
      setRoomBusy(false)
    }
  }

  // SUNUCU-OTORİTER BOT MAÇI başlat: sunucu p2=bot ile authoritative oda kurar; oyun ONLINE akışıyla
  // (serverRoll/serverMove + poll + applyServerBoard) oynanır, bot hamleleri yanıttaki bot[] turlarından
  // gelir. Böylece iki sekme/pencere TEK sunucu-state'i izler (yerel ıraksama YOK). Açılış, ilk
  // serverRoll'da sunucuda atılır (online açılış yolu); bot başlatıcıysa aynı yanıtta oynar.
  async function handleCreateBotRoom(
    target: number,
    level: number,
    tc?: TimeControl,
    classic = false, // KLASIK TAVLA: bota karsi (kup yok + mars=2)
  ) {
    roomLeavingRef.current = null
    rollConflictRef.current = false
    setRoomBusy(true)
    setRoomError('')
    setInviteWaitName(null)
    // Yeni bot odası kurulurken API yanıtını beklediğimiz ara render'da önceki
    // online/bot odasının tahtası görünmemeli. Özellikle önceki maçtan kalan
    // `room` online=true bırakıyor, `turnStart + played` de eski pozisyonu
    // boardDisplay'e taşıyordu.
    setRoom(null)
    setMode('pvb')
    setHome(true)
    resetRoomSync()
    syncEnabledRef.current = false
    authoritativeRef.current = false
    diceAuthorityRef.current = false
    setGameEnd(null)
    setTurnsPlayed(0)
    setMatch(newMatch(target))
    setStarter('white')
    setTurnStart(freshBoard('white'))
    setPlayed([])
    setSelectedFrom(null)
    setCubePending(null)
    setBotAnim(null)
    setOpening('roll')
    try {
      friendlyRef.current = false // bot maçı PUANLI (rating raporlanır, matchType='ai')
      stakeRef.current = 0
      betPctRef.current = 0
      onlineTargetRef.current = target
      targetsRef.current = [target]
      const tcUse = tc ?? timeControl
      classicRef.current = classic // rematch/HUD için klasik bayrağı sakla
      const res = await createBotRoom(profile?.nickname ?? t('auth.guestNick'), level, target, user?.rating, profile.avatar, tcUse, undefined, classic)
      resetRoomSync()
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      setOppStarted(true) // bot daima hazır (insan rakip beklenmez)
      setChat([])
      setRematch({ mine: null, theirs: null, code: null })
      rematchSentRef.current = null
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
      setPrLuck({ white: 0, black: 0 })
      setCoinDelta(null)
      setCoinPair(null)
      setMatchLog([])
      oppLoggedRef.current = ''
      setRatingChange(null)
      setClock(freshMatchClock(target))
      setDifficulty(level)
      fairRef.current = new FairDice() // otoriter modda kullanılmaz; tutarlılık için sıfırla
      setMatch(newMatch(target))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      // OTORİTE ref'lerini SENKRON yaz: açılış effect'i poll'dan ÖNCE doRollAuthoritative'i seçsin
      // (aksi halde ilk açılış yerel-zar yoluna kaçabilirdi).
      authoritativeRef.current = true
      diceAuthorityRef.current = true
      setOpening('roll') // açılış serverRoll -> sunucu açar + bot başlatıcıysa aynı yanıtta oynar
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.room.p2_name,
        oppRating: res.room.p2_rating,
        oppAvatar: res.room.p2_avatar,
        oppFrame: res.room.p2_frame ?? null,
        oppCountry: res.room.p2_country ?? null,
        oppId: res.room.p2_user_id ?? null,
        status: res.room.status,
        classic: res.room.classic ?? false, // Klasik Tavla bayrağı (küp yok + mars=2) -> match.classic aynalanır
        authoritative: true,
        dice_authority: true,
        bot: true,
        botLevel: level,
      })
      setMode('online')
      setHome(false)
    } catch (e) {
      // Premium bot (Seviye 11/12) gate: sunucu 403 döndürürse üyelik ekranını aç (yedek kalkan;
      // UI zaten seçtirmez ama eski istemci / doğrudan istek buradan yakalanır).
      if ((e as { status?: number })?.status === 403) {
        setMemOpen(true)
      } else {
        notify.error(t('mp.connError'))
      }
      setRoom(null)
      setHome(true)
    } finally {
      setRoomBusy(false)
    }
  }

  // Misafir (üye değil) Tek Oyun/Maç Oyunu oynayamaz (coin/puan hesap şart) -> açık oyun ekranlarını
  // kapat, lobiye dön ve giriş akışını aç. Yalnız Yapay Zeka ile oynama misafire açıktır.
  function requireLogin() {
    setSoloOpen(false)
    setSetup(null)
    setHome(true)
    notify.info(t('mp.loginRequired'))
    setShowAuth(true)
  }

  // Tek Oyun: bir veya BIRDEN COK bahis sec -> kesisen tutarli rakiple eslesir (tek oyun).
  // Anlasilan tutar sunucuda kesinlesir (ortak tutarlardan en yuksegi); stakeRef gecici max.
  function startSoloStake(stakes: number[], target = 1) {
    const list = stakes.filter((s) => s > 0)
    if (list.length === 0) return
    // Tek Oyun = coin bahisli online eslesme -> hesap sart. Misafir icin API'ye gidip
    // kafa karistiran 'Bahisli oyun icin giris yapmalisin' 422'sini yemeden ONCE net
    // giris akisi ac (Mac Oyunu ile ayni davranis).
    if (!user) {
      // Tek Oyun sayfasini KAPAT + home dalina dus -> auth page-host'ta TEK basina (header'li)
      // acilir. Aksi halde soloOpen acik kalip auth ile ALT ALTA yigiliyordu ("sayfa en altta").
      setSoloOpen(false)
      setHome(true)
      notify.info(t('mp.loginRequired'))
      setShowAuth(true)
      return
    }
    stakesRef.current = list
    stakeRef.current = Math.max(...list) // gecici gosterim; eslesmede room.stake ile guncellenir
    betPctRef.current = 0 // Tek Oyun sabit bahis (pct degil)
    minRatingRef.current = 0 // Tek Oyun: puan filtresi yok
    // Tahta ARTIK seviyeye kilitli degil: oyuncunun secili boardTheme'i korunur
    // (Tahtayi Degistir ile kendisi secer).
    setSoloOpen(false)
    mmOriginRef.current = 'solo' // iptalde Tek Oyun ekranina don
    onlineTargetRef.current = target // secilen puan hedefi (1 = tek oyun)
    targetsRef.current = [target]
    setMode('online')
    setHome(false)
    handleMatchmake()
  }

  // Hizli eslesme: havuza gir; matched ise hemen basla, degilse mm_waiting'de bekle.
  // tcOverride: "Oyun Arayanlar"dan katilirken seeker'in temposu (setTimeControl state'i ayni
  // render'da henuz guncel degil) -> dogru tempoyla cagir.
  async function handleMatchmake(tcOverride?: TimeControl) {
    // Misafir (üye değil) gerçek eşleşme yapamaz (auth 401) -> üyelik iste. Yalnız Yapay Zeka
    // ile oynama misafire açık.
    if (!user) {
      requireLogin()
      return
    }
    setRoomBusy(true)
    setRoomError('')
    setInviteWaitName(null) // eslesme havuzu: hedefli davet etiketi gosterme
    friendlyRef.current = false // eslesme havuzu / Tek Oyun = puanli/coinli (dostluk degil)
    // Onceki BITMIS oyunu HEMEN (await'ten once) temizle: matchOver true kalirsa arama
    // agi beklerken 4691 (!matchOver) atlanip game-view ESKI board'u FLASH ediyordu.
    setGameEnd(null)
    setTurnsPlayed(0)
    setMatch(newMatch(onlineTargetRef.current))
    try {
      const res = await matchmake(
        profile?.nickname ?? t('auth.guestNick'),
        user?.rating,
        profile.avatar,
        stakeRef.current,
        user?.id,
        minRatingRef.current,
        betPctRef.current,
        targetsRef.current,
        tcOverride ?? timeControl,
        stakesRef.current ?? undefined,
        classicRef.current, // Klasik Tavla: ayri eslesme havuzu
      )
      // Eslesme olduysa sunucu ortak uzunlugu (target) verir; olmadiysa gecici (max).
      matchTargetSyncedRef.current = res.room.target != null
      if (res.room.target != null) onlineTargetRef.current = res.room.target
      // Eslesme aninda anlasilan bahis (coklu secim) kesinlesti -> gercek tutari uygula.
      if (res.matched && res.room.stake != null && res.room.stake > 0) stakeRef.current = res.room.stake
      potRef.current = res.room.pot ?? stakeRef.current // oynanan pot (yuzde maçta eslesmede min; sabitte = stake)
      resetRoomSync()
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      setOppStarted(false)
      setChat([])
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setCoinPair(null)
      setMatchLog([])
    oppLoggedRef.current = ''
      setRatingChange(null)
      setClock(freshMatchClock(onlineTargetRef.current))
      fairRef.current = new FairDice()
      setMatch(newMatch(onlineTargetRef.current))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.slot === 'p2' ? res.room.p1_name : res.room.p2_name,
        oppRating: res.slot === 'p2' ? res.room.p1_rating : res.room.p2_rating,
        oppAvatar: res.slot === 'p2' ? res.room.p1_avatar : res.room.p2_avatar,
        oppFrame: res.slot === 'p2' ? (res.room.p1_frame ?? null) : (res.room.p2_frame ?? null),
        oppCountry: res.slot === 'p2' ? (res.room.p1_country ?? null) : (res.room.p2_country ?? null),
        oppId: res.slot === 'p2' ? (res.room.p1_user_id ?? null) : (res.room.p2_user_id ?? null),
        status: res.room.status,
        classic: res.room.classic ?? false, // Klasik Tavla bayrağı (küp yok + mars=2) -> match.classic aynalanır
        // KRİTİK: authoritative'i İLK POLL'U BEKLEMEDEN kur. Eşleşen oyuncu (p2) status='playing'
        // ile hemen açılışa girer; authoritativeRef henüz false ise açılış seededOpening'e (legacy)
        // düşer -> server_state'e zar YAZILMAZ -> ilk serverMove "Önce zar at" (409) -> sıra geçmez.
        authoritative: res.room.authoritative,
        server_version: res.room.server_version ?? 0,
        // BAGIMSIZ Faz 1: bahisli oda -> zar sunucudan (serverRoll). Aynı erken-gate mantığı.
        dice_authority: res.room.dice_authority,
      })
      // Eşleşme ANINDA olmadıysa (havuzda bekliyoruz): BLOKLAYAN "Rakip aranıyor" VS kartını
      // gösterme -> ana sayfaya dön. Poll (online+room) arka planda sürer; eşleşince (status
      // 'playing') auto-enter effect'i oyuna sokar. Kullanıcı "Oyun Arayanlar"da kendini görür.
      if (res.room.status === 'mm_waiting') {
        awaitingMatchRef.current = true
        setHome(true)
      } else {
        awaitingMatchRef.current = false
      }
    } catch (err) {
      // ApiError (status var) -> sunucunun gercek mesajini goster; yoksa ag hatasi
      const e = err as { status?: number; errors?: Record<string, string[]>; message?: string }
      const msg = e?.status
        ? (e.errors ? Object.values(e.errors)[0]?.[0] : undefined) || e.message || t('mp.connError')
        : t('mp.connError')
      // Hata: bayat online durumda TAKILMA (bos board/secim ekrani) -> lobi baglaminda
      // origine don + toast.
      notify.error(msg)
      setRoom(null)
      setMode('pvb')
      setHome(true)
      if (mmOriginRef.current === 'solo') setSoloOpen(true)
      else { setClassicSetup(mmOriginRef.current === 'klassik'); setSetup('online') }
    } finally {
      setRoomBusy(false)
    }
  }

  // stayHome: "Oyun Arayanlar" panelinden iptal -> aramayı öldür ama KURULUM ekranını açma,
  // ana sayfada kal (kullanıcı listeden iptal etti, SoloStakes/setup'a atlamasın).
  async function handleCancelMatch(stayHome = false) {
    awaitingMatchRef.current = false
    stakeRef.current = 0 // bahis eslesmesi iptal edildi
    betPctRef.current = 0
    try {
      await cancelMatchmake()
    } catch {
      /* yoksay */
    }
    // Oda/eslesme durumunu temizle. handleLeaveRoom ana sayfaya atardi; burada ise
    // eslesmeyi baslatan kurulum ekranina geri donuyoruz (kullanici kaldigi yere donsun).
    setRoom(null)
    syncEnabledRef.current = false
    resetRoomSync()
    setOppStarted(false)
    setChat([])
    tournMatchRef.current = null
    // LOBI baglamina don (sol menu + logo ile). online'dan cik ki game-view'a dusmesin
    // (solo iptalde SoloStakes sidebar'siz aciliyordu). solo -> home dalinda SoloStakes,
    // mac -> setup dali (kendi sidebar'i var).
    setMode('pvb')
    setHome(true)
    if (stayHome) return // panelden iptal: ana sayfada kal, kurulum ekranı açma
    if (mmOriginRef.current === 'solo') setSoloOpen(true)
    else { setClassicSetup(mmOriginRef.current === 'klassik'); setSetup('online') }
  }

  async function handleJoinRoom(code: string) {
    setRoomBusy(true)
    setRoomError('')
    try {
      friendlyRef.current = true // koda katilma = arkadaslik maci (puan/coin YOK)
      stakeRef.current = 0
      betPctRef.current = 0
      const res = await joinRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, timeControl)
      resetRoomSync()
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      fairRef.current = new FairDice()
      setOppStarted(false)
      setChat([])
      // Yeni oda = TAMAMEN temiz maç durumu. (Bu resetler eksikti -> koda katılınca ÖNCEKİ
      // maçın matchOver/gameEnd'i taşınıp yeni tahtanın üstünde ESKİ sonuç ekranı ["Siyah
      // kazandı … Sonraki Oyun"] gösteriliyordu. enterOnlineByCode/turnuva ile aynı sıfırlama.)
      setRematch({ mine: null, theirs: null, code: null })
      rematchSentRef.current = null
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setCoinPair(null)
    setMatchLog([])
    oppLoggedRef.current = ''
    setRatingChange(null)
      setClock(freshMatchClock(onlineTargetRef.current))
      setMatch(newMatch(onlineTargetRef.current))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      // Kod GECERLI -> simdi online oyuna gec (kurulum ekranindan gelindiyse). Room ile
      // ayni tik'te ayarlanir (React batch) -> araya bogus board render'i girmez.
      setFriendSetupOpen(false)
      setMode('online')
      setHome(false)
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.slot === 'p2' ? res.room.p1_name : res.room.p2_name,
        oppRating: res.slot === 'p2' ? res.room.p1_rating : res.room.p2_rating,
        oppAvatar: res.slot === 'p2' ? res.room.p1_avatar : res.room.p2_avatar,
        oppFrame: res.slot === 'p2' ? (res.room.p1_frame ?? null) : (res.room.p2_frame ?? null),
        oppCountry: res.slot === 'p2' ? (res.room.p1_country ?? null) : (res.room.p2_country ?? null),
        oppId: res.slot === 'p2' ? (res.room.p1_user_id ?? null) : (res.room.p2_user_id ?? null),
        status: res.room.status,
        classic: res.room.classic ?? false, // Klasik Tavla bayrağı (küp yok + mars=2) -> match.classic aynalanır
      })
    } catch (e) {
      const msg =
        e instanceof ApiErr && e.status === 404
          ? t('mp.roomNotFound')
          : e instanceof ApiErr && e.status === 409
            ? t('mp.roomFull')
            : t('mp.connError')
      setRoomError(msg)
      notify.error(msg) // kurulum ekraninda Lobby yoksa da gorunur ("boyle bir oda yok")
    } finally {
      setRoomBusy(false)
    }
  }

  // Turnuva maci: iki oyuncu ayni odaya girer; mac bitince sonuc otomatik bildirilir
  async function handlePlayTournamentMatch(tid: number, m: { key: string }, oppId: number) {
    setTournOpen(false)
    setRoomBusy(true)
    setRoomError('')
    try {
      const { code, target } = await tournamentMatchRoom(tid, m.key)
      const res = await enterRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, timeControl, target)
      setTournRoom({ code: res.room.code, tid })
      clockBankRef.current = res.room.clock_bank ?? null // turun elle girilen suresi (varsa)
      // Tur uzunlugu (normal / yari final / final): odanin sunucudaki degeri esas.
      const tgt = res.room.target ?? target
      onlineTargetRef.current = tgt
      targetsRef.current = [tgt]
      matchTargetSyncedRef.current = true
      tournMatchRef.current = { tid, matchKey: m.key, oppId }
      resetRoomSync()
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      fairRef.current = new FairDice()
      setOppStarted(false)
      setChat([])
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setCoinPair(null)
      setMatchLog([])
    oppLoggedRef.current = ''
      setRatingChange(null)
      setClock(freshMatchClock(tgt))
      setMatch(newMatch(tgt))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      // AÇIK menü sayfası/overlay KAPAT (Arkadaşlar/Liderlik/Mesajlar/Mağaza…): davet banner'ı her
      // ekranda üstte olduğundan bir sayfa açıkken oyuna girilebiliyordu; kapatmazsak oyun
      // görünümünde eski sayfa ARKA ZEMİNDE asılı kalıyordu ("saçma sapan sayfa" bug'ı). Diğer
      // oyuna-giriş yolları (onResume/onNewGame/resume) zaten closeAllPages çağırır.
      closeAllPages()
      setHome(false)
      setMode('online')
      // AUTHORITATIVE: turnuva odasi SUNUCU-OTORITER (backend enter() authoritative=true yapar).
      // Bu bayrak client room state'ine KONMAZSA ilk poll'e kadar oda non-authoritative sanilip
      // YANLIS (legacy) sync yoluna dusuyor + board-gecerlilik kalkani (room.authoritative sarti)
      // calismiyordu -> "oyun ekranina girdim ama board hic yuklenmedi / mavi ekranda kaldim".
      authoritativeRef.current = res.room.authoritative ?? authoritativeRef.current
      diceAuthorityRef.current = res.room.dice_authority ?? diceAuthorityRef.current
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.slot === 'p2' ? res.room.p1_name : res.room.p2_name,
        oppRating: res.slot === 'p2' ? res.room.p1_rating : res.room.p2_rating,
        oppAvatar: res.slot === 'p2' ? res.room.p1_avatar : res.room.p2_avatar,
        oppFrame: res.slot === 'p2' ? (res.room.p1_frame ?? null) : (res.room.p2_frame ?? null),
        oppCountry: res.slot === 'p2' ? (res.room.p1_country ?? null) : (res.room.p2_country ?? null),
        oppId: res.slot === 'p2' ? (res.room.p1_user_id ?? null) : (res.room.p2_user_id ?? null),
        status: res.room.status,
        classic: res.room.classic ?? false, // Klasik Tavla bayrağı (küp yok + mars=2) -> match.classic aynalanır
        authoritative: res.room.authoritative,
        dice_authority: res.room.dice_authority,
      })
    } catch {
      setRoomError(t('mp.connError'))
      setTournOpen(true)
      enteredNoticeRef.current = '' // giris basarisiz -> ayni mac tekrar denenebilsin (guvenlik timer/banner)
    } finally {
      setRoomBusy(false)
    }
  }

  // AKTIF OYUNDAYKEN turnuva macina gec: once mevcut (turnuva disi) maci NO-CONTEST kapat
  // (kazanan/kaybeden YOK, puan/coin degismez, stake iade -> leaveRoom(code, true); sunucu hazir
  // turnuva maci olunca onurlar), SONRA turnuva odasina gir. KULLANICIYA SORULMAZ ("direk al").
  // handleLeaveRoom'u CAGIRMA: o setRoom(null)/tournMatchRef=null ile yeni turnuva odasini ezer
  // (yaris). Bunun yerine leaveRoom'u await edip stake/bet ref'lerini elle sifirla; state'i
  // handlePlayTournamentMatch kendisi bastan kurar.
  async function leaveCurrentAndEnterTourn(tid: number, matchKey: string, oppId: number) {
    if (online && room?.code) {
      const code = room.code
      roomLeavingRef.current = code
      syncEnabledRef.current = false
      try {
        await leaveRoom(code, true) // NO-CONTEST (turnuva geçişi) -> kazanan/kaybeden yok
      } catch {
        /* kapatma basarisiz olsa da turnuvaya devam et; sunucu presence ile temizler */
      }
    }
    stakeRef.current = 0 // turnuva maci bahissiz -> eski para macinin stake'i tasinmasin
    betPctRef.current = 0
    await handlePlayTournamentMatch(tid, { key: matchKey }, oppId)
  }

  // Paylasimli kodla online oyuna gir (arkadas daveti). Turnuva baglami yok.
  // DONUS: girildi mi (true/false). Rovans akisi bunu okur -> basarisiz girisi TEKRAR dener.
  async function enterOnlineByCode(code: string, target = 3, tc?: TimeControl): Promise<boolean> {
    setRoomBusy(true)
    setRoomError('')
    // Davetten gelen saat (tc) varsa ONU kullan; state stale olmasin diye ayrica yaz.
    const tcUse = tc ?? timeControl
    if (tc) {
      setTimeControl(tc)
      clockRef.current = CLOCK_PRESETS[tc]
    }
    try {
      const res = await enterRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, tcUse, target)
      tournMatchRef.current = null
      resetRoomSync()
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      fairRef.current = new FairDice()
      setOppStarted(false)
      setChat([])
      // Yeni oda = temiz rovans durumu. (Zincirleme rovansta onceki macin 'yes' cevabi
      // tasinirsa yeni sonuc ekrani bastan "Rakip bekleniyor…" gosteriyordu.)
      setRematch({ mine: null, theirs: null, code: null })
      rematchSentRef.current = null
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setCoinPair(null)
      setMatchLog([])
    oppLoggedRef.current = ''
      setRatingChange(null)
      onlineTargetRef.current = target
      targetsRef.current = [target]
      setClock(freshMatchClock(target))
      setMatch(newMatch(target))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      // AÇIK menü sayfası/overlay KAPAT (Arkadaşlar/Liderlik/Mesajlar/Mağaza…): davet banner'ı her
      // ekranda üstte olduğundan bir sayfa açıkken oyuna girilebiliyordu; kapatmazsak oyun
      // görünümünde eski sayfa ARKA ZEMİNDE asılı kalıyordu ("saçma sapan sayfa" bug'ı). Diğer
      // oyuna-giriş yolları (onResume/onNewGame/resume) zaten closeAllPages çağırır.
      closeAllPages()
      setHome(false)
      setMode('online')
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.slot === 'p2' ? res.room.p1_name : res.room.p2_name,
        oppRating: res.slot === 'p2' ? res.room.p1_rating : res.room.p2_rating,
        oppAvatar: res.slot === 'p2' ? res.room.p1_avatar : res.room.p2_avatar,
        oppFrame: res.slot === 'p2' ? (res.room.p1_frame ?? null) : (res.room.p2_frame ?? null),
        oppCountry: res.slot === 'p2' ? (res.room.p1_country ?? null) : (res.room.p2_country ?? null),
        oppId: res.slot === 'p2' ? (res.room.p1_user_id ?? null) : (res.room.p2_user_id ?? null),
        status: res.room.status,
        classic: res.room.classic ?? false, // Klasik Tavla bayrağı (küp yok + mars=2) -> match.classic aynalanır
      })
      return true
    } catch (err) {
      // Sessiz kalma: girilemeyen oda kullaniciya BILDIRILIR (rovansta iki taraf da sonuc
      // ekraninda "hicbir sey olmuyor" diye kaliyordu).
      const msg = (err as { message?: string })?.message || t('mp.connError')
      setRoomError(msg)
      notify.error(msg)
      return false
    } finally {
      setRoomBusy(false)
    }
  }

  // Rövanş kodu (rematchRoom POST yanıtı VEYA poll) ile yeni odaya gir. Çift-giriş kalkanı
  // (rematchEntering/Entered) poll ile POST yanıtının yarışını dedupe eder. Rövanş = AYNI ayarlar
  // olduğundan mevcut ref'ler (onlineTarget/friendly/stake/betPct) korunur.
  async function enterRematchByCode(code: string) {
    if (!code || rematchEnteredRef.current === code || rematchEnteringRef.current === code) return
    rematchEnteringRef.current = code
    matchTargetSyncedRef.current = true
    const ok = await enterOnlineByCode(code, onlineTargetRef.current)
    rematchEnteringRef.current = null
    if (ok) rematchEnteredRef.current = code
  }

  // Okunmamis mesaj rozetini aninda tazele (ping'i beklemeden; or. konusma acilinca)
  function refreshDmUnread() {
    messagesUnread()
      .then((r) => setDmUnread(r.unread ?? 0))
      .catch(() => {})
  }

  // Arkadasi oyuna davet et (kilic ikonu): ONCE oyun turu/uzunluk/sure sec (FriendGameSetup
  // davet modu). Secili rakip orada gorunur; "Davet Gönder" -> handleSendInvite.
  function handleInviteFriend(p: { id: number; name: string; avatar?: string | null; rating?: number | null }) {
    setFriendsOpen(false)
    setInviteTarget(p)
    setFriendClassic(false) // çevrimiçi listeden davet = modern (klasik değil)
    setHome(false)
    setFriendSetupOpen(true)
  }
  // "Oyun Arayanlar": seeker'in kriterleriyle (uzunluk + bahis + tempo) eslesme havuzuna
  // gir -> backend'in kesisim mantigi seni ANINDA onunla (ya da ayni kriterli en eski uygun
  // rakiple) PUANLI maca eslestirir. handleInviteFriend'in aksine ayri bir dostluk daveti DEGIL.
  function handleJoinSeeker(s: Seeker) {
    if (!user) {
      notify.info(t('seekers.loginRequired'))
      setShowAuth(true)
      return
    }
    const stakeList = (s.stakes && s.stakes.length > 0 ? s.stakes : [s.stake]).filter((n) => n > 0)
    const maxStake = stakeList.length > 0 ? Math.max(...stakeList) : 0
    const proceed = async () => {
      // Zaten bir arama (mm_waiting) varken başka arayana tıklandı -> ESKİ isteği HEMEN öldür
      // (iki açık havuz odası kalmasın); sonra yeni kriterle havuza gir.
      if (awaitingMatchRef.current || room?.status === 'mm_waiting') {
        awaitingMatchRef.current = false
        try { await cancelMatchmake() } catch { /* yoksay */ }
      }
      const targets = s.targets && s.targets.length > 0 ? s.targets : [1]
      targetsRef.current = targets
      onlineTargetRef.current = Math.max(...targets) // gecici; eslesmede room.target ile guncellenir
      minRatingRef.current = 0
      betPctRef.current = s.bet_pct || 0
      stakesRef.current = stakeList.length > 0 ? stakeList : null
      stakeRef.current = maxStake
      classicRef.current = !!s.classic // KLASIK TAVLA arayana AYNI modla katıl (küp yok + mars=2)
      setTimeControl(s.time_control)
      clockRef.current = CLOCK_PRESETS[s.time_control]
      mmOriginRef.current = s.classic ? 'klassik' : 'match' // iptalde ilgili kurulum ekranina don
      setHome(false)
      setMode('online')
      handleMatchmake(s.time_control) // state henuz stale -> temposu override et
    }
    // Para/bahis maci: tek tiklamayla coin bagladigini acikca ONAYLAT (footgun degil). Markasiz
    // native window.confirm yerine uygulama-ici stilli modal (seekerConfirm) -> proceed onayla calisir.
    const msg =
      s.bet_pct > 0
        ? t('seekers.confirmPct', { pct: s.bet_pct })
        : maxStake > 0
          ? t('seekers.confirmStake', { coins: maxStake })
          : null
    if (msg) {
      setSeekerConfirm({ msg, run: proceed })
      return
    }
    proceed()
  }
  // Secilen ayarlarla daveti yolla: kod al (ayarlar davete islenir), odaya gir, rakip
  // kabul edince AYNI ayarla (target/saat) baslar.
  async function handleSendInvite(opts: { target: number; timeControl: TimeControl; unrated: boolean; classic?: boolean }) {
    const tgt = inviteTarget
    if (!tgt) return
    setFriendSetupOpen(false)
    setInviteTarget(null)
    setInviteWaitName(tgt.name) // bekleme ekrani "kod paylas" yerine "{ad} bekleniyor" gostersin
    setInviteWaitRating(tgt.rating ?? null)
    setInviteWaitPreview(null) // onceki davetin tahmini kalmasin; yanit gelince set edilir
    setTimeControl(opts.timeControl)
    clockRef.current = CLOCK_PRESETS[opts.timeControl]
    onlineTargetRef.current = opts.target
    targetsRef.current = [opts.target]
    setMode('online')
    // Onceki BITMIS oyunu HEMEN temizle + bekleme spinner'ini ac (handleCreateRoom ile ayni
    // kalkan): aksi halde davet agi (inviteFriend) beklenirken matchOver=true bayat kalip
    // game-view ESKI board'u -hatta sonuc ekranini- FLASH ediyordu ("davet gonderince
    // eskiden kalma board"). Bu 3 reset matchOver'i dusurup roomBusy=true ile bekleme
    // kabugunu (Lobby) render eder; enterOnlineByCode zaten tam sifirlamayi yapar.
    setRoomBusy(true)
    setRoomError('')
    setGameEnd(null)
    setTurnsPlayed(0)
    setMatch(newMatch(opts.target))
    try {
      classicRef.current = !!opts.classic // KLASIK TAVLA daveti: davet eden oda klasik olur
      const { code, ratingPreview } = await inviteFriend(tgt.id, { target: opts.target, timeControl: opts.timeControl, unrated: opts.unrated, classic: opts.classic })
      setInviteWaitPreview(ratingPreview ?? null)
      const ok = await enterOnlineByCode(code, opts.target, opts.timeControl)
      if (!ok) {
        // Davet GÖNDERİLDİ ama davet edenin odası kurulamadı (enterOnlineByCode false) -> gönderilen
        // daveti GERİ ÇEK (rakipte odası olmayan dangling davet banner'ı kalmasın; rooms-join zaten
        // göstermez ama DB'de 'pending' bırakma) + lobiye temiz dön. (enterOnlineByCode toast'ı gösterdi.)
        cancelInvite(code).catch(() => {})
        setInviteWaitName(null)
        setHome(true)
      } else {
        // Davet gönderildi + oda kuruldu. BOŞ "Rakip Bekleniyor" kartında bekletme (kullanıcı
        // sıkılıyor): ana sayfaya dön; davet "Oyun Arayanlar"da (mySeek, inviteWaitName) görünür.
        // Rakip kabul edip odaya girince (status 'playing') poll + auto-enter effect'i oyuna
        // sokar -> havuz eşleşmesiyle (mm_waiting) birebir aynı akış.
        awaitingMatchRef.current = true
        setHome(true)
      }
    } catch (e) {
      // "Oyun Kabul Etmiyor" (409) gibi durumlarda sunucu mesajini dostça göster.
      if (e instanceof ApiErr && e.status === 409) notify.info(e.message || t('online.busyBlocked'))
      else notify.error(t('mp.connError'))
      setRoomBusy(false) // spinner'i kapat -> home dalina temiz don
      setInviteWaitName(null) // davet basarisiz -> bekleme etiketini birakma
      setHome(true)
    }
  }
  // Kendi durumunu degistir (ust bar durum secici): iyimser guncelle + sunucuya yaz. Yarış koruması:
  // damgayı HEMEN vur (uçuştaki heartbeat optimistik değeri ezmesin); POST onayında değeri + damgayı
  // tazele. POST başarısızsa damgayı sıfırla -> bir sonraki heartbeat GERÇEK (server) durumu yansıtsın.
  function handleSetStatus(s: PresenceStatus) {
    setMyStatus(s)
    statusChangedAtRef.current = Date.now()
    setPresenceStatus(s)
      .then((confirmed) => {
        statusChangedAtRef.current = Date.now()
        setMyStatus(confirmed)
      })
      .catch(() => {
        statusChangedAtRef.current = 0
      })
  }
  // Cevrimici oyuncu panelinden "Arkadas ol": id ile istek + toast.
  async function handleAddFriend(userId: number) {
    try {
      const r = await requestFriendById(userId)
      notify.success(
        r.status === 'accepted'
          ? t('online.friendMutual')
          : r.status === 'pending'
            ? t('online.friendSent')
            : t('online.friendExists'),
      )
    } catch {
      notify.error(t('online.friendFail'))
    }
  }
  async function handleAcceptInvite(inv: GameInviteT) {
    setInvites((list) => list.filter((i) => i.id !== inv.id))
    try {
      const r = await respondInvite(inv.id, true)
      // Davet edenin sectigi AYNI ayarla gir: target (Tek Oyun=1 / Mac uzunlugu) + saat.
      if (r.code) {
        await enterOnlineByCode(r.code, r.target ?? inv.target ?? 3, (r.timeControl ?? inv.timeControl ?? undefined) as TimeControl | undefined)
      } else {
        // Kod yok = davet artik gecerli degil. SESSIZ KALMA -> "kabul ettim hicbir sey olmadi".
        notify.error(t('friends.inviteExpired'))
      }
    } catch (e) {
      // Davet eden ayrildi (409) / davet silinmis (404): banner iyimser kaldirildi, kullanici
      // hicbir geri bildirim gormeden takiliyordu. Sunucu mesajini dostca goster.
      const msg = e instanceof ApiErr && e.message ? e.message : t('friends.inviteExpired')
      notify.error(msg)
    }
  }
  async function handleDeclineInvite(inv: GameInviteT) {
    setInvites((list) => list.filter((i) => i.id !== inv.id))
    respondInvite(inv.id, false).catch(() => {})
    // Reddedince: bir daha rahatsiz olmamak icin durum degistirmek ister mi diye sor.
    setDeclineAsk(true)
  }

  function handleLeaveRoom() {
    stakeRef.current = 0
    betPctRef.current = 0
    awaitingMatchRef.current = false // odadan çık = artık eşleşme/davet bekleme auto-enter YOK
    clearOppReplay() // §5.2: odadan çıkınca bekleyen rakip-hamle replay'ini iptal et
    // Hedefli davetle acilmis + hala BEKLEYEN oda -> "Oyunu Iptal Et": daveti de geri cek ki
    // rakibin ekranindaki davet banner'i (sonraki /ping poll'unda) KALKSIN.
    if (inviteWaitName && room?.status === 'waiting' && room?.code) {
      cancelInvite(room.code).catch(() => {})
    }
    setInviteWaitName(null) // hedefli davet bekleme etiketini temizle
    setRematch({ mine: null, theirs: null, code: null })
    rematchEnteredRef.current = null
    rematchEnteringRef.current = null
    rematchSentRef.current = null
    setRoom(null)
    syncEnabledRef.current = false
    resetRoomSync()
    setOppStarted(false)
    setChat([])
    tournMatchRef.current = null
    clockBankRef.current = null // turnuva ozel suresi yalniz o macta
    // Biten macin sonuc state'ini de temizle -> odadan cikinca matchOver/gameEnd STALE kalmasin.
    // Aksi halde sonraki Mac Oyunu/Basla gecisinde early-return'ler (!matchOver'a bagli arama/
    // board) atlanip eski MatchResult (sonuc ekrani) bir kare FLASH ediyordu.
    setMatch(newMatch(match.target))
    setGameEnd(null)
    setTurnsPlayed(0)
    // BOARD'u da sifirla: aksi halde `working` (turnStart+played) ESKI KAZANAN pozisyon kalir
    // ve oyun-sonu effect'i (turnsPlayed>0 iken) gameEnd'i yeniden kurabilir. turnsPlayed=0
    // guard'i asil koruma; bu ise `working`'i temiz tutar (defans-derinligi).
    setTurnStart(freshBoard('white'))
    setPlayed([])
    setSelectedFrom(null)
    setHome(true)
  }

  // Oyun bitti (ozellikle ZAMAN ASIMI) ve sonuc ekrani yok -> ESKI "Online Oyun" secim
  // ekranina (Rakip Bul/Oyun Olustur/Oda Kodu) DUSME; oyuncuyu GIRDIGI menuye (origin) don.
  function returnToOrigin() {
    handleLeaveRoom() // tum online/board/sonuc state'ini temizler + setHome(true)
    setMode('pvb')
    if (friendlyRef.current) setFriendSetupOpen(true)
    else if (mmOriginRef.current === 'solo') setSoloOpen(true)
    else { setClassicSetup(mmOriginRef.current === 'klassik'); setSetup('online') }
  }

  // Online oda 'finished' + maç-sonu ekranı (matchOver) yok + rövanş akışı YOK ise: seçim
  // ekranına düşmeden origine dön. Rövanş sürerken (buton/istek/giriş) DOKUNMA -> aksi halde
  // "Sonraki Oyun" akışını iptal ederdi.
  useEffect(() => {
    if (
      mode === 'online' &&
      !matchOver &&
      room?.status === 'finished' &&
      !botAnim && // bot maçı bitiren hamleyi oynatıyor -> sonuç ekranı birazdan gelecek
      !pendingBotFinalRef.current &&
      !rematch.code &&
      !rematch.mine &&
      !rematch.theirs &&
      !rematchEnteringRef.current
    ) {
      returnToOrigin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, matchOver, room?.status, rematch.code, rematch.mine, rematch.theirs, botAnim])

  // POOL arama ana sayfada beklerken EŞLEŞTİ (status 'playing'): oyuna gir. awaitingMatchRef
  // gate'i, "aktif oyun sırasında ana sayfaya gitme" (resume bar) akışını ETKİLEMEZ -> yalnız
  // havuz aramasından gelen bekleyiş auto-enter olur.
  useEffect(() => {
    if (awaitingMatchRef.current && online && home && room?.status === 'playing' && !matchOver) {
      awaitingMatchRef.current = false
      closeAllPages() // açık menü sayfası varsa kapat (diğer oyuna-giriş yolları gibi)
      setHome(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, home, room?.status, matchOver])

  // Reload sonrasi TEK aktif odaya bir kez otomatik don (asagidaki activeRooms effect'i kullanir).
  const autoResumedRef = useRef(false)

  // Devam eden online maca GERI DON: odayi kur; poll (room.code'a bagli) sunucudaki
  // guncel state'i applyOnlineState ile geri yukler ve senkronu acar.
  function rejoinRoom(r: ActiveRoom) {
    const tgt = r.target ?? 1
    onlineTargetRef.current = tgt
    matchTargetSyncedRef.current = true
    // TURNUVA ODASI: tournMatchRef/tournRoom'u KUR (mass-forfeit kök fix). Aksi halde generic
    // rejoin isaretci koymaz -> "maç hazır" penceresi kendi maçını "başka oyun" sanıp confirmLeave
    // ile hükmen terke sürüklüyordu; ayrıca maç sonucu bracket'e raporlanmıyordu (tm null).
    if (r.tournament && r.tid != null && r.tmatch) {
      tournMatchRef.current = { tid: r.tid, matchKey: r.tmatch, oppId: r.opp_id ?? 0 }
      setTournRoom({ code: r.code, tid: r.tid })
    } else {
      tournMatchRef.current = null
    }
    resetRoomSync()
    syncEnabledRef.current = false // poll apply edince acilir (echo yok)
    setMode('online')
    fairRef.current = new FairDice()
    setMatch(newMatch(tgt))
    setClock(freshMatchClock(tgt))
    setStarter('white')
    setTurnsPlayed(0)
    setTurnStart(freshBoard('white'))
    setPlayed([])
    setSelectedFrom(null)
    setCubePending(null)
    setGameEnd(null)
    setBotAnim(null)
    setOpening(null)
    setOppStarted(true)
    setChat([])
    closeAllPages()
    // SUNUCU-OTORİTER BOT resume: yerel motor DEĞİL sunucu akışı. Otorite ref'lerini SENKRON kur
    // (poll'dan önce doRoll/commit serverRoll/serverMove seçsin) + bot maçı puanlı (matchType='ai').
    const isBot = !!r.bot
    friendlyRef.current = !isBot ? friendlyRef.current : false
    authoritativeRef.current = isBot ? true : authoritativeRef.current
    diceAuthorityRef.current = isBot ? true : diceAuthorityRef.current
    setRoom({
      code: r.code,
      slot: r.slot,
      oppName: r.opp_name ?? '',
      oppRating: r.opp_rating ?? null,
      oppAvatar: r.opp_avatar ?? null,
      oppFrame: null,
      oppCountry: r.opp_country ?? null,
      status: 'playing',
      authoritative: isBot ? true : undefined,
      dice_authority: isBot ? true : undefined,
      bot: isBot,
      botLevel: r.bot_level ?? null,
    })
    setHome(false)
    // Bot maçında sıra bota geçmiş halde bırakılmış olabilir (nadir); poll durumu getirince
    // botNudge idempotenttir (sıra insandaysa no-op). Kısa gecikme: server_state uygulansın.
    if (isBot) {
      window.setTimeout(() => {
        botNudge(r.code)
          .then((res) => applyBotTurns(res?.bot))
          .catch(() => {})
      }, 1200)
    }
  }

  // Lobide: giris yapan kullanicinin devam eden online maclarini cek (geri donme banner'i).
  // PERIYODIK yoklama SART: davet gonderip odadan cikan kullanici ana sayfada beklerken
  // rakip daveti KABUL edince oda 'waiting' -> 'playing' olur. Tek-seferlik cekim (deps
  // degismedigi icin) banner'i ASLA gostermezdi -> kullanici maci yalnizca "Canli Maclar"da
  // gorup IZLEYICI olarak acardi (oyuncu olarak giremeden). Canli Maclar paneli gibi 10sn'de
  // bir yenile -> kabul edilir edilmez "Maça Dön" banner'i (oyuncu olarak giris) belirsin.
  useEffect(() => {
    if (!user || !home) {
      setActiveRooms([])
      return
    }
    let alive = true
    const load = () =>
      myActiveRooms()
        .then((rs) => {
          if (!alive) return
          // TURNUVA ODALARINI HARIC TUT (mass-forfeit kok fix): turnuva maci odasini generic
          // rejoinRoom ile acmak tournMatchRef'i set ETMEZ -> "maç hazır" penceresi kendi maçını
          // "başka aktif oyun" sanıp confirmLeave ("oyunu bırak, geç") ile HÜKMEN terke sürüklüyordu.
          // Turnuva macina giris YALNIZ TournMatchReady akisindan (o tournMatchRef kurar). Presence
          // _seen sunucuda her myActiveRooms poll'unda zaten tazelenir (abandon riski yok); reload'da
          // ping bildirimi (maç bitene dek sürer) normal 3sn modunda dogru girisi yapar.
          const nonTourn = rs.filter((r) => !r.tournament)
          setActiveRooms(nonTourn)
          if (!autoResumedRef.current && !room && nonTourn.length === 1) {
            autoResumedRef.current = true
            rejoinRoom(nonTourn[0])
          }
        })
        .catch((e) => {
          if (!alive) return
          // Oturum GERÇEKTEN dolmuşsa (sanctum'un JSON 401'i): poll'u durdur ve oturumu düşür.
          // Yoksa 10sn'de bir sonsuza dek 401 döner (konsol gürültüsü + boşuna sunucu yükü).
          // Bootstrap'taki `isAuthRejected(e) -> apiLogout()` ile aynı davranış (tek kaynak).
          if (isAuthRejected(e)) {
            apiLogout()
            setUser(null)
            return
          }
          // Geçici hata (503 hiccup / ağ kopukluğu / 502): banner'ı SİLME (blip'te "Maça Dön"
          // kaybolmasın), bu turu atla — bir sonraki poll toparlar.
        })
    load()
    const id = window.setInterval(load, 10000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, home])

  // Online sohbet: mesaj gonder (sunucu guncel listeyi doner)
  async function handleSendChat(text: string) {
    if (!room) return
    try {
      const res = await sendChat(room.code, text)
      if (res.messages) setChat(res.messages)
      setChatNotice(res.warning ? chatWarnText(t, res.warning) : null) // küfür -> kırmızı uyarı
    } catch (e) {
      const mute = chatMuteFromError(e) // konuşma yasaklı -> gönderim engellendi, kalan süre
      if (mute) setChatNotice(chatMuteText(t, mute.seconds))
      /* diğer hatalar: yoksay - sonraki yoklamada gelir */
    }
  }

  // Mac kurulum ekrani onaylandi -> ayarlari uygula, maci/odayi baslat
  function applyMatchSetup(opts: MatchOptions) {
    // Mac Oyunu her zaman online (gercek rakiple eslesme) -> hesap sart. Misafir icin
    // API'ye gidip kafa karistiran 'Bahisli oyun icin giris yapmalisin' 422'sini yemeden
    // ONCE net giris akisi ac (kullanici kurulumda kalir, uzerine Giris/Kayit modali gelir).
    if (opts.mode === 'online' && !user) {
      // Kurulum (setup) ekranini KAPAT + home dalina dus -> auth page-host'ta header'li acilir.
      // Aksi halde setup dalinda authModal SIBLING fixed-overlay olarak render edilip ust
      // hesap barini (header) orterdi ("ust menu uctu").
      setSetup(null)
      setHome(true)
      notify.info(t('mp.loginRequired'))
      setShowAuth(true)
      return
    }
    // Onceki BITMIS macin sonuc state'ini (matchOver kaynagi match + gameEnd) setup KAPANMADAN
    // ONCE temizle. Arama/board early-return'leri !matchOver'a bagli; matchOver stale iken
    // setSetup(null) render'i bir kare eski MatchResult'i FLASH ediyordu (sonra arama gelir).
    if (opts.mode === 'online') {
      const tgt = Math.max(...(opts.targets && opts.targets.length ? opts.targets : [opts.target]))
      setMatch(newMatch(tgt))
      setGameEnd(null)
      setTurnsPlayed(0)
      // BOARD'u da `await matchmake` boslugundan ONCE sifirla: room=null olunca `online`
      // false olur, oyun-sonu effect'inin authoritative guard'i atlanir; stale KAZANAN board
      // + gameEnd=null -> effect maci yeniden skorlar -> MatchResult flash. turnsPlayed=0 guard
      // asil koruma; bu `working`'i temiz tutar (bkz oyun-sonu effect'i).
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
    }
    setShowPip(opts.showPip)
    setShowAnalysis(opts.showAnalysis)
    setTimeControl(opts.timeControl)
    setRankedMatch(opts.ranked ?? true)
    clockRef.current = CLOCK_PRESETS[opts.timeControl]
    if (opts.difficulty) setDifficulty(opts.difficulty)
    setSetup(null)
    setClassicSetup(false)
    setHome(false)
    // Mac Oyunu: her zaman online -> gercek rakiple dogrudan eslesme (Oyunu Baslat)
    if (opts.mode === 'online') {
      mmOriginRef.current = opts.classic ? 'klassik' : 'match' // iptalde ilgili kurulum ekranina don
      targetsRef.current = opts.targets && opts.targets.length ? opts.targets : [opts.target]
      onlineTargetRef.current = Math.max(...targetsRef.current) // gecici; anlasilan uzunluk eslesmede kesinlesir
      stakeRef.current = 0 // Mac Oyunu sabit stake degil, % bahis kullanir
      stakesRef.current = null // Tek Oyun coklu-bahis'i sizdirma (Mac Oyunu % bahis)
      betPctRef.current = opts.betPct ?? 0
      minRatingRef.current = opts.minRating ?? 0
      classicRef.current = !!opts.classic // Klasik Tavla: ayri eslesme havuzu + kup yok + mars=2
      setMode('online')
      setHome(false)
      handleMatchmake()
    } else if (SERVER_BOT) {
      // SUNUCU-OTORİTER BOT: PvB artık sunucuda (authoritative oda) oynanır -> iki pencere TEK
      // state'i izler. Yerel motor (handleNewMatch/'pvb') SERVER_BOT=false ile geri gelir.
      mmOriginRef.current = 'solo' // iptal/terkte lobiye dön
      handleCreateBotRoom(opts.target, opts.difficulty ?? difficulty, opts.timeControl, !!opts.classic)
    } else {
      handleNewMatch(opts.target, 'pvb')
    }
  }

  // Hamleyi onayla ve sirayi rakibe ver
  function handleConfirm() {
    const err = computeMoveError(played)
    if (err) setLastError(err)
    commitTurn(played)
  }

  // Bir step dizisini oyna. Tur otomatik BITMEZ (Onayla gerekir).
  // srcRectOverride: suruklemede tasin BIRAKILDIGI konum -> hedef tas oradan akar (parmaktan
  // kopmadan yerine oturur). undefined = tik/otomatik hamle (kaynak noktadan ucur). null =
  // ucus yok.
  function playSteps(seq: Step[], srcRectOverride?: DOMRect | null) {
    // Tas hareket animasyonu: state guncellenmeden ONCE kaynak konumunu yakala.
    // Birlesik hamlede (seq>1) tek ucus: ilk adimin kaynagi -> son adimin hedefi.
    if (
      moveStyle !== 'off' &&
      animOn &&
      seq.length > 0 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const r = srcRectOverride !== undefined ? srcRectOverride : sourceRect(seq[0].from)
      if (r) pendingFlightRef.current = { to: seq[seq.length - 1].to, srcRect: r, offColor: turnStart.turn }
    }
    setPlayed([...played, ...seq])
    setSelectedFrom(null)
  }

  // Hamle uygulandiktan (render) sonra hedef tasi kaynaktan ucur.
  useLayoutEffect(() => {
    const f = pendingFlightRef.current
    if (!f || moveStyle === 'off') {
      pendingFlightRef.current = null
      return
    }
    pendingFlightRef.current = null
    const el = destEl(f.to, f.offColor)
    if (el) flyChecker(el, f.srcRect, moveStyle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played])

  // TEK TIK: kaynaga tiklayinca oyna.
  // Oncelik: toplama (bear-off) varsa topla; yoksa aktif zar.
  function handleSelectFrom(from: number | 'bar') {
    if (!interactive) return
    const stepsFrom = nextSteps.filter((s) => s.from === from)
    if (stepsFrom.length === 0) return
    const offStep = stepsFrom.find((s) => s.to === 'off')
    if (offStep) {
      playSteps([offStep])
      return
    }
    const active = remainingDice[0]
    const step = stepsFrom.find((s) => s.die === active) ?? stepsFrom[0]
    playSteps([step])
  }

  // Surukleme baslarken kaynagi sec (yesil hedefler gorunur)
  function handleDragFrom(from: number | 'bar') {
    if (!interactive) return
    setSelectedFrom(from)
  }

  // Hedefe birak -> o hedefe giden dizi (birlesik 8 dahil) oyna
  function handleSelectTarget(to: number | 'off') {
    if (!interactive || selectedFrom === null) return
    const seq = dragTargets.get(to)
    if (!seq || seq.length === 0) return
    playSteps(seq)
  }

  // Pointer surukleme birakimi: tas BIRAKILAN konumdan (srcRect) yerine akar.
  function handleDragDrop(to: number | 'off', srcRect: DOMRect) {
    if (!interactive || selectedFrom === null) return
    const seq = dragTargets.get(to)
    if (!seq || seq.length === 0) return
    playSteps(seq, srcRect)
  }

  // Zar sirasini degistir (2-1 -> 1-2): once oynanacak zari sec
  function handleSwapDice() {
    if (!interactive || turnStart.dice.length !== 2 || played.length !== 0) return
    const s = cloneState(turnStart)
    s.dice = [turnStart.dice[1], turnStart.dice[0]]
    setTurnStart(s)
    setSelectedFrom(null)
  }

  // Geri al: son oynanan tek adimi geri al (komple degil)
  function handleUndo() {
    setPlayed((p) => p.slice(0, -1))
    setSelectedFrom(null)
  }

  function handleNewMatch(target = match.target, nextMode = mode) {
    if (nextMode !== 'online') {
      setRoom(null)
      syncEnabledRef.current = false
    }
    setMode(nextMode)
    fairRef.current = new FairDice() // yeni mac -> yeni adil-zar taahhudu
    setMatch(newMatch(target))
    setStarter('white')
    setTurnStart(freshBoard('white'))
    // Saat bankasi YENI hedefe gore dolsun (match state'i bu render'da hala ESKI mac).
    resetGameUi(true, target)
    setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setCoinPair(null)
    setMatchLog([])
    humanTurnsRef.current = 0 // yeni mac -> hayalet-mac kalkani sayaci sifirla
    oppLoggedRef.current = ''
    setRatingChange(null) // yeni mac -> PR sifirla
    setMessage(t('msg.newMatch'))
  }

  function handleLogout() {
    apiLogout()
    setCartItems([]) // A-30: bellekteki sepet de (effect onu yeniden localStorage'a yazmasın)
    setUser(null)
    setGuestProfile(null)
  }

  function nextGame() {
    // ONLINE'da sonraki oyunu KARSI TARAF (veya otoriter sunucu) zaten kurmus olabilir: oyun
    // bitince rakip "Sonraki Oyun"a once basar, maci ilerletip taze tahtayi bize gonderir
    // (applyOnlineState/applyServerBoard match'i KOMPLE degistirir). Bu istemcide sonuc kutusu
    // hala acik oldugundan kullanici da butona basar ve setupNextGame IKINCI kez calisirdi:
    // isCrawford=true olan maci "Crawford OYNANDI" (crawfordDone=true, isCrawford=false) diye
    // ilerletiyordu -> rakip sari CRAWFORD rozetini gorurken bu ekranda rozet YOKTU (ve kup
    // Crawford oyununda acik kaliyordu). Tahta taze baslangic pozisyonundaysa mac ZATEN
    // ilerlemistir (biten oyunun tahtasi asla baslangic pozisyonu olamaz) -> ilerletme.
    const advanced = online && boardKey(turnStart) === START_KEY
    const m2 = advanced ? match : setupNextGame(match)
    const s = advanced ? starter : opponent(starter)
    setStarter(s)
    setMatch(m2)
    if (!advanced) setTurnStart(freshBoard(s))
    resetGameUi(false) // mac-basi rezerv saati: bankayi koru, sadece hamle gecikmesini sifirla
    setMessage(m2.isCrawford ? t('msg.crawfordGame') : t('msg.nextGame'))
  }

  // Maç devam ediyorsa sonuç ekranında kullanıcıdan "Sonraki Oyun" tıklaması isteme.
  // Sunucu yeni oyunun state'ini hazırladıktan kısa süre sonra aynı geçişi otomatik yap.
  useEffect(() => {
    if (!gameEnd || matchOver) {
      autoNextGameRef.current = false
      return
    }
    if (autoNextGameRef.current) return
    autoNextGameRef.current = true
    const timer = window.setTimeout(() => {
      nextGame()
    }, 900)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameEnd, matchOver])

  // ---- Overlay icerikleri ----
  // "hamle yok" popup: kendi siramda VEYA bot dans ederken VEYA online RAKİP dans ederken goster
  // (rakip zar atip hamlesi yoksa yerel oyuncu da ~2sn "Hamle Yok" panelini gorur -> adam anlar).
  const noMove =
    diceRolled &&
    hasNoMove(generateMoves(turnStart)) &&
    (interactive || botDance || (online && !myTurn && !gameEnd && !matchOver))
  const showRoll = interactive && !diceRolled && !oppReplay // §5.2: replay bitene dek zar kontrolünü gizle
  // Zar zaten OTOMATIK atilacaksa "Zar At" butonunu HIC cizme (kullanici direktifi: kup
  // rakipteyse dugmeyi gormeyeyim, dogrudan zari goreyim). Kosul, otomatik-zar effect'iyle
  // BIREBIR ayni (shouldAutoRoll + ayni guard'lar) -> buton gizlenip zar atilmama riski yok.
  const autoRollPending =
    showRoll &&
    !autoRollStuck && // oto-zar ~4sn basaramadi -> butonu AC (acil kapi, olu-kup macta tek kurtarma)
    !opening &&
    !cubePending &&
    !gameWon &&
    !oppReplay && // §5.2: rakip hamlesi oynanırken "Atılıyor…" gösterme (replay bitince devreye girer)
    shouldAutoRoll(match, turnStart.turn, turnsPlayed, turnStart, isMoneyGame)
  // Tum oynanabilir zarlar oynandi -> onay bekleniyor
  const turnComplete =
    interactive && diceRolled && played.length > 0 && nextSteps.length === 0
  const humanCanDouble =
    showRoll && turnsPlayed > 0 && canDouble(match, turnStart.turn, false, isMoneyGame)
  // Kup teklifine yanit: pvp (ayni ekran), bota karsi, veya online'da rakip teklif ettiyse
  // Kutu görünürlüğü YALNIZ cubePending'e bağlı (tek kaynak). Kabul edince handleTake cubePending'i
  // ANINDA null yapar -> kutu hemen kapanır ve GERİ GELMEZ. (botThinking ile GATE ETME: botThinking
  // cubePending'den önce temizlenip "aynı teklif ekranı tekrar geldi" bug'ına yol açmıştı.)
  const humanRespond =
    cubePending !== null &&
    (mode === 'pvp' ||
      (mode === 'pvb' && cubePending === BOT_PLAYER) ||
      (online && cubePending !== myColor))
  // Online'da kendi teklifim: rakibin yanitini bekliyorum
  const cubeWaiting = online && cubePending === myColor
  const canSwapDice =
    interactive &&
    played.length === 0 &&
    remainingDice.length === 2 &&
    remainingDice[0] !== remainingDice[1]
  // Zar yuzleri: hep 2 zar goster, oynananlari soluk yap (ciftte yarisi soluk).
  // RAKİP TURUNDA da soluklaşsın (kullanıcı isteği: rakibin hangi zarı oynadığı/kaldığı net olsun):
  // pvp'de rakibin canlı adımları oppLive'da, bota karşı bot adımları played'de (botAnim) gelir.
  // Kendi turumda: played. Böylece hem kendi hem rakip zarları oynandıkça solar.
  const fadeSteps = online && !myTurn && oppLive.length > 0 ? oppLive : played
  const diceFaces = ((): { value: number; used: boolean; half?: boolean }[] => {
    const d = turnStart.dice
    if (d.length === 0) return []
    if (d.length === 4) {
      // Cift zar: 2 zar goster, her zar 2 hamle. Her oynanan hamle zarin CAPRAZ yarisini
      // soldurur -> 1. hamle 1. zarin yarisi, 2. hamle 1. zar tam, 3. hamle 2. zarin yarisi,
      // 4. hamle 2. zar tam (4 adimda seffaflasir).
      return [0, 1].map((i) => {
        const h = Math.min(2, Math.max(0, fadeSteps.length - i * 2)) // bu zarin oynanmis yarisi (0/1/2)
        return { value: d[0], used: h >= 2, half: h === 1 }
      })
    }
    const used = [false, false]
    for (const st of fadeSteps) {
      for (let i = 0; i < d.length; i++) {
        if (!used[i] && d[i] === st.die) {
          used[i] = true
          break
        }
      }
    }
    return d.map((v, i) => ({ value: v, used: used[i] }))
  })()
  const pipTop = pipCount(boardDisplay, 'black')
  const pipBottom = pipCount(boardDisplay, 'white')

  // PR (Performans Reytingi) GÖSTERİMİ: YALNIZ sunucu (gnubg) otoriter değeri gösterilir.
  // wildbg (istemci) PR'ı KULLANICIYA HİÇBİR YERDE gösterilmez (direktif). gnubg hazır değilse
  // null -> ekranda gizlenir / loader. NOT: istemci prStats hâlâ SUNUCUYA raporlanır (prRef);
  // sunucu ilk değeri saklar, gnubg job'ı authoritative'de EZER. Ekranda ise yalnız gnubg görünür.
  const prBand = (p: number | null): string => (p == null ? '' : divisionOfPR(p).key)
  const prHumanColor: Player = online ? myColor : 'white'
  // SAHTE-0 KALKANI: gnubg genel/pul PR'ı GERÇEK bir logmuş maçta ASLA tam 0.00 olmaz. 0 => "hesaplanamadı"
  // sentinel'idir (ör. eski satırlarda gnubg_opponent_pr=0 kalmış; rakip hamleleri log'dan skorlanamamış).
  // 0'ı null'a çevir -> ekran "—" gösterir ve divisionOfPR(0)=Super Grandmaster YANLIŞ etiketi (kaybeden
  // usta gibi görünüyordu) oluşmaz. NOT: Küp PR'da 0 MEŞRU (kübü kusursuz oynamak) -> ona dokunma.
  // PR 0.00 GERÇEK bir değerdir (kusursuz oyun; sv12 gnubg bot bunu sık alır) -> "—" YAPMA.
  // Sunucu (gnubg-otoriter) veri yoksa NULL yazar (ekran "—"); 0 = gerçekten hatasız. Eskiden
  // prNz 0'ı gizliyordu -> sv12 botun sonucu "—" görünüyordu (bu ekranın kök nedeni). Küp zaten
  // 0'ı gösteriyordu; üçü de artık tutarlı: yalnız null -> "—".
  const prShown = (c: Player): number | null =>
    serverPr ? ((c === prHumanColor ? serverPr.self : serverPr.opp) ?? null) : null
  const prCheckerShown = (c: Player): number | null =>
    serverPr ? ((c === prHumanColor ? serverPr.checkerSelf : serverPr.checkerOpp) ?? null) : null
  const prCubeShown = (c: Player): number | null =>
    serverPr ? ((c === prHumanColor ? serverPr.cubeSelf : serverPr.cubeOpp) ?? null) : null
  const prValue = prShown(prHumanColor)
  const prBandKey = prBand(prValue)
  // CANLI (oyun-içi) anlık PR TAHMİNİ: gnubg maç-sonu hesaplandığından oyun İÇİNDE tek seçenek
  // yerel prStats'tır. Sidebar'da "~PR" (tahmin) etiketiyle gösterilir; RESMİ/kesin PR maç sonu
  // gnubg olur (sonuç ekranı + analiz). Kullanıcı kararı: oyun sırasında canlı tahmin görünsün.
  const prLiveEstimate = (c: Player): number | null => {
    const s = prStats[c]
    if (s.decisions > 0) return (s.loss / s.decisions) * 500
    const ad = s.allDecisions ?? 0
    return ad > 0 ? ((s.allLoss ?? 0) / ad) * 500 : null
  }
  // Sans: kendi rengim lokal (mutlak); online'da rakip hesaplanmadıysa null (MatchResult
  // negatifiyle sıfır-toplam gösterir). NOT: MatchResult zaten net = kazanan−kaybeden ile
  // sıfır-toplam yapar; burada MUTLAK değer döndür (relative döndürünce ×2 çift-sayım oluyordu).
  // ÇAPRAZ-İSTEMCİ TUTARLILIK: sunucu-otoriter ham renk-luck varsa onu kullan (iki oyuncu da
  // backend'den AYNI white+black çiftini okur -> MatchResult net'i özdeş). Yoksa lokal prLuck'a
  // düş (online'da rakip henüz hesaplanmadıysa null -> MatchResult negatifiyle sıfır-toplam).
  const luckOf = (c: Player): number | null => {
    if (serverLuck && serverLuck[c] != null) return serverLuck[c]
    if (online && c !== myColor && prStats[c].decisions === 0) return null
    return prLuck[c]
  }
  // Tavlai Luck V1: gnubg NATIVE MWC-luck (%). İKİSİ de biliniyorsa MatchResult BAĞIMSIZ %
  // gösterir (sıfır-toplam DEĞİL — gnubg metodolojisi: her oyuncu kendi zarlarından). Biri
  // eksikse null -> MatchResult ham luck (net) fallback'ine düşer.
  const luckPctOf = (c: Player): number | null => {
    if (serverLuckMwc && serverLuckMwc.white != null && serverLuckMwc.black != null) {
      return serverLuckMwc[c]
    }
    return null
  }
  // Maç Özeti: gnubg luck EQUITY (cost) + JOKER sayısı (renk bazlı; yoksa null -> '—').
  const luckEmgOf = (c: Player): number | null => serverLuckEmg?.[c] ?? null
  const jokersOf = (c: Player): number | null => serverLuckJokers?.[c] ?? null

  let centerMain: React.ReactNode = null
  if (opening === 'roll') {
    centerMain = (
      <div className="result-box">
        <div className="result-title">{t('opening.title')}</div>
        <div className="opening-rolling">
          <Die value={1} owner="white" used={false} className="rolling" />
          <Die value={6} owner="black" used={false} className="rolling" />
        </div>
        <div className="result-points">{t('opening.rolling')}</div>
      </div>
    )
  } else if (opening === 'reveal' && openingResult) {
    centerMain = (
      <div className="result-box">
        <div className="result-title">{t('opening.title')}</div>
        <div className="opening-dice">
          <div className={`opening-side ${openingResult.winner === 'white' ? 'win' : ''}`}>
            <Die value={openingResult.white} owner="white" used={false} />
            <span>{t('player.white')}</span>
          </div>
          <div className={`opening-side ${openingResult.winner === 'black' ? 'win' : ''}`}>
            <Die value={openingResult.black} owner="black" used={false} />
            <span>{t('player.black')}</span>
          </div>
        </div>
        <div className="result-points">
          {t('msg.openingResult', {
            name: pName(openingResult.winner),
            a: openingResult.winnerDie,
            b: openingResult.loserDie,
          })}
        </div>
      </div>
    )
  } else if (gameEnd && !matchOver) {
    // Oyun bitti ama mac surer -> kucuk kutu (mac bitince tam ekran MatchResult gosterilir)
    const multKey =
      gameEnd.mult === 3 ? 'mult.backgammon' : gameEnd.mult === 2 ? 'mult.gammon' : 'mult.normal'
    const title =
      gameEnd.timeout
        ? t('result.timeout', { name: pName(gameEnd.winner) })
        : gameEnd.resigned
          ? t('result.resign', { name: pName(gameEnd.winner) })
          : gameEnd.dropped
            ? t('result.cubeDrop', { name: pName(gameEnd.winner) })
            : t('result.won', { name: pName(gameEnd.winner), type: t(multKey) })
    centerMain = (
      <div className="result-box">
        <div className="result-title">{title}</div>
        <div className="result-points">{t('result.points', { n: gameEnd.points })}</div>
        {prValue != null && (
          <div className="result-pr">
            {t('pr.your')}: <b>PR {prValue.toFixed(1)}</b> · {t(prBandKey)}
          </div>
        )}
        <div className="result-actions">
          {matchOver && (
            <Button variant="default" onClick={() => handleNewMatch()}>
              {t('btn.newMatch')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => (online ? handleLeaveRoom() : setHome(true))}
          >
            <Icon name="home" /> {t('home.title')}
          </Button>
        </div>
      </div>
    )
  } else if (humanRespond) {
    centerMain = (
      <div className="result-box cube-respond">
        <div className="cube-respond-badge" aria-hidden>
          <Icon name="alert" size={20} /> ×{match.cube.value * 2}
        </div>
        <div className="result-title">
          {t('msg.doubled', { name: pName(cubePending!), value: match.cube.value * 2 })}
        </div>
        {learnMode && cubeHint?.kind === 'respond' && (
          <div className={`cube-advice ${cubeHint.take === 'take' ? 'ok' : 'warn'}`}>
            <Icon name="bulb" size={14} />
            {t(cubeHint.take === 'take' ? 'cube.advTake' : 'cube.advDrop')} ·{' '}
            {t('cube.win')} {cubeHint.winPct.toFixed(0)}%
          </div>
        )}
        <div className="cube-actions">
          <Button variant="default" onClick={handleTake}>
            {t('btn.take')}
          </Button>
          <Button variant="default" onClick={handleDrop}>
            {t('btn.drop')}
          </Button>
        </div>
      </div>
    )
  } else if (cubeWaiting) {
    centerMain = (
      <div className="result-box">
        <div className="result-title">
          {t('msg.doubled', { name: pName(cubePending!), value: match.cube.value * 2 })}
        </div>
        <div className="err-detail">{t('cube.waiting')}</div>
      </div>
    )
  } else if (noMove) {
    centerMain = (
      <div className="result-box no-moves">
        <div className="board-dice nm-dice">
          {diceFaces.map((f, i) => (
            <Die key={i} value={f.value} owner={turnStart.turn} used={f.used} />
          ))}
        </div>
        <div className="result-title">{t('overlay.noMoves')}</div>
        <div className="err-detail">{t('overlay.noMovesSub')}</div>
      </div>
    )
  }

  // Ana slot (sirasi gelenin): Onayla / Roll / zarlar. botThinking iken (bot maçı, insan Onayla/
  // Kabul dedi) ana buton ANINDA kaybolur ve HİÇBİR ŞEY yazılmaz — bot henüz zar atmadı, "düşünüyor"
  // yanıltıcı olur. Kullanıcı 1-2sn sessizce bekler, sonra botun zarı/hamlesi gelir (applyBotTurns).
  const primary = centerMain || botThinking ? null : turnComplete ? (
    <Button variant="default" onClick={handleConfirm} disabled={moveSending}>
      {moveSending ? t('btn.sending') : t('btn.confirm')}
    </Button>
  ) : showRoll && !autoRollPending ? (
    rollSending ? (
      // Zar sunucudan gelene kadar "Atılıyor…" (spinner). ESKİDEN rastgele yüzlü tumbling zar
      // gösteriliyordu -> "settled sayı" gibi görünüp GERÇEK (otoriter) zar gelince "zar değişti"
      // illüzyonu veriyordu (kullanıcı: "6-4 geldi sonra 4-1'e döndü"). Artık yanıltıcı rastgele sayı
      // YOK; gerçek zar sunucudan gelince DiceRow die-roll-in girişiyle gösterilir.
      <Button variant="default" disabled>
        <span className="btn-spinner" aria-hidden="true" /> {t('btn.rolling')}
      </Button>
    ) : (
      <Button variant="default" onClick={doRoll}>
        {t('btn.roll')}
      </Button>
    )
  ) : diceRolled && diceFaces.length > 0 ? (
    <DiceRow
      faces={diceFaces}
      owner={turnStart.turn}
      swappable={canSwapDice}
      onSwap={handleSwapDice}
    />
  ) : null

  // Yan slot: Double / Geri
  const secondary =
    centerMain || !interactive || botThinking
      ? null
      : humanCanDouble
        ? (
            <Button variant="default" onClick={() => handleDouble(turnStart.turn)}>
              {t('btn.double')}
            </Button>
          )
        : diceRolled && played.length > 0
          ? (
              <Button variant="default" onClick={handleUndo}>
                {t('btn.undo')}
              </Button>
            )
          : null

  // KESIN KURALLAR (her modda; tahta cevrili ya da "sola topla" aynali olsa da DEGISMEZ):
  //  1) BENIM zarim + ana butonum (Oyna/Onayla/Zar At) DAIMA SAGDA
  //  2) RAKIBIN zari DAIMA SOLDA
  // Kendi rengim tahtada hep ALTTA durur (online'da flipBoard bunu saglar; pvb'de insan
  // beyaz), dolayisiyla "alttaki oyuncunun sirasi mi" = "sira bende mi".
  // Yan slot (Katla / Geri Al) yalniz kendi turumda dolar -> rakip zariyla cakismaz.
  const turnIsMine = flipBoard ? turnStart.turn === 'black' : turnStart.turn === 'white'
  // RAKİP ZAR GÖSTERGESİ: rakibin attığı zar, tahtanın ORTASINDA normal zar gibi (rakip hep SOLDA).
  // Rakip turunda `primary` zaten canlı zarı (turnStart.dice) çizer. Rakip oynayıp sıra bana geçince
  // poll ara durumu ("attı ama oynamadı") kaçırsa bile oppRoll echo'su (lastMove'dan) kısa süre sol
  // merkezde durur -> "sıra rakipteyken attığı zarı göremedim" olmaz. Yalnız KENDİ turumda fallback
  // (rakip turunda oppRoll ÖNCEKİ eli taşıyabilir -> bayat; orada yalnız canlı `primary` gösterilir).
  const oppRollDice =
    online && oppRoll && !gameEnd && !matchOver ? (
      <DiceRow faces={oppRoll.dice.map((v) => ({ value: v, used: false }))} owner={opponent(myColor)} />
    ) : null
  const centerRight = turnIsMine ? primary : secondary
  // Rakip zar echo'su YALNIZ ben daha zar atmadan (sıram yeni geçti) solda durur; zarımı atınca
  // hemen kalkar -> kendi zarım (sağ) ile rakip echo'su (sol) AYNI ANDA görünmez (iki-zar karmaşası).
  const centerLeft = turnIsMine ? (secondary ?? (!diceRolled ? oppRollDice : null)) : primary

  const myName = profile?.nickname ?? t('player.you')
  const blackName = online
    ? myColor === 'black'
      ? myName
      : (room?.oppName ?? '…')
    : mode === 'pvb'
      ? t('player.bot')
      : t('player.black')
  const whiteName = online
    ? myColor === 'white'
      ? myName
      : (room?.oppName ?? '…')
    : mode === 'pvb'
      ? myName
      : t('player.white')
  // Kendi premium'um (const `premium` daha ASAGIDA tanimli -> burada yerel turet).
  const isMePremium = user?.plan_active === 'star'
  // YZ KARAKTERİ: bota karşı (yerel pvb VEYA online bot odası) + üst seviyelerde (11/12) botun
  // adı + avatar görseli persona'dan gelir (robot ikonu yerine gerçek karakter). Bot DAİMA
  // siyah/üst oyuncudur (insan bot maçlarında hep beyaz). Persona yoksa eski davranış (jenerik
  // ad + robot ikonu) korunur. Bkz. [[src/botPersonas.ts]].
  const botPersonaActive = botMatch && myColor !== 'black' ? botPersona(difficulty) : undefined
  const topInfo = {
    name: botPersonaActive ? botPersonaActive.name : blackName,
    avatar: '🐱',
    sub: botMatch
      ? `${t('solo.level', { n: difficulty })} · ${AI_LEVELS[difficulty - 1]}`
      : online
        ? myColor === 'black'
          ? t('player.you')
          : t('mp.title')
        : t('player.p2'),
    off: working.off.black,
    active: turnStart.turn === 'black' && !gameWon && !gameEnd,
    color: 'black' as const,
    score: match.score.black,
    target: match.target,
    rating: online ? (myColor === 'black' ? (user?.rating ?? null) : room?.oppRating ?? null) : null,
    avatarUrl: botPersonaActive
      ? botPersonaActive.avatar
      : online ? (myColor === 'black' ? profile.avatar : (room?.oppAvatar ?? null)) : null,
    frame: online ? (myColor === 'black' ? (user?.avatar_frame ?? null) : (room?.oppFrame ?? null)) : null,
    country: online ? (myColor === 'black' ? (profile.country || null) : (room?.oppCountry ?? null)) : null,
    // Bot ise (persona dahil) isBot=true -> avatar yoksa robot ikonu + seviye alt-satiri (Sidebar
    // seviye 'sub'unu yalniz isBot'ta cizer). Persona'da avatarUrl dolu -> gorsel gosterilir.
    isBot: botMatch, // bot ise robot ikonu + seviye alt-satırı
    premium: online ? (myColor === 'black' ? isMePremium : (room?.oppPremium ?? false)) : false,
    // Rakip (siyah/ust, ben beyazsam) avatarina tikla/hover -> herkese acik profil modali.
    onOpenProfile:
      online && myColor === 'white' && room?.oppId ? () => setHomeProfileId(room.oppId!) : undefined,
  }
  const bottomInfo = {
    name: whiteName,
    avatar: '🧑‍🚀',
    sub: online
      ? myColor === 'white'
        ? t('player.you')
        : t('mp.title')
      : mode === 'pvb'
        ? t('player.human')
        : t('player.p1'),
    off: working.off.white,
    active: turnStart.turn === 'white' && !gameWon && !gameEnd,
    color: 'white' as const,
    score: match.score.white,
    target: match.target,
    rating: online ? (myColor === 'white' ? (user?.rating ?? null) : room?.oppRating ?? null) : null,
    avatarUrl: online ? (myColor === 'white' ? profile.avatar : (room?.oppAvatar ?? null)) : profile.avatar,
    frame: online ? (myColor === 'white' ? (user?.avatar_frame ?? null) : (room?.oppFrame ?? null)) : (user?.avatar_frame ?? null),
    country: online ? (myColor === 'white' ? (profile.country || null) : (room?.oppCountry ?? null)) : (profile.country || null),
    // Anlik PR: yalniz bota karsi (pvb) + menuden acikken goster (online/pvp'de canli analiz gizli).
    // Anlık PR TAHMİNİ (oyun-içi, yalnız pvb + menüden açık): yerel estimate; Sidebar "~PR"
    // tahmin etiketiyle gösterir. RESMİ/kesin PR maç sonu gnubg (sonuç ekranı + analiz).
    // KLASIK TAVLA: anlık PR GÖSTERİLMEZ (kullanıcı isteği; klasik kasual mod).
    pr: botMatch && showLivePr && !match.classic ? prLiveEstimate(prHumanColor) : null,
    prEstimate: botMatch && showLivePr && !match.classic,
    premium: online ? (myColor === 'white' ? isMePremium : (room?.oppPremium ?? false)) : (mode === 'pvb' ? isMePremium : false),
    // Rakip (beyaz/alt, ben siyahsam) avatarina tikla/hover -> herkese acik profil modali.
    onOpenProfile:
      online && myColor === 'black' && room?.oppId ? () => setHomeProfileId(room.oppId!) : undefined,
  }

  // Sifre sifirlama ekrani (e-postadaki linkten gelince)
  if (resetInfo) {
    return (
      <ResetPassword
        email={resetInfo.email}
        token={resetInfo.token}
        onDone={() => {
          setResetInfo(null)
          try {
            window.history.replaceState(null, '', '/')
          } catch {
            /* yok */
          }
        }}
      />
    )
  }

  // Auth kontrolu bitene kadar bekle (uygulama aciliyor -> "Yukleniyor", analiz DEGIL)
  if (!authChecked) {
    return (
      <div className="register-overlay">
        <Loading size={80} />
      </div>
    )
  }

  // Ortak Auth handler'lari (giris/kayit modali + profil duzenleme sayfasi paylasir)
  const authProps = {
    onAuthed: (u: ServerUser, isNew?: boolean) => {
      const wasEditing = editProfile
      // Misafir (user==null) iken devam eden/biten HERHANGI bir oyun giris/kayit
      // sonrasi YENI hesaba YAZILMASIN. Eskiden yalniz matchWinner varsa engelleniyordu;
      // ama oyun uyelik aninda henuz bitmemisse (bot son hamleyi hemen sonra yapip kaybi
      // raporluyor) "uye oldum direkt maglubiyet" olusuyordu. Misafirden gecen tum bekleyen
      // maci blokla. (loadServerGame local guest oyununu zaten sifirlar; uyelik sonrasi
      // BASLATILAN gercek mac flag'i satir ~1158'de tekrar acar.) Profil duzenlemede
      // (user zaten dolu) DOKUNMA -> devam eden mesru mac raporlanabilsin.
      if (!user) ratingReportedRef.current = true
      setUser(u)
      setGuestProfile(null)
      setShowAuth(false)
      // Yeni Google kullanicisi: takma ismini kendi secsin (profil ekrani acilir)
      if (isNew) {
        setEditProfile(true)
        return
      }
      // Profil duzenlemeden kaydedince ANA SAYFAYA DONME: sayfada kal (Auth "Kaydedildi"
      // gosterir). Sadece giris/kayit akisinda (wasEditing=false) kapat + oyunu yukle.
      if (!wasEditing) {
        setEditProfile(false)
        loadServerGame()
          .then((g) => {
            if (g) applySavedGame(g as SavedGame)
          })
          .catch(() => {})
      }
    },
    onGuest: (p: Profile) => {
      saveProfile(p)
      setGuestProfile(p)
      setUser(null)
      setEditProfile(false)
      setShowAuth(false)
    },
    onCancel: () => {
      setEditProfile(false)
      setShowAuth(false)
    },
    onDeleteAccount: () => {
      apiDeleteAccount().finally(() => {
        setUser(null)
        setGuestProfile(null)
        setEditProfile(false)
        setShowAuth(false)
        setHome(true)
      })
    },
  }
  // Uyelik karti (ProfileOverview, baslik alti): "Uyeligi Yenile" -> odeme modali;
  // "Yenilemeyi iptal/ac" -> auto_renew degistir + kullaniciyi tazele.
  const handleRenew = () => setMemOpen(true)
  const handleToggleAutoRenew = async (enabled: boolean) => {
    try {
      const r = await apiSetAutoRenew(enabled)
      setUser(r.user)
    } catch {
      /* sessiz: profil kartinda kritik degil */
    }
  }
  // Giris/kayit: SAYFA gorunumu (modal degil) — sol menu gorunur kalir, form
  // menunun sagindaki alanda ortalanmis kart olarak acilir. Cikis: Vazgec / Misafir.
  const authModal = showAuth ? (
    <Auth key="auth" page initialForgot={authForgot} onForgotChange={setAuthForgot} {...authProps} />
  ) : null
  // Ucretli plan aktif mi (premium ozellik kilidi)
  const premium = user?.plan_active === 'star'

  // Tahta tema listesi: nadirlik bazli COIN fiyati + sahiplik (unlocks). Ucretsiz: standart/tavla/galaxy + kulup.
  const boardUnlocks = user?.unlocks ?? []
  const boardOwned = (id: string) => FREE_BOARDS.has(id) || boardUnlocks.includes('theme.' + id)
  // Admin "Tavla Tasarımı": grup (rarity) override'ı + özel tahtalar; satıştan kaldırılan tahta
  // yalnız sahibine görünür. boardDesignsRev: sunucu ayarı gelince liste yeniden kurulur.
  void boardDesignsRev
  const boardThemeList = [
    ...BOARD_THEMES, ...PREMIUM_THEMES, ...RARITY_THEMES, ...GALAXY_EXTRA_THEMES,
    ...CLUB_THEMES, ...COUNTRY_THEMES, ...TAVLATV_THEMES, ...CUSTOM_THEMES,
  ]
    .map((tt) => ({
      ...tt,
      rarity: boardRarityOf(tt),
      price: boardPrice(tt),
      owned: boardOwned(tt.id),
    }))
    .filter((tt) => tt.owned || boardOnSale(tt))

  // Profilim "Istatistiklerim" sekmesine gomulu detayli istatistik sayfasi
  // Sahip olunan tahtalar (kilitli olmayanlar) + cerceveler (unlocks) — Profil genel bakisi
  const ownedBoards = boardThemeList.filter((b) => b.owned)
  const ownedFrames = AVATAR_FRAMES.filter((f) => (user?.unlocks ?? []).includes('frame.' + f.id))

  // Bildirim sil (Profilim > Bildirimler): tek (id) veya toplu (id yok). Optimistik.
  function handleDeleteNotification(id: number) {
    setNotifications((ns) => ns.filter((n) => n.id !== id))
    deleteNotifications([id]).catch(() => {})
  }
  function handleDeleteAllNotifications() {
    setNotifications([])
    setUnreadNotif(0)
    deleteNotifications().catch(() => {})
  }
  // Bildirimdeki "Kabul Et" (arkadaslik istegi): istegi gonderenle (actorId) arkadas ol, ardindan
  // bildirimi kutudan kaldir (isini yapti) + toast. Idempotent: zaten kabul edilmisse accept no-op.
  async function handleAcceptFriendNotif(actorId: number, notifId: number) {
    try {
      await acceptFriend(actorId)
      notify.success(t('friends.added'))
    } catch {
      notify.error(t('online.friendFail'))
      return
    }
    setNotifications((ns) => ns.filter((n) => n.id !== notifId))
    deleteNotifications([notifId]).catch(() => {})
  }

  // Profil sayfasi: girisliyse once GENEL BAKIS; "Profili Duzenle" -> form. Misafir -> direkt form.
  const editProfilePage = editProfile ? (
    user && !profileEditMode ? (
      <ProfileOverview
        user={user}
        avatar={profile.avatar ?? null}
        boardTheme={boardTheme}
        ownedBoards={ownedBoards}
        ownedFrames={ownedFrames}
        onEdit={() => setProfileEditMode(true)}
        onLogout={handleLogout}
        onSelectBoard={setBoardTheme}
        onSelectFrame={handleEquipFrame}
        onClose={() => setEditProfile(false)}
        onRenew={handleRenew}
        onToggleAutoRenew={handleToggleAutoRenew}
        emailUnverified={!!user && !user.email_verified_at}
        resendState={resendState}
        onResendVerification={handleResendVerification}
        onUserUpdate={(u) => setUser(u)}
        onOpenMatchHistory={(matchId) => {
          setMatchHistInitialId(matchId ?? null)
          setEditProfile(false)
          setMatchHistOpen(true)
        }}
        onOpenAchievements={() => {
          setEditProfile(false)
          goPage(() => setAchOpen(true))
        }}
        onOpenShop={() => {
          // (legacy; ProfileOverview'de kullanilmiyor) -> Magaza coin sayfasi
          setEditProfile(false)
          goPage(() => {
            setShopTab('coin')
            setShopOpen(true)
          })
        }}
        onOpenOrders={() => {
          setEditProfile(false)
          setMyOrdersOpen(true)
        }}
        allBoards={boardThemeList}
        coins={user.coins ?? 0}
        onBuyItem={handleBuy}
        framesSlot={
          <FrameShop
            coins={user.coins ?? 0}
            unlocks={user.unlocks ?? []}
            currentFrame={user.avatar_frame ?? null}
            avatar={profile.avatar ?? null}
            name={profile.nickname}
            onBuy={handleBuy}
            onEquip={handleEquipFrame}
          />
        }
        checkersSlot={
          <CheckerShop
            embedded
            unlocks={user.unlocks ?? []}
            selected={user.checker ?? null}
            coins={user.coins ?? 0}
            onBuy={async (fid) => {
              const r = await buyItem(fid)
              setUser((u) => (u ? { ...u, coins: r.coins, unlocks: r.unlocks } : u))
              return r
            }}
            onSelect={handleEquipChecker}
          />
        }
        tab={profileTab}
        onTabChange={setProfileTab}
      />
    ) : (
      <Auth
        key={user ? `edit-${user.id}` : 'edit-guest'}
        page
        editUser={user}
        editGuest={!user ? guestProfile : null}
        {...authProps}
        onCancel={() => (user ? setProfileEditMode(false) : setEditProfile(false))}
      />
    )
  ) : null

  // Sag ust hesap bari (lobi + oyun ekraninda ortak)
  // Oyun ekraninda mi (cekilme butonu bunun icin)
  const accountBar = (
    <div className="account-bar">
      {/* Sol: TavlaTV logosu (ana sayfaya doner). Sag: hesap kontrolleri. */}
      <button
        type="button"
        className="ab-brand"
        onClick={() => menuProps.onHome()}
        title={t('home.title')}
        aria-label={t('brand.name')}
      >
        {/* Genis ekranda wordmark + altinda slogan (tek satir, tam logo genisligi);
            mobilde kompakt sembol (yer acar). */}
        <span className="ab-logo-full">
          <span className="ab-brandlock">
            <TavlaTvLogo size={38} className="ab-wordmark" />
            {/* Surum etiketi: logonun bittigi yerin sag ustunde tema-renkli kucuk yazi. */}
            <span className="ab-beta" aria-hidden="true">{VERSION_LABEL}</span>
            {/* Slogan: duz HTML metin (SVG textLength=%100 hack'i Firefox'ta stretch/
                bozulma yapiyordu — fit-content ebeveyn icinde %100 min-width dairesel). */}
            <span className="ab-tag">{t('foot.tag')}</span>
          </span>
        </span>
        <span className="ab-logo-mark">
          <TavlaTvMark size={40} />
        </span>
      </button>
      {user ? (
        <>
        {/* DESKTOP (>=901px): eski satir ici bar (avatar+ad, coin, puan, odul, bildirim,
            Magaza, tema, dil). Mobilde gizli -> orada dropdown kullanilir. */}
        <div className="acct-desktop">
          <div className="account-id">
            <button
              type="button"
              className="account-name"
              onClick={() =>
                goPage(() => {
                  setProfileEditMode(false)
                  setProfileTab('stats')
                  setEditProfile(true)
                })
              }
              title={t('menu.editProfile')}
            >
              <AvatarFrame
                src={profile.avatar}
                frame={user?.avatar_frame}
                size={28}
                name={profile.nickname}
                className="account-avf"
              />
              {profile.nickname}
              {premium && <PremiumCrown style={{ marginLeft: 6 }} />}
            </button>
            {/* Oyuncu durumu (Müsait/Oyuna Hazır/Oyun Kabul Etmiyor/Çevrimdışı Görün) — avatarın yanında */}
            <StatusPicker value={myStatus} onChange={handleSetStatus} compact />
            <button
              type="button"
              className="stat-chip stat-chip-coin"
              onClick={() => goPage(() => setShopOpen(true))}
              title={t('shop.title')}
            >
              <span className="stat-chip-ic">
                {/* coins.svg (Tabler "coins") satir ici: stroke=currentColor -> .stat-chip-coin altin rengi */}
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 14c0 1.657 2.686 3 6 3s6 -1.343 6 -3s-2.686 -3 -6 -3s-6 1.343 -6 3z" />
                  <path d="M9 14v4c0 1.656 2.686 3 6 3s6 -1.344 6 -3v-4" />
                  <path d="M3 6c0 1.072 1.144 2.062 3 2.598s4.144 .536 6 0c1.856 -.536 3 -1.526 3 -2.598c0 -1.072 -1.144 -2.062 -3 -2.598s-4.144 -.536 -6 0c-1.856 .536 -3 1.526 -3 2.598z" />
                  <path d="M3 6v10c0 .888 .772 1.45 2 2" />
                  <path d="M3 11c0 .888 .772 1.45 2 2" />
                </svg>
              </span>
              <span className="stat-chip-body">
                <span className="stat-chip-val">{(user.coins ?? 0).toLocaleString('tr-TR')}</span>
                <span className="stat-chip-bar" aria-hidden="true">
                  <i style={{ width: `${((user.coins ?? 0) % 1000) / 10}%` }} />
                </span>
              </span>
            </button>
            {user.rating != null && (
              <span className="stat-chip stat-chip-rating">
                <span className="stat-chip-ic"><Icon name="star" size={18} /></span>
                <span className="stat-chip-body">
                  <span className="stat-chip-val">{user.rating.toLocaleString('tr-TR')}</span>
                  <span className="stat-chip-bar" aria-hidden="true">
                    <i style={{ width: `${user.rating % 100}%` }} />
                  </span>
                </span>
              </span>
            )}
          </div>
          {rewardReady ? (
            <Button
              variant="outline"
              className="btn-reward"
              onClick={(e) => {
                // Odulu alirken konfeti (buton merkezinden). currentTarget sync okunur.
                burstConfettiAt(e.currentTarget)
                handleCoinClick()
              }}
              title={t('reward.claim')}
            >
              <Icon name="gift" size={15} />
              <span className="rb-stack">
                <span className="rb-main">{rewardCoins}</span>
                <span className="rb-sub">{t('reward.bonus')}</span>
              </span>
            </Button>
          ) : (
            <span className="reward-count" title={t('reward.in')}>
              <Icon name="gift" size={14} />
              <span className="rb-stack">
                <span className="rb-main tnum">{fmtCountdown(rewardSecs)}</span>
                <span className="rb-sub">{t('reward.in')}</span>
              </span>
            </span>
          )}
          {/* Mağaza: sol menüden SAĞ ÜST bara taşındı, storefront ikonuyla (/magaza) */}
          <Button
            variant="ghost"
            size="icon"
            className="[&_svg]:size-[24px]!"
            onClick={() => goPage(() => setShopOpen(true))}
            title={t('shop.title')}
            aria-label={t('shop.title')}
          >
            <Icon name="shop" size={24} />
          </Button>
          {/* Şans Çarkı: bonusun yanında, üst barda spinner-ball ikonuyla */}
          <Button
            variant="ghost"
            size="icon"
            className="[&_svg]:size-[24px]!"
            onClick={() => goPage(() => setLuckyWheelOpen(true))}
            title={t('lw.menu')}
            aria-label={t('lw.menu')}
          >
            <Icon name="spinner-ball" size={24} />
          </Button>
          {/* Zar Slotu: Şans Çarkı'nın yanında, üst barda slot (kiraz) ikonuyla (sol menüden taşındı) */}
          <Button
            variant="ghost"
            size="icon"
            className="[&_svg]:size-[24px]!"
            onClick={() => goPage(() => setDiceSlotOpen(true))}
            title={t('ds.menu')}
            aria-label={t('ds.menu')}
          >
            <Icon name="slot" size={24} />
          </Button>
          {/* Mesajlar + Bildirimler tek ikonda: okunmamış mesaj + bildirim toplamı rozette */}
          <Button
            variant="ghost"
            size="icon"
            className="relative [&_svg]:size-[24px]!"
            onClick={() => goPage(() => { setMessagesFocusId(null); setMessagesOpen(true) })}
            title={t('dm.title')}
            aria-label={t('dm.title')}
          >
            <Icon name="chat" size={24} />
            {dmUnread + unreadNotif > 0 && (
              <span className="notif-badge">{dmUnread + unreadNotif > 9 ? '9+' : dmUnread + unreadNotif}</span>
            )}
          </Button>
          {/* Alışveriş sepeti: üst barda GİZLİ, sepete ürün eklenince görünür; tıklanınca sepet sayfası açılır */}
          {cartCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="relative [&_svg]:size-[24px]!"
              onClick={() => goPage(() => setCartOpen(true))}
              title={t('shop.cart')}
              aria-label={t('shop.cart')}
            >
              <Icon name="cart" size={24} />
              <span className="notif-badge">{cartCount > 9 ? '9+' : cartCount}</span>
            </Button>
          )}
          <span className="account-sep" />
          <Button
            variant="ghost"
            size="icon"
            className="[&_svg]:size-[24px]!"
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            aria-label={t('menu.theme')}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Icon name="sun" size={24} /> : <Icon name="moon" size={24} />}
          </Button>
          <LangMenu />
          <Button
            variant="ghost"
            size="icon"
            className="acct-logout-btn [&_svg]:size-[22px]!"
            title={t('auth.logout')}
            aria-label={t('auth.logout')}
            onClick={handleLogout}
          >
            <Icon name="logout" size={22} />
          </Button>
        </div>
        {/* MOBIL (<=900px): SADECE avatar + ad. Tiklayinca dropdown. Desktopta gizli. */}
        <div className="account-menu acct-mobile" ref={acctMenuRef}>
          <button
            type="button"
            className={`acct-trigger ${acctMenuOpen ? 'open' : ''}`}
            onClick={toggleAcctMenu}
            aria-expanded={acctMenuOpen}
            aria-haspopup="menu"
            title={profile.nickname}
          >
            {/* Ad SOLDA; avatar (menu) en sagda kosede. */}
            <span className="acct-trigger-name">{profile.nickname}</span>
            {premium && <PremiumCrown style={{ marginRight: 2 }} />}
            {rewardReady && <span className="acct-trigger-dot" aria-hidden="true" />}
            <Icon name="chevron" size={16} className="acct-chev" />
            <AvatarFrame
              src={profile.avatar}
              frame={user?.avatar_frame}
              size={28}
              name={profile.nickname}
              className="account-avf"
            />
          </button>
          {acctMenuOpen && (
            <div className="acct-pop" role="menu" style={{ position: 'fixed', top: acctMenuPos.top, right: acctMenuPos.right }}>
              {/* Oyuncu durumu (mobil): Müsait/Oyuna Hazır/Oyun Kabul Etmiyor/Çevrimdışı Görün */}
              <div className="acct-status">
                <StatusPicker value={myStatus} onChange={handleSetStatus} />
              </div>
              <div className="acct-div" />
              {/* Profilini Gor */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => {
                    setProfileEditMode(false)
                    setProfileTab('stats')
                    setEditProfile(true)
                  })
                }}
              >
                <Icon name="user" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('menu.viewProfile')}</span>
              </button>

              <div className="acct-div" />

              {/* Coin -> Magaza */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => setShopOpen(true))
                }}
              >
                <Icon name="coin" size={18} className="acct-row-ic acct-ic-coin" />
                <span className="acct-row-l">{t('home.dash.coins')}</span>
                <b className="acct-row-v">{(user.coins ?? 0).toLocaleString('tr-TR')}</b>
              </button>

              {/* Rating (bilgi) */}
              {user.rating != null && (
                <div className="acct-row acct-row-static">
                  <Icon name="star" size={18} className="acct-row-ic acct-ic-rating" />
                  <span className="acct-row-l">{t('lb.rating')}</span>
                  <b className="acct-row-v">{user.rating.toLocaleString('tr-TR')}</b>
                </div>
              )}

              {/* Gunluk odul */}
              <button
                type="button"
                className={`acct-row ${rewardReady ? 'acct-row-hot' : ''}`}
                role="menuitem"
                disabled={!rewardReady}
                onClick={() => {
                  setAcctMenuOpen(false)
                  handleCoinClick()
                }}
              >
                <Icon name="gift" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('home.dash.daily')}</span>
                <span className="acct-row-v">
                  {rewardReady ? t('home.dash.claim') : fmtCountdown(rewardSecs)}
                </span>
              </button>

              {/* Mesajlar (sag ust chat ikonunun mobil karsiligi) */}
              <button
                type="button"
                className="acct-row"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => { setMessagesFocusId(null); setMessagesOpen(true) })
                }}
              >
                <Icon name="chat" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('dm.title')}</span>
                {dmUnread + unreadNotif > 0 && (
                  <span className="acct-row-v">{dmUnread + unreadNotif > 9 ? '9+' : dmUnread + unreadNotif}</span>
                )}
              </button>

              {/* Magaza */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => setShopOpen(true))
                }}
              >
                <Icon name="shop" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('shop.title')}</span>
              </button>

              {/* Sepet (üst bardaki sepet düğmesinin mobil karşılığı) */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => setCartOpen(true))
                }}
              >
                <Icon name="cart" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('shop.cart')}</span>
                {cartCount > 0 && <span className="acct-row-v">{cartCount > 9 ? '9+' : cartCount}</span>}
              </button>

              <div className="acct-div" />

              {/* Tema */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('menu.theme')}</span>
                <span className="acct-row-v">
                  {theme === 'dark' ? t('theme.light') : t('theme.dark')}
                </span>
              </button>

              {/* Dil (satir ici bayraklar) */}
              <div className="acct-row acct-row-lang">
                <Icon name="globe" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('menu.language')}</span>
                <span className="acct-langs">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className={`acct-lang ${l.code === lang ? 'on' : ''}`}
                      onClick={() => setLang(l.code)}
                      title={l.label}
                      aria-label={l.label}
                    >
                      <Flag code={l.code} size={22} />
                    </button>
                  ))}
                </span>
              </div>

              {/* Cikis Yap — dropdown'un en altinda, ayrik (danger tonu) */}
              <button
                type="button"
                className="acct-row acct-row-logout"
                role="menuitem"
                onClick={() => {
                  setAcctMenuOpen(false)
                  handleLogout()
                }}
              >
                <Icon name="logout" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('auth.logout')}</span>
              </button>
            </div>
          )}
        </div>
        </>
      ) : (
        /* Misafir: Giris + tema + dil (dropdown yok) */
        <>
          <Button variant="default" className="ab-login" onClick={() => setShowAuth(true)}>
            {t('account.auth')}
          </Button>
          <span className="account-sep" />
          <Button
            variant="ghost"
            size="icon"
            className="[&_svg]:size-[24px]!"
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            aria-label={t('menu.theme')}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Icon name="sun" size={24} /> : <Icon name="moon" size={24} />}
          </Button>
          {/* Geri bildirim bayragi: mobilde sabit FAB gizlenir, ust barda dil bayraginin
              SOLUNDA cikar (masaustunde gorunmez -> FAB kalir). */}
          <Button
            variant="ghost"
            size="icon"
            className="ab-bug-flag [&_svg]:size-[24px]!"
            title={t('bug.button')}
            aria-label={t('bug.button')}
            onClick={() => window.dispatchEvent(new Event('tavla:open-bug-report'))}
          >
            <Icon name="flag" size={24} />
          </Button>
          <LangMenu />
        </>
      )}
    </div>
  )

  // Mobil hamburger + arka perde (drawer menu)
  const mobileNav = (
    <>
      <button
        className="hamburger"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t('common.menu')}
        aria-expanded={menuOpen}
      >
        <Icon name="menu" size={30} />
      </button>
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
      {/* "En Uste Git": mobileNav TAM OLARAK 4 lobi dalinda cizilir (oyun ekraninda YOK)
          -> buton da tam oralarda cikar. Kendi scroller'ini (.app.lobby) bulur. */}
      <ScrollTop />
    </>
  )

  // Yarim kalan (bitmemis) mac var mi -> menude "Aktif Oyunlar"
  const hasActiveGame = !matchOver && (turnsPlayed > 0 || !!gameEnd)
  hasActiveGameRef.current = hasActiveGame // popstate/URL navigasyonu guncel degeri okusun

  // Yerel (bota/2-kişi) "Devam eden maç" fantom veya bozuksa (ör. "Maça dön" boş sayfa açıyorsa),
  // kullanıcı bardaki × ile bu maçı ATABİLİR: kayıt silinir + taze match -> hasActiveGame false olur,
  // refresh'te de geri gelmez. (Terk edilen lokal oyun clearGame ile hiç temizlenmiyordu -> fantom.)
  const discardLocalGame = () => {
    clearGame()
    setGameEnd(null)
    setOpening(null)
    setOpeningResult(null)
    setPlayed([])
    setTurnsPlayed(0)
    setMatch(newMatch(match.target || 1))
    setHome(true)
  }

  // Online "Devam Eden Maç" banner'ini kullanici elle kapatabilsin (fantom/bitmis oda
  // hala gozukuyorsa). Once bar'dan cikar (aninda kaybolur), sonra sunucuya leave gonder:
  // oda gercekten bitmisse leave no-op'tur, hala 'playing' ise ABANDON ile kapanir.
  const dismissActiveRoom = (code: string) => {
    setActiveRooms((rs) => rs.filter((x) => x.code !== code))
    void leaveRoom(code).catch(() => {})
  }

  // Menuden acilan TUM sayfa overlaylerini kapat (setup HARIC). Ayni anda page-host
  // icinde birden fazla '.page' acik kalirsa yigilirlar (bkz Magaza+Ayarlar bug'i).
  function closeMenuPages() {
    // Tam-ekran overlay'ler: menu/logo navigasyonu bunlari da KAPATMALI yoksa ustte
    // kalip sayfayi kilitler (auth/uyelik). Bkz [[menu-sayfa-kayit]].
    setShowAuth(false)
    setAuthForgot(false)
    setMemOpen(false)
    setLeaderboardOpen(false)
    setRanksOpen(false)
    setInfoOpen(false)
    setAchOpen(false)
    setFriendSetupOpen(false)
    setOnlineTavlaOpen(false)
    setTavlaOynaOpen(false)
    setServicePage(null)
    setCustomInfoSlug(null)
    setGuideOpen(false)
    setGuideSlug(null)
    setTournRulesOpen(false)
    setFaqOpen(false)
    setTournOpen(false)
    setTournDetailId(null)
    setTournDetailSlug(null)
    setShopOpen(false)
    setLuckyWheelOpen(false)
    setDiceSlotOpen(false)
    setExcusesOpen(false)
    setKizOpen(false)
    setCheckerShopOpen(false)
    setCartOpen(false)
    setCheckoutOpen(false)
    setFrameGalleryOpen(false)
    setFriendsOpen(false)
    setMessagesOpen(false)
    setMessagesFocusId(null)
    setBlunderOpen(false)
    setMatchHistOpen(false)
    setMatchHistInitialId(null) // /mac-analizleri/<id> deep-link: bayat id menuden acmayi bozmasin
    setFrameAnimOpen(false)
    setGamePreviewOpen(false)
    setFairOpen(false)
    setLessonsOpen(false)
    setSoloOpen(false)
    setProductsOpen(false)
    setMyOrdersOpen(false)
    setBankData(null) // Havale/EFT talimat ekrani da yuzen overlay; navigasyonda kapansin (baska sayfaya sizmasin)
    setContentView(null)
    setNewsSlug(null)
    setQuizOpen(false)
    setClubsOpen(false)
    setRulesOpen(false)
    setAnalyzerOpen(false)
    setMatAnalyzerOpen(false)
    setEditProfile(false)
    setSpectate(null) // /izle URL sayfasi: menu/logo navigasyonu izlemeyi de kapatir
  }
  // Menuden acilan tum sayfalari kapat (ayni anda tek sayfa acik kalir) + kurulum ekrani
  function closeAllPages() {
    closeMenuPages()
    setSetup(null)
    setLegalSlug(null)
  }
  const goPage = (open: () => void) => {
    // Aktif oyundayken menu sayfalari (Magaza, Turnuvalar, Liderlik, Cerceve Galerisi
    // vb.) ACILMAZ; oyunu bolmesin. Oyun menusunun Ana Menu/Pes Et'i goPage kullanmaz.
    if (!home && !setup && hasActiveGame) return
    closeAllPages()
    // LOBI baglamina gec: sayfa home dalinda (sol menu + logo ile) acilsin. Aksi halde
    // bayat mode==='online'/bitmis oyun kaldiysa sayfa game-view'da (sidebar'siz, yuzen
    // hamburger ile) aciliyordu. Aktif oyun yoksa online oda/state'i de temizle.
    if (!hasActiveGame) {
      setMode('pvb')
      setRoom(null)
    }
    setHome(true)
    open()
  }

  // Ortak menu callback'leri (ana sayfa + oyun ekrani ayni menu)
  const menuProps = {
    loggedIn: !!user,
    hasActiveGame,
    onNewGame: () => {
      closeAllPages()
      // Mac Oyunu her zaman online (gercek rakip) -> misafir oynayamaz, üyelik iste.
      if (!user) { requireLogin(); return }
      setClassicSetup(false)
      setSetup('online')
    },
    onSolo: () => (!user ? requireLogin() : goPage(() => setSoloOpen(true))),
    onAiGame: () => {
      closeAllPages()
      setClassicSetup(false)
      setSetup('pvb')
    }, // Yapay zekaya karsi oyna (bot)
    // KLASIK TAVLA — Arkadaşınla Oyna: klasik davet/oda (küp yok + mars=2). FriendGameSetup klasik ON.
    onKlassikFriend: () => {
      closeAllPages()
      setInviteTarget(null)
      setFriendClassic(true)
      setFriendSetupOpen(true)
    },
    // KLASIK TAVLA — Yapay Zeka ile Oyna: klasik bot maçı (küp yok + mars=2). MatchSetup pvb + classic.
    onKlassikAi: () => {
      closeAllPages()
      setClassicSetup(true)
      setSetup('pvb')
    },
    // Arkadasinla Oyna: once "Ozel Oyun Olustur" ekrani (Tek oyun/Maç + Saat + Uzunluk),
    // onaylayinca davet-kodlu oda olusturulur. Matchmaking'e (rastgele rakip) sokMAZ.
    onPlayFriend: () => {
      closeAllPages()
      setInviteTarget(null) // menuden acilis = normal mod (davet degil)
      setFriendClassic(false) // Modern arkadas maci (klasik degil)
      setFriendSetupOpen(true)
    },
    onResume: () => {
      closeAllPages() // acik menu sayfasi (turnuvalar vb.) kalmasin, oyuna don
      setHome(false)
    },
    onHome: () => {
      closeAllPages()
      if (online) handleLeaveRoom()
      else setHome(true)
    },
    onLeaderboard: () => goPage(() => setLeaderboardOpen(true)),
    onRanks: () => goPage(() => setRanksOpen(true)),
    onInfo: () => goPage(() => setInfoOpen(true)),
    onAchievements: () => goPage(() => setAchOpen(true)),
    // Online Turnuvalar HERKESE acik (misafir dahil gorur); katilim turnuva basina (premium_only).
    onTournaments: () =>
      goPage(() => {
        setTournDetailId(null) // menuden liste (varsa eski detay kapansin)
        setTournDetailSlug(null)
        setTournOpen(true)
      }),
    // Ana sayfa reklamindan: dogrudan ilgili turnuvanin detayini ac (slug detay yuklenince yukselir)
    onTournamentAd: (id: number) =>
      goPage(() => {
        setTournDetailId(id)
        setTournDetailSlug(String(id))
        setTournOpen(true)
      }),
    onShop: () => goPage(() => setShopOpen(true)),
    onLuckyWheel: () => goPage(() => setLuckyWheelOpen(true)),
    onDiceSlot: () => goPage(() => setDiceSlotOpen(true)),
    onExcuses: () => goPage(() => setExcusesOpen(true)),
    onKiz: () => goPage(() => setKizOpen(true)),
    onCheckers: () => goPage(() => setCheckerShopOpen(true)),
    // Zaten premium isem menude "Uyelik" gosterme (undefined -> SideMenu gizler);
    // uyelik bilgisi profil sayfasinda gosterilir. Free/misafir icin upsell ekrani acilir.
    onMembership: premium ? undefined : () => setMemOpen(true),
    onMyStats: () =>
      user
        ? goPage(() => {
            setProfileEditMode(false) // profil ANA sayfasi (İstatistikler varsayilan)
            setProfileTab('stats')
            setEditProfile(true)
          })
        : setShowAuth(true),
    onFriends: () => goPage(() => setFriendsOpen(true)),
    onMessages: () => goPage(() => { setMessagesFocusId(null); setMessagesOpen(true) }),
    // Premium araclar: uye/premium OLMAYAN da menude GORUR; tiklayinca uyelik ekrani acilir.
    onAnalyzer: () => (premium ? goPage(() => setAnalyzerOpen(true)) : setMemOpen(true)),
    onMatAnalyzer: () => (premium ? goPage(() => setMatAnalyzerOpen(true)) : setMemOpen(true)),
    onBlunders: () => (premium ? goPage(() => setBlunderOpen(true)) : setMemOpen(true)),
    onMatchHistory: () => (premium ? goPage(() => setMatchHistOpen(true)) : setMemOpen(true)),
    onLessons: () => goPage(() => setLessonsOpen(true)),
    onFairness: () => goPage(() => setFairOpen(true)),
    onCalendar: () => goPage(() => setContentView('event')),
    onClubs: () => goPage(() => setContentView('club')), // Tavla Kulupleri = il bazinda rehber (seeder)

    onServices: () => openInfoTab('services'), // Hizmetler = Bilgi › Hizmetler sekmesi
    onBlog: () => goPage(() => setContentView('blog')),
    onNews: () => goPage(() => setContentView('news')),
    // Belirli bir haberin detayini ac (/haberler/<slug>): liste yerine dogrudan detay.
    onOpenNews: (slug: string) => goPage(() => { setContentView('news'); setNewsSlug(slug) }),
    onMakale: () => goPage(() => setContentView('makale')), // Makaleler (haber düzeninde liste+detay)
    onMagazine: () => goPage(() => setContentView('magazine')),
    onProducts: () => goPage(() => setProductsOpen(true)),
    onMyOrders: () => (user ? goPage(() => setMyOrdersOpen(true)) : setShowAuth(true)),
    onQuiz: () => goPage(() => setQuizOpen(true)),
  }

  // Sol menu ogeleri MERKEZI SAYFA KAYDINDAN (pages.ts) turetilir. Handler'lar menuProps'tan
  // eslenir; gorunurluk: inMenu + handler tanimli mi ( or. premium'da onMembership undefined)
  // + gate ('user' -> giris). hideInGame filtresini SideMenu kendi inGame'ine gore uygular.
  // "Bilgi" alt sayfasini ilgili sekmede acar (menu + footer ortak).
  const openInfoTab = (tab: InfoTab) => {
    setInfoTab(tab)
    goPage(() => setInfoOpen(true))
  }
  const pageHandlers: Record<string, (() => void) | undefined> = {
    solo: menuProps.onSolo,
    match: menuProps.onNewGame,
    aiGame: menuProps.onAiGame,
    playFriend: menuProps.onPlayFriend,
    klassikFriend: menuProps.onKlassikFriend,
    klassikAi: menuProps.onKlassikAi,
    tournaments: menuProps.onTournaments,
    leaderboard: menuProps.onLeaderboard,
    luckywheel: menuProps.onLuckyWheel,
    diceslot: menuProps.onDiceSlot,
    excuses: menuProps.onExcuses,
    kiz: menuProps.onKiz,
    checkers: menuProps.onCheckers,
    shop: menuProps.onShop,
    friends: menuProps.onFriends,
    messages: menuProps.onMessages,
    membership: menuProps.onMembership,
    calendar: menuProps.onCalendar,
    clubs: menuProps.onClubs,
    makale: menuProps.onMakale,
    news: menuProps.onNews,
    magazine: menuProps.onMagazine,
    products: menuProps.onProducts,
    myOrders: menuProps.onMyOrders,
    analyzer: menuProps.onAnalyzer,
    matAnalyzer: menuProps.onMatAnalyzer,
    blunders: menuProps.onBlunders,
    matchHistory: menuProps.onMatchHistory,
    info: menuProps.onInfo,
    // "Bilgi" basligi altindaki tek tek sayfalar (Info'yu ilgili sekmede acar)
    'info-about': () => openInfoTab('about'),
    'info-services': () => openInfoTab('services'),
    'info-glossary': () => openInfoTab('glossary'),
    'info-ranks': () => openInfoTab('ranks'),
    'info-scoring': () => openInfoTab('scoring'),
    'info-badges': () => openInfoTab('badges'),
    'info-fair': () => openInfoTab('fair'),
  }
  // Admin panelden (menu_items) override'lar: ozel ad (o dilde), gorunurluk, sira.
  const menuLabel = (key: string): string | undefined => menuOverrides[key]?.labels?.[lang]
  // Admin "Sayfa Metni" baslik override'i (menu etiketinden AYRI). Bos -> component i18n varsayilani.
  const menuTitle = (key: string): string | undefined => menuOverrides[key]?.title?.[lang]
  const menuVisible = (key: string): boolean => menuOverrides[key]?.visible !== false
  const menuSort = (key: string, fallback: number): number => menuOverrides[key]?.sort ?? fallback

  // Özel (admin-eklemeli) menü öğesi tıklaması: dış link (http) yeni sekmede; iç rota (/…)
  // SPA navigasyonu (pushState + popstate -> applyFromPath açar, closeAllPages orada yapılır).
  const openCustomMenuHref = (href: string) => {
    if (/^https?:\/\//i.test(href)) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    try {
      const path = href.startsWith('/') ? href : '/' + href
      window.history.pushState(null, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      window.location.href = href
    }
  }

  // Footer kolonlari — merkezi kayittan (pages.ts). Handler/gate menu ile ayni mantik.
  const footerColumns = [
    { key: 'game', titleKey: 'foot.game', keys: ['solo', 'match', 'aiGame', 'playFriend'] },
    { key: 'community', titleKey: 'foot.community', keys: ['tournaments', 'leaderboard', 'friends', 'calendar', 'clubs'] },
    { key: 'content', titleKey: 'foot.content', keys: ['news', 'magazine'] },
  ].map((col) => ({
    key: col.key,
    titleKey: col.titleKey,
    items: col.keys
      .map((k) => PAGE_BY_KEY[k])
      .filter((pg) => pg && !!pageHandlers[pg.key] && (pg.gate !== 'user' || !!user) && menuVisible(pg.key))
      .map((pg): FooterItem => ({
        key: pg.key,
        labelKey: pg.labelKey,
        label: menuLabel(pg.key),
        onClick: pageHandlers[pg.key]!,
      })),
  }))
  // SEO Rehber kolonu: içerik/landing sayfalarına iç link (tarama + keşif). goPage ile lobi
  // bağlamında açılır (info/legal kolonlarıyla aynı desen). Bkz [[seo-online-tavla-tavla-oyna-landing]].
  const openGuide = (slug: string | null) => goPage(() => { setGuideOpen(true); setGuideSlug(slug) })
  footerColumns.push({
    key: 'guide',
    titleKey: 'foot.guide',
    items: [
      { key: 'seo-online-tavla', labelKey: '', label: 'Online Tavla Oyna', onClick: () => goPage(() => setOnlineTavlaOpen(true)) },
      { key: 'seo-tavla-oyna', labelKey: '', label: 'Tavla Oyna', onClick: () => goPage(() => setTavlaOynaOpen(true)) },
      { key: 'seo-nasil-oynanir', labelKey: '', label: 'Nasıl Oynanır', onClick: () => goPage(() => setRulesOpen(true)) },
      { key: 'seo-tavla-rehberi', labelKey: '', label: 'Tavla Rehberi', onClick: () => openGuide(null) },
      { key: 'seo-turnuva-kurallari', labelKey: '', label: 'Turnuva Kuralları', onClick: () => goPage(() => setTournRulesOpen(true)) },
      { key: 'seo-sikca-sorulan', labelKey: '', label: 'Sıkça Sorulan Sorular', onClick: () => goPage(() => setFaqOpen(true)) },
    ],
  })
  // Organizasyon kolonu: turnuva organizasyonu SEO servis sayfalari + İletişim. Hepsi
  // ServiceLanding ile page-host'ta acilir (goPage lobi baglamina doner). Bilgi Sayfaları'ndan
  // (InfoPage SEO_SLUGS) icerik yonetilir. Bkz [[seo-online-tavla-tavla-oyna-landing]].
  const openService = (slug: string) => goPage(() => setServicePage(slug))
  footerColumns.push({
    key: 'organization',
    titleKey: 'foot.organization',
    items: [
      { key: 'org-hub', labelKey: '', label: 'Tavla Turnuvası Organizasyonu', onClick: () => openService('tavla-turnuvasi-organizasyonu') },
      { key: 'org-kurumsal', labelKey: '', label: 'Kurumsal Tavla Turnuvası', onClick: () => openService('kurumsal-tavla-turnuvasi') },
      { key: 'org-belediye', labelKey: '', label: 'Belediye Tavla Turnuvası', onClick: () => openService('belediye-tavla-turnuvasi') },
      { key: 'org-avm', labelKey: '', label: 'AVM Tavla Turnuvası', onClick: () => openService('avm-tavla-turnuvasi') },
    ],
  })
  // 4. kolon: "Bilgi" sayfasinin sekmeleri -> Info'yu ilgili sekmede acar (openInfoTab yukarida).
  // İletişim de bu grupta (ServiceLanding /iletisim; openService yukarida tanimli).
  footerColumns.push({
    key: 'info',
    titleKey: 'menu.info',
    items: [
      { key: 'info-about', labelKey: 'info.tab.about', onClick: () => openInfoTab('about') },
      { key: 'info-services', labelKey: 'menu.services', onClick: () => openInfoTab('services') },
      { key: 'info-glossary', labelKey: 'info.tab.glossary', onClick: () => openInfoTab('glossary') },
      { key: 'info-ranks', labelKey: 'menu.ranks', onClick: () => openInfoTab('ranks') },
      { key: 'info-scoring', labelKey: 'info.tab.scoring', onClick: () => openInfoTab('scoring') },
      { key: 'info-badges', labelKey: 'ach.title', onClick: () => openInfoTab('badges') },
      { key: 'info-fair', labelKey: 'fair.title', onClick: () => openInfoTab('fair') },
      { key: 'org-iletisim', labelKey: '', label: 'İletişim', onClick: () => openService('iletisim') },
    ],
  })
  // 5. kolon: "Yasal" — hukuki sayfalar (DB'den) + Cerez Tercihleri (banner/modal).
  const openLegalPage = (slug: string) => goPage(() => setLegalSlug(slug))
  footerColumns.push({
    key: 'legal',
    titleKey: 'foot.legal',
    items: [
      { key: 'legal-kvkk', labelKey: '', label: 'KVKK Aydınlatma Metni', onClick: () => openLegalPage('kvkk') },
      { key: 'legal-gizlilik', labelKey: '', label: 'Gizlilik Politikası', onClick: () => openLegalPage('gizlilik-politikasi') },
      { key: 'legal-cerez', labelKey: '', label: 'Çerez Politikası', onClick: () => openLegalPage('cerez-politikasi') },
      { key: 'legal-kullanim', labelKey: '', label: 'Kullanım Koşulları', onClick: () => openLegalPage('kullanim-kosullari') },
      { key: 'legal-uyelik', labelKey: '', label: 'Üyelik Sözleşmesi', onClick: () => openLegalPage('uyelik-sozlesmesi') },
      { key: 'legal-cerez-tercih', labelKey: '', label: 'Çerez Tercihleri', onClick: () => window.dispatchEvent(new Event(OPEN_COOKIE_PREFS)) },
    ],
  })
  // Admin-eklemeli ozel sayfalari ilgili footer kolonuna, "Sıra" (sort) alanina gore KONUMLA
  // (0 = en ust; buyuk sayi = asagi). Artan sort ile sirayla splice et -> admin footer icinde
  // yerlestirebilir. Tiklama = /bilgi/<slug> SPA nav (openCustomMenuHref -> applyFromPath).
  for (const col of footerColumns) {
    const extra = cmsPages.filter((p) => p.section === 'footer:' + col.key)
    for (const p of extra.sort((a, b) => a.sort - b.sort)) {
      const at = Math.max(0, Math.min(p.sort, col.items.length))
      col.items.splice(at, 0, {
        key: 'cms-' + p.slug,
        labelKey: '',
        label: p.title,
        onClick: () => openCustomMenuHref('/bilgi/' + p.slug),
      })
    }
  }
  // Admin "Footer Kolonları" yapilandirmasi: SIRA + GORUNURLUK + BASLIK override uygula. Config
  // bossa (uc yok/hata) sabit varsayilan sira kullanilir. labels[lang] bossa Footer i18n titleKey'e
  // duser. items bos kolon Footer icinde zaten gizlenir. (key -> footerCfg eslesmesi.)
  const footerColsFinal = Object.keys(footerCfg).length
    ? footerColumns
        .filter((c) => footerCfg[c.key]?.visible !== false)
        .map((c) => ({ ...c, title: footerCfg[c.key]?.labels?.[lang], _s: footerCfg[c.key]?.sort ?? 999 }))
        .sort((a, b) => a._s - b._s)
    : footerColumns
  // Footer öğe sıralaması/görünürlüğü/başlığı + KOLONLAR ARASI taşıma (admin "Footer Bağlantıları").
  // Her öğeyi config'teki kolona (cfg.column) + sıraya (cfg.sort) göre yeniden dağıt: admin bir
  // linki başka kolona taşıyabilir. cfg yoksa (CMS cms-* / yeni öğe) öğe kendi kod-kolonunda
  // mevcut konumunda (idx) kalır. Görünürlüğü kapalı öğe atlanır; başlık override uygulanır.
  const footerBucket: Record<string, { it: FooterItem; s: number }[]> = {}
  footerColsFinal.forEach((col) => {
    col.items.forEach((it, idx) => {
      const cfg = footerLinkCfg[it.key]
      if (cfg?.visible === false) return
      const target = cfg?.column ?? col.key ?? ''
      const item = cfg?.labels?.[lang] ? { ...it, label: cfg.labels[lang] } : it
      const arr = footerBucket[target] ?? (footerBucket[target] = [])
      arr.push({ it: item, s: cfg?.sort ?? idx })
    })
  })
  const footerColsRendered = footerColsFinal.map((col) => ({
    ...col,
    items: (footerBucket[col.key ?? ''] ?? []).sort((a, b) => a.s - b.s).map((x) => x.it),
  }))

  // Sol menu: item SIRASI/GORUNURLUGU/ADI + GRUP admin panelinden yonetilir. Her item bir
  // gruba aittir (admin override menuOverrides.group, yoksa pages.ts group). Item'lar grup
  // icinde menu_items.sort ile; gruplar menuGroupCfg.sort (yoksa MENU_GROUP_ORDER) ile siralanir.
  // Override yoksa pages.ts + i18n varsayilanlarina duser (davranis degismez).
  const itemGroupKey = (pg: (typeof PAGES)[number]): string => menuOverrides[pg.key]?.group || pg.group
  const orderedPages = PAGES.map((pg, i) => ({ pg, i }))
    .filter(
      ({ pg }) =>
        pg.inMenu !== false &&
        !!pageHandlers[pg.key] &&
        (pg.gate !== 'user' || !!user) &&
        menuVisible(pg.key),
    )
    .sort((a, b) => menuSort(a.pg.key, a.i) - menuSort(b.pg.key, b.i))

  // Grup basligi: admin adi (dile gore) -> i18n varsayilani (bilinen grup) -> yok (null=basliksiz).
  const resolveGroupLabel = (gkey: string): string | null => {
    const cfg = menuGroupCfg[gkey]
    if (cfg) {
      if (!cfg.visible) return null
      const l = cfg.labels?.[lang] || cfg.labels?.tr
      if (l) return l
    }
    const dk = (MENU_GROUP_LABELS as Record<string, string | null>)[gkey]
    return dk ? t(dk) : null
  }
  const groupSort = (gkey: string): number => {
    const s = menuGroupCfg[gkey]?.sort
    if (typeof s === 'number') return s
    const i = MENU_GROUP_ORDER.indexOf(gkey as MenuGroup)
    return i >= 0 ? i : 999
  }

  // Item'lari gruplara topla (item sirasi korunur), sonra gruplari sirala + basligi cozumle.
  const bucket = new Map<string, NavItem[]>()
  const groupOrder: string[] = []
  // Katalog (pages.ts) + ÖZEL (admin-eklemeli) öğeleri ortak sort ile birleştir; grup içinde
  // sürükle-bırak sırası (sort) korunur. Özel öğeler pages.ts'te YOK -> menuOverrides'tan gelir.
  const navEntries: { group: string; sort: number; item: NavItem }[] = []
  for (const { pg, i } of orderedPages) {
    navEntries.push({
      group: itemGroupKey(pg),
      sort: menuSort(pg.key, i),
      item: {
        key: pg.key,
        labelKey: pg.labelKey,
        label: menuLabel(pg.key),
        icon: pg.icon,
        onClick: pageHandlers[pg.key]!,
        hideInGame: pg.hideInGame,
      },
    })
  }
  for (const o of Object.values(menuOverrides)) {
    if (!o.custom || !o.href || o.visible === false) continue
    // Özel öğe SPA rotasıysa (or. /kiz-tavlasi) pages.ts'teki ikonu kullan; harici/eşleşmeyen
    // href -> genel 'arrow-right'. (MenuOverride'da ikon alanı yok; slug'tan türetiyoruz.)
    const hrefSlug = o.href.replace(/^\/+/, '').split(/[?#]/)[0]
    const matchedPage = /^https?:\/\//i.test(o.href) ? undefined : PAGES.find((p) => p.slug === hrefSlug)
    navEntries.push({
      group: o.group || 'account',
      sort: o.sort ?? 999,
      item: {
        key: o.key,
        labelKey: '',
        label: o.labels?.[lang] || o.labels?.tr || o.href,
        // Admin ikon seçtiyse onu kullan; yoksa pages.ts'te sayfası olan bilinen slug'ın ikonu
        // (SSS -> soru işareti); eşleşen sayfa yoksa ve bilinen slug değilse genel 'arrow-right'.
        icon: (o.icon as IconName) || matchedPage?.icon || (hrefSlug === 'sikca-sorulan-sorular' ? 'question-mark' : 'arrow-right'),
        onClick: () => openCustomMenuHref(o.href!),
        hideInGame: true,
      },
    })
  }
  // Admin-eklemeli ozel sayfalari ilgili sol-menu grubuna ekle (section=menu:<grup>). "Sıra"
  // (sort) katalog ogeleriyle AYNI olcek (pages.ts index) -> admin grup icinde konumlar (0=en ust).
  for (const p of cmsPages) {
    if (!p.section.startsWith('menu:')) continue
    navEntries.push({
      group: p.section.slice(5),
      sort: p.sort,
      item: {
        key: 'cms-' + p.slug,
        labelKey: '',
        label: p.title,
        icon: 'book',
        onClick: () => openCustomMenuHref('/bilgi/' + p.slug),
        hideInGame: true,
      },
    })
  }
  navEntries.sort((a, b) => a.sort - b.sort)
  for (const e of navEntries) {
    // "Menüde göster" kapalıysa (grup visible=false) grubun BAŞLIĞI + ÖĞELERİ tamamen gizlenir.
    if (menuGroupCfg[e.group]?.visible === false) continue
    if (!bucket.has(e.group)) {
      bucket.set(e.group, [])
      groupOrder.push(e.group)
    }
    bucket.get(e.group)!.push(e.item)
  }
  const menuGroups: { group: string; label: string | null; defaultCollapsed: boolean; items: NavItem[] }[] = groupOrder
    .sort((a, b) => groupSort(a) - groupSort(b))
    .map((gkey, gi) => ({
      group: gkey,
      label: resolveGroupLabel(gkey),
      // Baslangic katlama durumu: admin (menuGroupCfg.collapsed) -> yoksa ilk 2 grup acik.
      defaultCollapsed: menuGroupCfg[gkey]?.collapsed ?? gi >= 2,
      items: bucket.get(gkey)!,
    }))
  // Admin katlama-varsayilanlarinin imzasi: DEGISIRSE SideMenu kullanici override'larini
  // sifirlar (admin otoritesi) -> "admin'de degistirdim ama tarayicim eski gosteriyor" tuzagi biter.
  const groupCollapseSig = Object.values(menuGroupCfg).length
    ? Object.values(menuGroupCfg)
        .map((g) => `${g.key}:${g.collapsed ? 1 : 0}`)
        .sort()
        .join(',')
    : ''

  // Gelen oyun davetleri (sabit, üst üste). Turnuva maçı banner'ı KALDIRILDI -> turnuva maçına
  // giriş otomatik (popup yok); manuel geri-dönüş yalnız sol menü "Aktif Maçlar".
  const inviteBanner = invites.length > 0 && (
    <div className="invite-stack">
      {invites.map((inv) => {
        // Davetli NEYE davet edildigini gorsun: oyun turu (Tek Oyun / Mac + puan) + sure.
        const isMatch = (inv.target ?? 1) > 1
        const typeLabel = isMatch
          ? `${t('friend.match')} · ${t('invite.points', { n: inv.target })}`
          : t('friend.single')
        const clockKey =
          inv.timeControl === 'casual'
            ? 'setup.clockCasual'
            : inv.timeControl === 'speed'
              ? 'setup.clockSpeed'
              : inv.timeControl === 'normal'
                ? 'setup.clockNormal'
                : null
        return (
          <div key={inv.id} className="invite-card game-invite">
            <div className="invite-head">
              <span className="invite-av" aria-hidden="true">
                {inv.avatar ? <img src={inv.avatar} alt="" /> : <Icon name="user" size={18} />}
              </span>
              <span className="invite-who">
                <span>
                  <b>{inv.from}</b> {t('friends.invitedYou')}
                </span>
                {/* Davet edenin gucu: rating sayisi + ana sayfadaki gibi isim altinda rutbe. */}
                {inv.rating != null && (
                  <span className="invite-rank">
                    <span className="invite-rating">{inv.rating}</span>
                    <DivisionChip rating={inv.rating} size="md" />
                  </span>
                )}
                {/* Bu macta davetlinin rating riski: kazanirsa +N / kaybederse -N (puansizsa gizli). */}
                {inv.ratingPreview && (
                  <span className="invite-stakes">
                    <span className="invite-stake-win">{t('invite.ratingWin', { n: inv.ratingPreview.win })}</span>
                    <span className="invite-stake-loss">{t('invite.ratingLoss', { n: Math.abs(inv.ratingPreview.loss) })}</span>
                  </span>
                )}
              </span>
            </div>
            <div className="invite-meta">
              <span className="invite-chip">
                <Icon name={isMatch ? 'target' : 'play'} size={14} /> {typeLabel}
              </span>
              {inv.classic && (
                <span className="invite-chip invite-chip-classic">
                  <Icon name="dice" size={14} /> {t('classic.badge')}
                </span>
              )}
              {clockKey && (
                <span className="invite-chip">
                  <Icon name="clock" size={14} /> {t(clockKey)}
                </span>
              )}
              {inv.unrated && (
                <span className="invite-chip">
                  <Icon name="info" size={14} /> {t('friend.unratedChip')}
                </span>
              )}
            </div>
            <div className="invite-btns">
              <Button variant="default" aria-label={t('friends.accept')} onClick={() => handleAcceptInvite(inv)}>
                <Icon name="check" size={16} /> {t('friends.accept')}
              </Button>
              <Button variant="destructive" aria-label={t('friends.decline')} onClick={() => handleDeclineInvite(inv)}>
                <Icon name="x" size={16} /> {t('friends.decline')}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )

  // Menuden acilan tum modaller (her iki ekranda ortak)
  // Menuden acilan sayfa acik mi (ana sayfada icerik alanina AKIS ICINDE gomulur)
  const anyPageOpen =
    leaderboardOpen ||
    ranksOpen ||
    infoOpen ||
    tournOpen ||
    shopOpen ||
    luckyWheelOpen ||
    diceSlotOpen ||
    excusesOpen ||
    kizOpen ||
    productsOpen ||
    myOrdersOpen ||
    cartOpen ||
    checkoutOpen ||
    !!bankData ||
    frameGalleryOpen ||
    friendsOpen ||
    messagesOpen ||
    blunderOpen ||
    matchHistOpen ||
    frameAnimOpen ||
    gamePreviewOpen ||
    fairOpen ||
    lessonsOpen ||
    soloOpen ||
    !!contentView ||
    quizOpen ||
    clubsOpen ||
    rulesOpen ||
    analyzerOpen ||
    matAnalyzerOpen ||
    achOpen ||
    friendSetupOpen ||
    editProfile ||
    !!servicePage || // turnuva organizasyonu servis sayfalari + /iletisim (page-host'ta acilir)
    faqOpen ||
    !!legalSlug || // hukuki sayfalar (KVKK/gizlilik/...) normal sayfa olarak page-host'ta acilir
    // Giris/Kayit (/giris) ve Sifremi Unuttum (/sifremi-unuttum): auth sayfasi da diger menu
    // sayfalari gibi page-host icinde acilsin -> ust hesap bari (header) gorunur kalir (aksi
    // halde standalone .register-overlay.page fixed overlay header'i orterdi).
    showAuth

  // Sidebar aktif-sayfa gostergesi: acik olan sayfanin menu anahtari (navy highlight)
  const activeKey = infoOpen
    ? 'info-' + infoTab // acik Bilgi sekmesine gore alt-oge vurgusu (info-about, info-fair...)
    : ranksOpen
    ? 'ranks'
    : leaderboardOpen
    ? 'leaderboard'
    : tournOpen
      ? 'tournaments'
      : shopOpen
        ? 'shop'
          : friendsOpen
            ? 'friends'
            : messagesOpen
              ? 'messages'
            : blunderOpen
              ? 'blunders'
              : matchHistOpen
                ? 'matchHistory'
                : fairOpen
                  ? 'fairness'
                  : soloOpen
                    ? 'solo'
                    : analyzerOpen
                      ? 'analyzer'
                      : matAnalyzerOpen
                        ? 'matAnalyzer'
                      : friendSetupOpen
                        ? (friendClassic ? 'klassikFriend' : 'playFriend')
                      : clubsOpen
                        ? 'clubs'
                        : lessonsOpen
                          ? 'lessons'
                          : memOpen
                            ? 'membership'
                            : contentView === 'event'
                              ? 'calendar'
                              : contentView === 'club'
                                ? 'clubs'
                                : contentView === 'service'
                                  ? 'services'
                                  : contentView === 'news'
                                    ? 'news'
                                    : contentView === 'magazine'
                                      ? 'magazine'
                                      : setup === 'online'
                                        ? 'match'
                                        : setup === 'pvb'
                                          ? (classicSetup ? 'klassikAi' : 'aiGame')
                                          : ''

  // Sayfa-tipi menu icerikleri (ana sayfada in-flow, oyun icinde overlay)
  const menuPages = (
    <>
      {achUnlocked.length > 0 && (
        <AchievementUnlock
          items={achUnlocked}
          onClose={() => setAchUnlocked([])}
          onView={() => {
            setAchUnlocked([])
            goPage(() => setAchOpen(true))
          }}
        />
      )}
      {editProfilePage}
      {friendsOpen && user && (
        <Friends
          titleOverride={menuTitle('friends')}
          currentId={user?.id}
          onAddFriend={(id) => handleAddFriend(id)}
          onInvite={handleInviteFriend}
          onTab={(tab) => {
            // Sekme tıklaması: Mesajlar'a geç (karşılıklı-dışlar; URL de /mesajlar olur).
            if (tab === 'messages') {
              setFriendsOpen(false)
              setMessagesFocusId(null)
              setMessagesOpen(true)
            }
          }}
          onMessage={(uid) => {
            setFriendsOpen(false)
            setMessagesFocusId(uid)
            setMessagesOpen(true)
          }}
          onClose={() => setFriendsOpen(false)}
        />
      )}
      {messagesOpen && user && (
        <Messages
          titleOverride={menuTitle('messages')}
          focusUserId={messagesFocusId}
          isAdmin={!!user.is_admin}
          onTab={(tab) => {
            // Sekme tıklaması: Arkadaşlar'a geç (karşılıklı-dışlar; URL de /arkadaslar olur).
            if (tab === 'friends') {
              setMessagesOpen(false)
              setMessagesFocusId(null)
              setFriendsOpen(true)
            }
          }}
          onRead={() => refreshDmUnread()}
          myAvatar={profile.avatar ?? null}
          myFrame={user.avatar_frame ?? null}
          myName={profile.nickname}
          notifications={notifications}
          unreadNotif={unreadNotif}
          onNotifRead={() => {
            setUnreadNotif(0)
            setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))
            markNotificationsRead().catch(() => {})
          }}
          onNotifDelete={handleDeleteNotification}
          onNotifDeleteAll={handleDeleteAllNotifications}
          onAcceptFriend={handleAcceptFriendNotif}
          onClose={() => {
            setMessagesOpen(false)
            setMessagesFocusId(null)
          }}
        />
      )}
      {leaderboardOpen && (
        <Leaderboard
          titleOverride={menuTitle('leaderboard')}
          currentName={profile.nickname}
          currentId={user?.id}
          onClose={() => setLeaderboardOpen(false)}
          onAddFriend={(id) => handleAddFriend(id)}
          onMessage={(id) => {
            // Site geneliyle ayni: liderligi kapat, o oyuncuyla sohbeti ac (arkadas degilse istek olarak duser).
            setLeaderboardOpen(false)
            setMessagesFocusId(id)
            setMessagesOpen(true)
          }}
        />
      )}
      {achOpen && <Achievements loggedIn={!!user} onClose={() => setAchOpen(false)} />}
      {infoOpen && (
        <Suspense fallback={null}>
          <Info
            onClose={() => setInfoOpen(false)}
            tab={infoTab}
            onTab={setInfoTab}
            currentRating={user?.rating ?? undefined}
            loggedIn={!!user}
            fair={{
              commitment: fairRef.current.commitment,
              clientSeed: fairRef.current.clientSeed,
              serverSeed: matchWinner(match) ? fairRef.current.serverSeed : undefined,
              rolls: fairRef.current.nonce,
            }}
          />
        </Suspense>
      )}
      {ranksOpen && (
        <RankInfo currentRating={user?.rating ?? undefined} onClose={() => setRanksOpen(false)} />
      )}
      {/* Hukuki sayfalar (KVKK/gizlilik/cerez/kullanim/uyelik) — NORMAL sayfa (page-host) */}
      {legalSlug && <LegalView slug={legalSlug} onClose={() => setLegalSlug(null)} />}
      {/* Istatistiklerim ayri sayfa DEGIL -> Profilim "Istatistiklerim" sekmesine gomulu */}
      {fairOpen && (
        <FairnessModal
          commitment={fairRef.current.commitment}
          clientSeed={fairRef.current.clientSeed}
          serverSeed={matchWinner(match) ? fairRef.current.serverSeed : undefined}
          rolls={fairRef.current.nonce}
          onClose={() => setFairOpen(false)}
        />
      )}
      {lessonsOpen && (
        <Suspense fallback={null}>
          <Lessons onClose={() => setLessonsOpen(false)} />
        </Suspense>
      )}
      {shopOpen && (
        <Shop
          titleOverride={menuTitle('shop')}
          // Misafir de mağazayı gezebilir (gate yok): cüzdan 0 görünür, satın alma girişe yönlendirir.
          coins={user?.coins ?? 0}
          rewardReady={rewardReady}
          rewardSecs={rewardSecs}
          onDaily={handleDaily}
          onBuyCoins={(pkgId) => {
            // Misafir: sepet/ödeme giriş ister -> mağazayı kapat, giriş ekranını aç.
            if (!user) {
              setShopOpen(false)
              setShowAuth(true)
              return
            }
            // Coin paketini sepete ekle (varsa adedini arttir) -> sepete yonlendir.
            // Uyelik ogesi coin ile karismaz: coin eklenince sepetten cikarilir (tek-tip sepet).
            setCartItems((prev) => {
              const coins = prev.filter((c) => c.kind !== 'membership')
              const ex = coins.find((c) => c.id === pkgId)
              return ex
                ? coins.map((c) => (c.id === pkgId ? { ...c, qty: c.qty + 1 } : c))
                : [...coins, { id: pkgId, qty: 1 }]
            })
            setShopOpen(false)
            setCartOpen(true)
          }}
          cartCount={cartItems.reduce((s, c) => s + c.qty, 0)}
          onOpenCart={() => {
            setShopOpen(false)
            setCartOpen(true)
          }}
          onMembership={() => {
            setShopOpen(false)
            setMemOpen(true)
          }}
          onAddToCart={user ? addProductToCart : () => { setShopOpen(false); setShowAuth(true) }}
          tab={shopTab}
          onTabChange={(slug) => {
            setShopTab(slug)
            setShopProduct(null) // sekme degisince acik urun detayini kapat
          }}
          productSlug={shopProduct}
          onSelectProduct={setShopProduct}
          boardTheme={boardTheme}
          setBoardTheme={setBoardTheme}
          boardThemes={boardThemeList}
          onBuyItem={handleBuy}
          framesSlot={
            user ? (
              <FrameShop
                coins={user.coins ?? 0}
                unlocks={user.unlocks ?? []}
                currentFrame={user.avatar_frame ?? null}
                avatar={profile.avatar ?? null}
                name={profile.nickname}
                onBuy={handleBuy}
                onEquip={handleEquipFrame}
              />
            ) : undefined
          }
          onClose={() => {
            setShopOpen(false)
            setShopTab('coin') // sonraki normal acilis coin sekmesinden baslasin
            setShopProduct(null)
          }}
        />
      )}
      {cartOpen && user && (
        <Cart
          items={cartItems}
          setItems={setCartItems}
          onClose={() => setCartOpen(false)}
          onContinue={() => {
            // "Alışverişe devam" -> Mağaza coin sekmesi
            setCartOpen(false)
            setShopTab('coin')
            setShopOpen(true)
          }}
          onManageAddresses={() => {
            // Adres ekle/yönet -> profil Adreslerim sekmesi (sepet açık kalır: kapatıp profili aç).
            setCartOpen(false)
            setProfileEditMode(false)
            setProfileTab('addresses')
            setEditProfile(true)
          }}
          onCheckout={async (its, code, sel, method: PayMethod) => {
            // Üyelik uzatma tek başına (mevcut akış).
            if (its.some((i) => i.kind === 'membership')) {
              const r = await buyMembership(method)
              setCartOpen(false)
              if (isBankTransfer(r)) {
                // Havale: sipariş sunucuda oluştu (pending) -> üyelik öğesini sepetten çıkar.
                setCartItems((prev) => prev.filter((i) => i.kind !== 'membership'))
                setBankData(r)
              } else {
                setCheckoutData({ submitUrl: r.submitUrl, amount: r.amount, coins: 0, items: its, demo: r.demo })
                setCheckoutOpen(true)
              }
              return
            }
            const coinProducts = its.filter((i) => i.kind === 'product' && i.product?.payment === 'coin')
            const moneyProducts = its.filter((i) => i.kind === 'product' && i.product?.payment === 'money')
            const coinPackages = its.filter((i) => i.kind === 'coins' || i.kind === undefined)

            // 1) Coin ödemeli ürünler -> ANINDA sipariş (atomik). Başarınca sepetten çıkar.
            if (coinProducts.length) {
              const lines = coinProducts.map((i) => ({ product_id: i.product!.id, qty: i.qty, color: i.product!.color ?? null }))
              const sig = JSON.stringify([lines, sel.shippingId, sel.billingId ?? null])
              if (coinOrderKeyRef.current?.sig !== sig) coinOrderKeyRef.current = { sig, key: newCommandId() }
              const r = await cartCoinOrder(lines, sel.shippingId as number, sel.billingId, undefined, coinOrderKeyRef.current.key)
              coinOrderKeyRef.current = null // başarı -> sonraki sipariş yeni anahtar
              setUser((u) => (u ? { ...u, coins: r.coins } : u))
              setCartItems((prev) => prev.filter((i) => !(i.kind === 'product' && i.product?.payment === 'coin')))
            }

            // 2) Para kısmı (coin paketleri + para-ürünleri) -> TEK ödeme (kart veya havale).
            if (coinPackages.length || moneyProducts.length) {
              const r = await cartCheckout({
                coin_items: coinPackages.map((i) => ({ id: i.id, qty: i.qty })),
                products: moneyProducts.map((i) => ({ product_id: i.product!.id, qty: i.qty, color: i.product!.color ?? null })),
                shipping_address_id: sel.shippingId,
                billing_address_id: sel.billingId,
                code,
                method,
              })
              setCartOpen(false)
              if (isBankTransfer(r)) {
                // Havale: para siparişleri sunucuda oluştu (pending) -> sepetten çıkar
                // (coin ürünleri zaten anında işlendi ve yukarıda çıkarıldı).
                setCartItems((prev) =>
                  prev.filter((i) => !(i.kind === 'coins' || i.kind === undefined) && !(i.kind === 'product' && i.product?.payment === 'money')),
                )
                setBankData(r)
              } else {
                setCheckoutData({ submitUrl: r.submitUrl, amount: r.amount, coins: r.coins ?? 0, items: its, demo: r.demo })
                setCheckoutOpen(true)
              }
            } else {
              // Yalnız coin ürünleri vardı -> sipariş tamam.
              setCartOpen(false)
              notify.success('Siparişin alındı.')
              setMyOrdersOpen(true)
            }
          }}
        />
      )}
      {checkoutOpen && user && checkoutData && (
        <Checkout
          submitUrl={checkoutData.submitUrl}
          amount={checkoutData.amount}
          coins={checkoutData.coins}
          items={checkoutData.items}
          demo={checkoutData.demo}
          onBack={() => {
            setCheckoutOpen(false)
            setCartOpen(true)
          }}
        />
      )}
      {bankData && (
        <BankTransfer
          reference={bankData.reference}
          amount={bankData.amount}
          iban={bankData.iban}
          name={bankData.name}
          bank={bankData.bank}
          note={bankData.note}
          onDone={() => {
            setBankData(null)
            setMyOrdersOpen(true)
          }}
        />
      )}
      {frameGalleryOpen && (
        <FrameGallery
          avatar={profile.avatar ?? null}
          name={profile.nickname}
          onClose={() => setFrameGalleryOpen(false)}
        />
      )}
      {tournOpen && (
        <Suspense fallback={null}>
        <Tournaments
          titleOverride={menuTitle('tournaments')}
          myId={user?.id ?? null}
          isAdmin={!!user?.is_admin}
          premium={premium}
          onRequireLogin={() => setShowAuth(true)}
          onRequirePremium={() => setMemOpen(true)}
          onPlayMatch={handlePlayTournamentMatch}
          onSpectate={(code, p1, p2) => setSpectate({ code, p1, p2 })}
          detailId={tournDetailId}
          onOpenDetail={(id, slug) => {
            setTournDetailId(id)
            setTournDetailSlug(id != null ? slug ?? String(id) : null)
          }}
          onClose={() => {
            setTournOpen(false)
            setTournDetailId(null)
            setTournDetailSlug(null)
          }}
        />
        </Suspense>
      )}
      {soloOpen && (
        <SoloStakes
          coins={user?.coins ?? 0}
          board={(() => {
            const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
            return { id: bt.id, panel: bt.panel ?? bt.b, a: bt.a, b: bt.b, checker: bt.checker, light: bt.light, pointStyle: bt.pointStyle, surface: bt.surface, checkerStyle: bt.checkerStyle, pointImgA: bt.pointImgA, pointImgB: bt.pointImgB, pointFitA: bt.pointFitA, pointFitB: bt.pointFitB, pointImgs: bt.pointImgs, pointFits: bt.pointFits, surfaceImgLeft: bt.surfaceImgLeft, surfaceImgRight: bt.surfaceImgRight, surfaceOpacity: bt.surfaceOpacity, pointTexts: bt.pointTexts }
          })()}
          onPick={startSoloStake}
          onClose={() => setSoloOpen(false)}
          titleOverride={menuOverrides['solo']?.title?.[lang]}
          subOverride={menuOverrides['solo']?.sub?.[lang]}
        />
      )}
      {luckyWheelOpen && (
        <LuckyWheel
          titleOverride={menuTitle('luckywheel')}
          loggedIn={!!user}
          onClose={() => setLuckyWheelOpen(false)}
          onRequireLogin={() => setShowAuth(true)}
          onCoinsChange={(c) => setUser((u) => (u ? { ...u, coins: c } : u))}
          onUser={(su) => setUser(su)}
        />
      )}
      {diceSlotOpen && (
        <DiceSlot
          titleOverride={menuTitle('diceslot')}
          loggedIn={!!user}
          onClose={() => setDiceSlotOpen(false)}
          onRequireLogin={() => setShowAuth(true)}
          onCoinsChange={(c) => setUser((u) => (u ? { ...u, coins: c } : u))}
          onUser={(su) => setUser(su)}
        />
      )}
      {excusesOpen && <ExcuseMachine titleOverride={menuTitle('excuses')} onClose={() => setExcusesOpen(false)} />}
      {kizOpen && <KizTavlasi onClose={() => setKizOpen(false)} />}
      {checkerShopOpen && user && (
        <CheckerShop
          unlocks={user.unlocks ?? []}
          selected={user.checker ?? null}
          coins={user.coins ?? 0}
          onBuy={async (fid) => {
            const r = await buyItem(fid)
            setUser((u) => (u ? { ...u, coins: r.coins, unlocks: r.unlocks } : u))
            return r
          }}
          onSelect={handleEquipChecker}
          onClose={() => setCheckerShopOpen(false)}
        />
      )}
      {productsOpen && (
        <Products
          onAddToCart={addProductToCart}
          onGoCart={() => {
            setProductsOpen(false)
            setCartOpen(true)
          }}
          onClose={() => setProductsOpen(false)}
        />
      )}
      {myOrdersOpen && user && (
        <MyOrders
          onClose={() => setMyOrdersOpen(false)}
          onShop={() => {
            setMyOrdersOpen(false)
            setProductsOpen(true)
          }}
        />
      )}
      {blunderOpen && user && premium && (
        <Suspense fallback={null}>
          <ErrorJournal titleOverride={menuTitle('blunders')} onClose={() => setBlunderOpen(false)} />
        </Suspense>
      )}
      {matchHistOpen && user && premium && (
        <Suspense fallback={null}>
        <MatchAnalytics
          titleOverride={menuTitle('matchHistory')}
          myName={profile.nickname}
          myAvatar={profile.avatar ?? null}
          initialMatchId={matchHistInitialId ?? undefined}
          onClose={() => {
            setMatchHistOpen(false)
            setMatchHistInitialId(null)
          }}
        />
        </Suspense>
      )}
      {frameAnimOpen && (
        // Kritik olmayan sus animasyon: chunk yuklenemezse (deploy sonrasi bayat) tum
        // uygulama cokmesin -> lokal sinir, fallback=null (sessizce kapan).
        <ErrorBoundary name="frame-anim" fallback={null}>
          <Suspense fallback={null}>
            <CerceveAnim onClose={() => setFrameAnimOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
      {gamePreviewOpen && (
        <Suspense fallback={null}>
          <GamePreview onClose={() => setGamePreviewOpen(false)} />
        </Suspense>
      )}
      {contentView && (
        <Suspense fallback={null}>
          <ContentView
            type={contentView}
            // KURAL: sayfa basligi = menu etiketi. Menude admin yeniden adlandirmissa
            // (override) baslik da onu alsin; override yoksa ContentView i18n'e duser.
            titleOverride={menuLabel(
              ({ event: 'calendar', news: 'news', magazine: 'magazine', club: 'clubs', makale: 'makale' } as Record<string, string>)[
                contentView
              ] ?? '',
            )}
            onClose={() => setContentView(null)}
            slug={newsSlug}
            onOpenDetail={(s) => setNewsSlug(s)}
            onCloseDetail={() => setNewsSlug(null)}
            currentUser={user ? { id: user.id, name: user.nickname || user.first_name } : null}
            onRequireLogin={() => setShowAuth(true)}
          />
        </Suspense>
      )}
      {quizOpen && <QuizPlay onClose={() => setQuizOpen(false)} />}
      {clubsOpen && user && (
        <Suspense fallback={null}>
          <Clubs
            onClose={() => setClubsOpen(false)}
            currentId={user?.id}
            onAddFriend={(id) => handleAddFriend(id)}
            onMessage={(id) => {
              setClubsOpen(false)
              setMessagesFocusId(id)
              setMessagesOpen(true)
            }}
          />
        </Suspense>
      )}
      {rulesOpen && (
        <Suspense fallback={null}>
          <Rules onClose={() => setRulesOpen(false)} />
        </Suspense>
      )}
      {analyzerOpen && premium && (
        <div className="register-overlay modal page" role="dialog" aria-modal="true">
          <Suspense fallback={null}>
          <PositionAnalyzer
            titleOverride={menuTitle('analyzer')}
            neuralEval={(s, p, deep) =>
              deep ? neuralRef.current.eval2ply(s, p) : neuralRef.current.evalPosition(s, p)
            }
            neuralAnalyze={(s, deep) =>
              deep ? neuralRef.current.analyzeMoves2ply(s) : neuralRef.current.analyzeMoves(s)
            }
            premium={premium}
            onUpgrade={() => {
              // Analyzer'i KAPATMA: uyelik modali ustune acilir, kapatilinca
              // kullanici pozisyon-analizi sayfasinda kalir (ana sayfaya donmez).
              setMemOpen(true)
            }}
            onClose={() => setAnalyzerOpen(false)}
          />
          </Suspense>
        </div>
      )}
      {matAnalyzerOpen && premium && (
        <div className="register-overlay modal page" role="dialog" aria-modal="true">
          <MatAnalyzer titleOverride={menuTitle('matAnalyzer')} onClose={() => setMatAnalyzerOpen(false)} currentName={profile.nickname} />
        </div>
      )}
    </>
  )

  // Ortalanmis modallar / yuzen katmanlar (her zaman overlay).
  // Bildirimler (ag hatasi + e-posta dogrulama sonucu) artik birlesik toast
  // sisteminden (ToastProvider portal'i) cikar; burada ayrica render edilmez.
  const menuOverlays = (
    <>
      {inviteBanner}
      {/* Daveti reddettikten sonra: bir daha rahatsiz olmamak icin durum degistirme teklifi */}
      {declineAsk && (
        <div className="register-overlay modal" role="dialog" aria-modal="true">
          <div className="register-card decline-ask" onClick={(e) => e.stopPropagation()}>
            <h3>{t('invite.declineTitle')}</h3>
            <p className="decline-ask-desc">{t('invite.declineDesc')}</p>
            <div className="decline-ask-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  handleSetStatus('busy')
                  setDeclineAsk(false)
                  notify.info(t('online.st.busy'))
                }}
              >
                <Icon name="shield-check" size={16} /> {t('online.st.busy')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  handleSetStatus('offline')
                  setDeclineAsk(false)
                  notify.info(t('online.st.offline'))
                }}
              >
                <Icon name="eye" size={16} /> {t('online.st.offline')}
              </Button>
              <Button variant="default" onClick={() => setDeclineAsk(false)}>
                {t('invite.declineStay')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {boardPickerOpen && (
        <BoardPickerModal
          current={boardTheme}
          boards={ownedBoards}
          onSelect={setBoardTheme}
          onMore={() => {
            setBoardPickerOpen(false)
            // Tum tahtalar + satin alma artik PROFIL "Tahtalar" sekmesinde (Magaza'dan kaldirildi)
            if (user) {
              setProfileEditMode(false)
              setProfileTab('boards')
              setEditProfile(true)
            } else {
              setShowAuth(true)
            }
          }}
          onClose={() => setBoardPickerOpen(false)}
        />
      )}
      {spectate && (
        <Spectate
          code={spectate.code}
          p1={spectate.p1}
          p2={spectate.p2}
          isAdmin={!!user?.is_admin}
          onClose={() => setSpectate(null)}
        />
      )}
      {homeProfileId !== null && (
        <PublicProfile
          id={homeProfileId}
          onClose={() => setHomeProfileId(null)}
          onAddFriend={
            user && user.id !== homeProfileId
              ? () => handleAddFriend(homeProfileId)
              : undefined
          }
          onMessage={
            user && user.id !== homeProfileId
              ? () => {
                  const uid = homeProfileId
                  setHomeProfileId(null)
                  setMessagesFocusId(uid)
                  setMessagesOpen(true)
                }
              : undefined
          }
        />
      )}
      {memOpen && user && (
        <Membership
          titleOverride={menuTitle('membership')}
          current={(user.plan_active ?? 'free') as PlanId}
          onClose={() => setMemOpen(false)}
          onExtend={() => {
            // "Üyeliğini Uzat": 1 yillik premium tek urun sepeti -> /sepet -> odeme
            setCartItems([{ id: MEMBERSHIP_ITEM_ID, qty: 1, kind: 'membership' }])
            setMemOpen(false)
            goPage(() => setCartOpen(true))
          }}
          onBankTransfer={(r) => {
            // Havale seçildi: modalı kapat, IBAN talimat ekranını aç.
            setMemOpen(false)
            setBankData(r)
          }}
        />
      )}
    </>
  )

  // "Hata Bildir": sağ kenar sabit sekme butonu + form (kendi portalıyla body'ye taşınır).
  // OYUN görünümünde (game-view return'ü) RENDER ETMEYİZ -> oyun sırasında üstte kalmaz.
  const bugReport = <BugReport currentPage={activeKey ? menuLabel(activeKey) : undefined} loggedIn={!!user} />

  // LOBİ İSKELETİ (TEK KAYNAK): tüm "app lobby" sayfaları LobbyLayout kullanır -> footer + kabuk
  // tek yerden gelir (footer'sız sayfa kök sebebi kapandı). chrome closure'lu bileşenleri bir kez
  // kurar; sayfa dalı yalnız içerik + mainClassName + trailing verir.
  const lobbyChrome = {
    mobileNav,
    topbar: (
      <div className="topbar-stack">
        {accountBar}
        {/* TURLAR ARASI GLOBAL BANT: turnuvada sıranı beklerken (hazır maç yok) her sayfanın
            üstünde görünür; turnuva sayfasındayken gizli (orada zaten detaylı not var) ve hazır
            maç varken gizli (oda oto-açılır). Tıklayınca ilgili turnuvanın detayına gider. */}
        {!tournOpen && tournNotices.length === 0 && tournWaiting.length > 0 && (
          <button
            type="button"
            className="tourn-wait-bar"
            onClick={() => menuProps.onTournamentAd(tournWaiting[0].tid)}
          >
            <Icon name="trophy" size={16} />
            <span>{t('tourn.waitNext')}</span>
          </button>
        )}
      </div>
    ),
    sideMenu: (
      <SideMenu
        inGame={false}
        hasActiveGame={hasActiveGame}
        groups={menuGroups}
        groupSig={groupCollapseSig}
        onResume={menuProps.onResume}
        hasTournMatch={tournNotices.length > 0}
        tournMatchCount={tournNotices.length}
        onTournMatch={() => {
          const n = tournNotices[0]
          if (!n) return
          enteredNoticeRef.current = '' // elle giriş -> çift-giriş kilidini sıfırla, daima dene
          if (online && !matchOver) void leaveCurrentAndEnterTourn(n.tid, n.match, n.oppId)
          else void handlePlayTournamentMatch(n.tid, { key: n.match }, n.oppId)
        }}
        active={activeKey}
        // Mesajlar = sohbetler + bildirimler (birlesik sayfa): ust bar ikonu ve sekme ile AYNI toplam.
        badges={{ messages: dmUnread + unreadNotif }}
        mobileOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
        onHome={menuProps.onHome}
      />
    ),
          footer: <Footer columns={footerColsRendered} />,
    // sponsors: SADECE ana sayfada (home dalinda ayrica gecilir); diger lobi sayfalarinda gosterme.
  }
  // İçerik sayfası dallarının ortak trailing katmanı (overlay/modal). Home + online lobi farklı verir.
  const lobbyTrailing = (
    <>
      {menuPages}
      {authModal}
      {menuOverlays}
      {bugReport}
    </>
  )

  // Mac kurulum ekrani (mod + zorluk + sure + puan + pip + analiz).
  // Diger menu sayfalari gibi: sol menu gorunur kalir, kurulum icerik alaninda acilir.
  if (setup) {
    return (
      <LobbyLayout {...lobbyChrome} trailing={lobbyTrailing}>
        <div className="page-host">
          <MatchSetup
            mode={setup}
            classic={classicSetup}
            targets={classicSetup ? CLASSIC_TARGETS : TARGETS}
            coins={user?.coins ?? 0}
            initial={{ target: classicSetup ? 7 : match.target, showPip, showAnalysis, timeControl, difficulty, ranked: rankedMatch }}
            board={(() => {
              const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
              return { id: bt.id, panel: bt.panel ?? bt.b, a: bt.a, b: bt.b, checker: bt.checker, light: bt.light, pointStyle: bt.pointStyle, surface: bt.surface, checkerStyle: bt.checkerStyle, pointImgA: bt.pointImgA, pointImgB: bt.pointImgB, pointFitA: bt.pointFitA, pointFitB: bt.pointFitB, pointImgs: bt.pointImgs, pointFits: bt.pointFits, surfaceImgLeft: bt.surfaceImgLeft, surfaceImgRight: bt.surfaceImgRight, surfaceOpacity: bt.surfaceOpacity, pointTexts: bt.pointTexts }
            })()}
            onChangeBoard={() => setBoardPickerOpen(true)}
            onConfirm={applyMatchSetup}
            titleOverride={menuTitle(classicSetup ? 'klassikAi' : setup === 'online' ? 'match' : 'aiGame')}
            premium={user?.plan_active === 'star'}
            onRequirePremium={() => setMemOpen(true)}
            onCancel={() => {
              setSetup(null)
              setClassicSetup(false)
              if (mode === 'online' && !room) setHome(true)
            }}
          />
          {/* Kurulum altına taranabilir SEO içeriği (ince sayfa -> "taranan ama indekslenmiyor"
              düzeltmesi). online=yeni-oyun, pvb=yz-ile-oyna. */}
          <SeoAppSection page={setup === 'online' ? 'yeni-oyun' : 'yz-ile-oyna'} />
        </div>
      </LobbyLayout>
    )
  }

  // Arkadasinla oyna kurulum ekrani. YZ ile Oyna (setup) ile AYNI sayfa duzeni:
  // sol menu gorunur, kurulum (setup-split + board onizleme) icerik alaninda acilir.
  if (friendSetupOpen) {
    return (
      <LobbyLayout {...lobbyChrome} trailing={lobbyTrailing}>
        <div className="page-host">
          <FriendGameSetup
            board={(() => {
              const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
              return { id: bt.id, panel: bt.panel ?? bt.b, a: bt.a, b: bt.b, checker: bt.checker, light: bt.light, pointStyle: bt.pointStyle, surface: bt.surface, checkerStyle: bt.checkerStyle, pointImgA: bt.pointImgA, pointImgB: bt.pointImgB, pointFitA: bt.pointFitA, pointFitB: bt.pointFitB, pointImgs: bt.pointImgs, pointFits: bt.pointFits, surfaceImgLeft: bt.surfaceImgLeft, surfaceImgRight: bt.surfaceImgRight, surfaceOpacity: bt.surfaceOpacity, pointTexts: bt.pointTexts }
            })()}
            onChangeBoard={() => setBoardPickerOpen(true)}
            invitee={inviteTarget}
            defaultClassic={friendClassic}
            titleOverride={menuTitle(friendClassic ? 'klassikFriend' : 'playFriend')}
            onInvite={handleSendInvite}
            onCancel={() => {
              setFriendSetupOpen(false)
              setInviteTarget(null)
              setFriendClassic(false)
            }}
            onCreate={({ target, timeControl, unrated, classic }) => {
              setFriendSetupOpen(false)
              setFriendClassic(false)
              setTimeControl(timeControl)
              clockRef.current = CLOCK_PRESETS[timeControl]
              onlineTargetRef.current = target
              targetsRef.current = [target]
              setMode('online')
              setHome(false)
              handleCreateRoom(target, timeControl, unrated, classic)
            }}
            onJoin={(code) => {
              // Arkadasin kodu: navigasyonu ERKEN yapma. Kod gecerliyse handleJoinRoom
              // online'a gecirir; gecersizse (404) kurulum ekraninda kalip toast ile
              // "boyle bir oda yok" der (eskiden bogus bir maca dusuyordu).
              handleJoinRoom(code)
            }}
          />
          {/* Kurulum altına taranabilir SEO içeriği (ince sayfa düzeltmesi). */}
          <SeoAppSection page="arkadasinla-oyna" />
        </div>
      </LobbyLayout>
    )
  }

  // Turnuva organizasyonu SEO servis sayfalari + /iletisim (hub + kurumsal/belediye/avm +
  // iletisim): SEO landing deseniyle ayni page-host akisi; ServiceLanding icinde iletisim
  // formu render edilir. Kapatinca home'a doner.
  if (servicePage) {
    return (
      <LobbyLayout {...lobbyChrome} trailing={lobbyTrailing}>
        <div className="page-host">
          <Suspense fallback={null}>
            <ServiceLanding
              slug={servicePage}
              onClose={() => {
                setServicePage(null)
                setHome(true)
              }}
            />
          </Suspense>
        </div>
      </LobbyLayout>
    )
  }

  // Admin-eklemeli OZEL bilgi sayfasi (/bilgi/<slug>, katalog disi): ServiceLanding ile ayni
  // page-host akisi; sol menu gorunur kalir. DB'den body + galeriler render edilir. Kapatinca home.
  if (customInfoSlug) {
    return (
      <LobbyLayout {...lobbyChrome} trailing={lobbyTrailing}>
        <div className="page-host">
          <Suspense fallback={null}>
            <CustomInfoPage
              slug={customInfoSlug}
              onClose={() => {
                setCustomInfoSlug(null)
                setHome(true)
              }}
            />
          </Suspense>
        </div>
      </LobbyLayout>
    )
  }

  // SEO landing sayfalari (/online-tavla, /tavla-oyna): diger menu sayfalari gibi sol menu
  // gorunur kalir, taranabilir icerik page-host icinde akis icinde acilir. Kapatinca home'a doner.
  if (onlineTavlaOpen || tavlaOynaOpen) {
    return (
      <LobbyLayout {...lobbyChrome} trailing={lobbyTrailing}>
        <div className="page-host">
          <SeoContent
            variant={onlineTavlaOpen ? 'online-tavla' : 'tavla-oyna'}
            onClose={() => {
              setOnlineTavlaOpen(false)
              setTavlaOynaOpen(false)
              setHome(true)
            }}
          />
        </div>
      </LobbyLayout>
    )
  }

  // Tavla Rehberi blog (/tavla-rehberi, /tavla-rehberi/<slug>): SEO landing deseniyle ayni
  // page-host akisi; sol menu gorunur kalir. Kapatinca home'a doner. (haberler'den bagimsiz.)
  if (guideOpen) {
    return (
      <LobbyLayout {...lobbyChrome} trailing={lobbyTrailing}>
        <div className="page-host">
          <Suspense fallback={null}>
            <GuideView
              slug={guideSlug}
              onClose={() => {
                setGuideOpen(false)
                setGuideSlug(null)
                setHome(true)
              }}
              onOpen={(s) => setGuideSlug(s)}
            />
          </Suspense>
        </div>
      </LobbyLayout>
    )
  }

  // WBF Turnuva Kuralları referans/SEO sayfası (/turnuva-kurallari): guideOpen ile ayni page-host akisi.
  if (tournRulesOpen) {
    return (
      <LobbyLayout {...lobbyChrome} trailing={lobbyTrailing}>
        <div className="page-host">
          <Suspense fallback={null}>
            <TournamentRules
              onClose={() => {
                setTournRulesOpen(false)
                setHome(true)
              }}
            />
          </Suspense>
        </div>
      </LobbyLayout>
    )
  }

  // Tavla hakkında sıkça sorulan sorular: kaynak FAQ envanterinin özgün Türkçe
  // soru-cevap karşılıkları, konu bağlantıları ve paylaşılabilir madde linkleri.
  if (faqOpen) {
    return (
      <LobbyLayout {...lobbyChrome} trailing={lobbyTrailing}>
        <div className="page-host">
          <Suspense fallback={null}>
            <FaqView
              onClose={() => {
                setFaqOpen(false)
                setHome(true)
              }}
            />
          </Suspense>
        </div>
      </LobbyLayout>
    )
  }

  // Pozisyon analiz modulu (tam ekran)
  // Lobi (ana menu): solda Yeni Oyun, ortasi bos. Akis burdan baslar.
  if (home) {
    return (
      <LobbyLayout
        {...lobbyChrome}
        sponsors={anyPageOpen ? [] : sponsors}
        mainClassName={`main lobby-main ${anyPageOpen ? 'has-page' : ''}`}
        trailing={
          <>
            {/* authModal artik page-host icinde (yukarida) -> burada standalone render YOK
                (aksi halde cift render + header'i orten fixed overlay geri gelirdi). */}
            {menuOverlays}
            {bugReport}
            {/* Siteye ilk giriste KARE reklam pop-up'i (panelden yonetilir; sikligi/kitlesi admin). */}
            <EntryPopupModal loggedIn={!!user} />
            {/* Cerez onay banner'i + tercih modali (consent teknik olarak uygulanir; bkz consent.ts) */}
            <CookieConsent />
            {/* Hukuki sayfalar artik NORMAL sayfa: menuPages (page-host) icinde render edilir. */}
          </>
        }
      >
            {anyPageOpen ? (
              <div className="page-host">
                {/* Kurulu PWA (standalone): tarayici geri tusu ve iOS'ta kenardan geri hareketi yok
                    -> sayfa basinda "‹ Geri". Tarayicida CSS ile gizli (orada geri tusu var). */}
                <button
                  type="button"
                  className="page-back"
                  onClick={() => {
                    if (window.history.length > 1) window.history.back()
                    else {
                      window.history.pushState(null, '', '/')
                      window.dispatchEvent(new PopStateEvent('popstate'))
                    }
                  }}
                >
                  <Icon name="caret-left" size={18} /> {t('common.back')}
                </button>
                {/* showAuth iken YALNIZ auth goster -> baska sayfa (Tek Oyun vb.) acikken auth
                    ile ALT ALTA yigilmasin. Auth kapaninca menuPages geri gelir. Header page-host
                    icinde oldugu icin korunur. */}
                {showAuth ? authModal : menuPages}
              </div>
            ) : (
            <>
            <BannerSlider onOpen={menuProps.onTournamentAd} />
            {activeRooms.length > 0 && (
              <div className="resume-match-bar">
                {activeRooms.map((r) => {
                  // Skor {white,black}; kendi rengim slot'a bagli (p2=siyah). Bari
                  // "kendi–rakip" gosterecek sekilde kendi skorumu one al.
                  const myScore = r.score ? (r.slot === 'p2' ? r.score.black : r.score.white) : null
                  const oppScore = r.score ? (r.slot === 'p2' ? r.score.white : r.score.black) : null
                  const myName = profile.nickname || t('resume.you')
                  const oppName = r.opp_name || t('mp.title')
                  return (
                    <div key={r.code} className="resume-match-row">
                    <button className="resume-match-btn" onClick={() => rejoinRoom(r)}>
                      <span className="rm-live"><span className="live-dot" /> {t('resume.active')}</span>
                      <span className="rm-opp">
                        <span className="rm-players">
                          <span className="rm-me">
                            <AvatarFrame src={profile.avatar} frame={user?.avatar_frame} size={26} name={myName} className="rm-avf" />
                            {myName}
                            {premium && <PremiumCrown style={{ marginLeft: 5 }} />}
                          </span>
                          <span className="rm-vs">vs</span>
                          <span className="rm-you">
                            <AvatarFrame src={r.opp_avatar} size={26} name={oppName} className="rm-avf" />
                            {oppName}
                            {r.opp_premium && <PremiumCrown style={{ marginLeft: 5 }} />}
                            {typeof r.opp_rating === 'number' && (
                              <span className="rm-rat"> {r.opp_rating}</span>
                            )}
                          </span>
                        </span>
                        {myScore != null && (
                          <b className="rm-score">{myScore}–{oppScore}</b>
                        )}
                        {r.target ? (
                          <span className="rm-len">{t('resume.point', { n: r.target })}</span>
                        ) : null}
                      </span>
                      <span className="rm-cta"><Icon name="play" size={14} /> {t('resume.return')}</span>
                    </button>
                    {/* × : bitmis/fantom online maci banner'dan kaldir (leave -> ABANDON/no-op) */}
                    <button
                      type="button"
                      className="resume-discard"
                      onClick={() => dismissActiveRoom(r.code)}
                      title={t('resume.discard')}
                      aria-label={t('resume.discard')}
                    >
                      <Icon name="x" size={16} />
                    </button>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Online devam eden mac varsa (resume-match-bar) tekrar buton cikarma:
                online maçta yalnız "Geri Dön" kalsın, "Oyuna Devam Et" gizli. */}
            {hasActiveGame && activeRooms.length === 0 && (
              // Yerel (bota karsi / pass-and-play) devam eden mac: online resume karti
              // ile ayni belirgin tam-genislik tasarim (kucuk dugme yerine). resume-local ->
              // bar yatay: [maça dön butonu | × at] (online bar dikey coklu buton kalir).
              <div className="resume-match-bar resume-local">
                <button className="resume-match-btn" onClick={() => setHome(false)}>
                  <span className="rm-live"><span className="live-dot" /> {t('resume.active')}</span>
                  <span className="rm-opp">
                    <span className="rm-players">
                      <span className="rm-me">
                        <AvatarFrame src={profile.avatar} frame={user?.avatar_frame} size={26} name={profile.nickname || t('resume.you')} className="rm-avf" />
                        {profile.nickname || t('resume.you')}
                        {premium && <PremiumCrown style={{ marginLeft: 5 }} />}
                      </span>
                      <span className="rm-vs">vs</span>
                      <span className="rm-you">
                        {mode === 'pvb' ? (
                          <span className="rm-bot-ava"><Icon name="robot" size={16} /></span>
                        ) : (
                          <AvatarFrame src={null} size={26} name={t('player.p2')} className="rm-avf" />
                        )}
                        {mode === 'pvb' ? t('player.bot') : t('player.p2')}
                        {mode === 'pvb' && (
                          <span className="rm-rat"> {t('solo.level', { n: difficulty })}</span>
                        )}
                      </span>
                    </span>
                    <b className="rm-score">{match.score.white}–{match.score.black}</b>
                    {match.target ? (
                      <span className="rm-len">{t('resume.point', { n: match.target })}</span>
                    ) : null}
                  </span>
                  <span className="rm-cta"><Icon name="play" size={14} /> {t('resume.return')}</span>
                </button>
                {/* × : fantom/bozuk lokal maçı at (kayıt sil + state sıfırla) */}
                <button
                  type="button"
                  className="resume-discard"
                  onClick={discardLocalGame}
                  title={t('resume.discard')}
                  aria-label={t('resume.discard')}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            )}
            {user && (
              <HomeDashboard
                rating={user.rating ?? 0}
                coins={user.coins ?? 0}
                wins={user.wins ?? 0}
                games={user.games_played ?? 0}
                showStats={false}
                daily={{
                  ready: rewardReady,
                  countdown: fmtCountdown(rewardSecs),
                  onClaim: handleDaily,
                }}
              />
            )}
            <AdStrip slot="top" />
            {/* Oyun Arayanlar: hızlı eşleşme havuzunda bekleyenler (reklam bannerının hemen altı) */}
            <SeekersPanel
              currentId={user?.id}
              myCoins={user?.coins}
              onProfile={(id) => setHomeProfileId(id)}
              onJoin={handleJoinSeeker}
              onInvite={user ? handleInviteFriend : undefined}
              // Kendi aktif havuz aramam (varsa): listenin en üstünde "Rakip Bekleniyor…" + İptal
              // ile göster (backend self'i hariç tutar -> yerel room state'ten anında çiz).
              mySeek={
                // Havuz araması (mm_waiting) VEYA hedefli davet beklemesi (waiting + inviteWaitName):
                // ikisi de "Oyun Arayanlar"da en üstte "Rakip Bekleniyor…" + İptal ile gösterilir.
                user && online && (room?.status === 'mm_waiting' || (room?.status === 'waiting' && !!inviteWaitName))
                  ? {
                      kind: 'seeking',
                      id: user.id,
                      name: profile.nickname || t('auth.guestNick'),
                      rating: user.rating ?? null,
                      avatar: profile.avatar,
                      frame: user.avatar_frame ?? null,
                      country: profile.country || null,
                      premium,
                      targets: targetsRef.current,
                      stake: stakeRef.current,
                      stakes: stakesRef.current ?? [stakeRef.current].filter((n) => n > 0),
                      bet_pct: betPctRef.current,
                      classic: classicRef.current,
                      time_control: timeControl,
                    }
                  : null
              }
              onCancelSeek={() =>
                // Hedefli davet beklemesi -> handleLeaveRoom (daveti geri çeker + odayı kapatır);
                // havuz araması -> handleCancelMatch (cancelMatchmake). İkisi de ana sayfada kalır.
                inviteWaitName && room?.status === 'waiting' ? handleLeaveRoom() : handleCancelMatch(true)
              }
            />
            {seekerConfirm && (
              <ConfirmModal
                icon="coin"
                title={t('seekers.title')}
                message={seekerConfirm.msg}
                onConfirm={() => {
                  const run = seekerConfirm.run
                  setSeekerConfirm(null)
                  run()
                }}
                onCancel={() => setSeekerConfirm(null)}
              />
            )}
            {/* Çevrimiçi Oyuncular (sol) + Canlı Maçlar (yanında) */}
            <div className="home-panels">
              <OnlinePlayersPanel
                currentName={profile.nickname}
                currentId={user?.id}
                onProfile={(id) => setHomeProfileId(id)}
                onInvite={user ? handleInviteFriend : undefined}
              />
              <LiveMatchesPanel
                onSpectate={(code, p1, p2) => setSpectate({ code, p1, p2 })}
              />
            </div>
            {/* Öne çıkan Şampiyonlar (Top List): PR + Puan İlk 3 — çevrimiçi/canlı panellerin ALTINDA */}
            <TopThreeShowcase onProfile={(id) => setHomeProfileId(id)} />
            <AdStrip slot="middle" />
            {!user && <HomeFeatures />}
            <div className="home-cal-wrap">
              {/* SOL: Online Turnuvalar (ust) + Turnuva Takvimi (alt). SAG: Haberler. */}
              <div className="home-cal-main">
                <TournamentsPanel tourns={lobbyTourns} onOpen={menuProps.onTournaments} />
                <CalendarPanel tourns={lobbyTourns} onOpen={menuProps.onCalendar} title={menuLabel('calendar') ?? t('menu.calendar')} />
              </div>
              {/* SAG kolon: Haberler (ust) + Liderlik Tablosu (Takvim'in yanina) */}
              <div className="home-cal-side">
                <NewsPanel onOpen={menuProps.onNews} onOpenNews={menuProps.onOpenNews} />
                <RankingPanel
                  currentName={profile.nickname}
                  onProfile={(id) => setHomeProfileId(id)}
                  onOpen={menuProps.onLeaderboard}
                />
              </div>
            </div>
            <AdStrip slot="bottom" />
            {/* Taranabilir SEO icerik blogu (ana sayfa alti) — "online tavla"/"tavla oyna" */}
            <SeoContent variant="home" />
            </>
            )}
      </LobbyLayout>
    )
  }

  // Online mod: oyun baslamadiysa lobi (oda olustur/katil/bekle).
  // ÖNEMLİ: Maç BİTTİYSE (matchOver) lobiye DÜŞME — oda 'finished' olsa bile oyun
  // görünümünü koru ki MatchResult (sonuç + Analiz + Rövanş) gösterilebilsin. Aksi
  // halde maç biter bitmez oyuncular arama/lobi sayfasına atılır (kritik bug).
  // YALNIZCA gercek bir oda VAR ya da eslesme/oda-kurma SURUYOR (roomBusy) iken bu dala
  // gir. Aksi halde (bayat mode==='online' + room=null, orn. iptal/hata sonrasi) burasi
  // devreye girip KULLANILMAYAN "Online Oyun" secim ekranini gosteriyordu (sorunlarin
  // koku). Artik o ekran hicbir akista gorunmez; setup/solo/home dallari devralir.
  // YALNIZ gerçek bekleme/arama durumları Lobby'yi (embed) render eder: arama spinner'ı
  // (roomBusy), davet bekleme (waiting) veya hızlı eşleşme (mm_waiting). 'finished'/bayat
  // durumlar ESKİ seçim ekranını açmasın -> returnToOrigin effect'i origine götürür.
  // TURNUVA BEKLEME = maç ekranı: rakip bağlanmamış turnuva odasında Lobby "Rakip Bekleniyor"
  // kartı YERİNE tahtayı göster (+ 60sn geri sayım banner'ı). Böylece oyuncu boş kartta değil maç
  // ekranında bekler; rakip 60sn gelmezse no-show effect'i hükmen kazandırır.
  const isTournWaiting =
    online && !!tournRoom && room?.code === tournRoom.code && room?.status === 'waiting' && !matchOver
  if (
    mode === 'online' &&
    !matchOver &&
    !isTournWaiting &&
    (roomBusy || room?.status === 'waiting' || room?.status === 'mm_waiting')
  ) {
    // Oda olustur/bekle/arama: FIXED tam-ekran overlay YERINE lobi kabugu (logo + sol
    // menu) icinde GOMULU goster -> menu/logo/sayfa kaybolmaz (kullanici geri bildirimi).
    return (
      <LobbyLayout
        {...lobbyChrome}
        mainClassName="main lobby-main"
        trailing={
          <>
            {authModal}
            {menuOverlays}
            {bugReport}
          </>
        }
      >
        <Lobby
          embedded
          room={room}
          busy={roomBusy}
          error={roomError}
          inviteWaitName={inviteWaitName}
          inviteWaitRating={inviteWaitRating}
          inviteWaitPreview={inviteWaitPreview}
          isTournament={online && !!tournRoom && room?.code === tournRoom.code}
          myAvatar={profile.avatar}
          onCreate={() => handleCreateRoom(onlineTargetRef.current)}
          onJoin={handleJoinRoom}
          onMatchmake={handleMatchmake}
          onCancelMatch={() => handleCancelMatch()}
          onLeave={handleLeaveRoom}
        />
      </LobbyLayout>
    )
  }

  // GÜVENLİK AĞI (board FLASH fix): online modda GERÇEK oyun yoksa (oda 'playing' değil + maç
  // bitmedi) game-view'ı (board) RENDER ETME. "Tek Oyun Başla → bir an board görünüp arama
  // ekranına geçme" bug'ı: Start geçişinde roomBusy daha true olmadan (veya bayat mode='online'
  // + room=null iken) bu dala düşüp VARSAYILAN board'u (opening='roll') bir kare gösteriyordu.
  // Aranırken/bekleme odasında roomBusy/oda dalı (yukarıda) zaten arama ekranını gösterir; buraya
  // yalnız geçiş/bayat kare düşer -> board YERİNE boş bırak (bir sonraki render arama/home devralır).
  // NOT: room===null'a daralt -> 'waiting'/'playing'/'finished' odalar (arama dalı + sonuç ekranı)
  // ETKİLENMEZ; yalnız oda YOKKEN (Start geçişi / bayat online) board flash'ı engellenir.
  // Online ama GERÇEK oynanan oyun yok (room null VEYA 'finished'/bayat) + sonuç yok:
  // board FLASH etme. Bekleme/arama üstteki Lobby dalında; buraya yalnız geçiş karesi düşer
  // (returnToOrigin effect'i bir sonraki tick'te origine/kuruluma götürür).
  if (mode === 'online' && !matchOver && room?.status !== 'playing' && !isTournWaiting) {
    return <div className="app game-view" aria-hidden />
  }

  // botMatch: yerel pvb VEYA sunucu-otoriter bot odası (SERVER_BOT). Öğrenme/ipucu ikisinde de açık.
  const showHintUI =
    botMatch && interactive && diceRolled && !gameWon && remainingDice.length > 0

  return (
    <div className="app game-view">
      {accountBar}
      {/* Tam ekran butonu YALNIZ Fullscreen API destekleniyorsa (iOS Safari desteklemez -> ikon
          calismiyordu, "o ikonu kaldir" istegi). Masaustu/Android'de calisir, orada kalir. */}
      {typeof document !== 'undefined' && document.fullscreenEnabled && (
        <button
          className="fs-toggle"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? t('menu.fsExit') : t('menu.fsEnter')}
          title={isFullscreen ? t('menu.fsExit') : t('menu.fsEnter')}
        >
          <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} />
        </button>
      )}
      {/* İzleyenler (oynayan oyuncular da kimlerin izlediğini + sayıyı görsün) — yalnız online
          maçta izleyici varken; izleyicilerin gördüğü panelin aynısı (bkz Spectate). */}
      {online && viewerCount > 0 && (
        <div className="spectate-side viewers-float">
          <ViewersBadge viewers={roomViewers} count={viewerCount} />
        </div>
      )}
      {/* Mobil DIKEY ipucu: "telefonu yan cevir". .rotate-tip CSS'i yalniz mobil-portre'de
          gosterir; yatay cevrilince kaybolur. Kapatilinca oturum boyu gizlenir. */}
      {!rotateTipHidden && (
        <div className="rotate-tip" role="status">
          <span className="rotate-tip-icon" aria-hidden="true">
            <Icon name="phone" size={16} />
          </span>
          <span className="rotate-tip-text">{t('mobile.rotate')}</span>
          <button
            type="button"
            className="rotate-tip-x"
            aria-label={t('common.close')}
            onClick={() => {
              setRotateTipHidden(true)
              try {
                sessionStorage.setItem('tv-rotate-tip', '1')
              } catch {
                /* yok */
              }
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {showHintUI && (learnMode || hintShown) && curBest && (
        <div className={`hint-box ${learnMode ? 'learn' : ''}`}>
          <div className="hint-head">
            <span className="hint-title">
              {learnMode ? <Icon name="graduation" size={16} /> : <Icon name="bulb" size={16} />}{' '}
              {learnMode ? t('hint.learnTitle') : t('hint.title')}
            </span>
            {!learnMode && (
              <Button variant="ghost" size="icon" onClick={() => setHintShown(false)} aria-label={t('common.close')}>
                <Icon name="x" size={14} />
              </Button>
            )}
          </div>
          <div className="hint-move">{curBest.notation}</div>
          <ul className="hint-reasons">
            {curBest.reasons.map((r, i) => (
              <li key={i}>{t(r.key, r.params)}</li>
            ))}
          </ul>
        </div>
      )}
      {showHintUI && !learnMode && !hintShown && (
        <Button variant="default" className="fixed left-4 bottom-4 z-[55]" aria-label={t('hint.button')} onClick={() => setHintShown(true)}>
          <Icon name="bulb" size={16} /> {t('hint.button')}
        </Button>
      )}
      {/* Kup danismani: SADECE ogrenme modunda ve ogrenme mesajinin ciktigi sol-alt konumda */}
      {learnMode && humanCanDouble && cubeHint?.kind === 'offer' && (
        <div className="cube-hint-fixed">
          <div
            className={`cube-advice ${cubeHint.action === 'no-double' ? 'muted' : 'ok'}`}
          >
            <Icon name="bulb" size={14} />
            {t(`cube.adv.${cubeHint.action}`)} · {t('cube.win')}{' '}
            {cubeHint.winPct.toFixed(0)}%
          </div>
        </div>
      )}
      {/* Hamburger butonu .game-area içinde board'un sağ kenarına taşındı (aşağı) */}
      <GameMenu
        open={gameMenuOpen}
        showPip={showPip}
        setShowPip={setShowPip}
        showAnalysis={showAnalysis}
        setShowAnalysis={setShowAnalysis}
        learnMode={learnMode}
        setLearnMode={setLearnMode}
        showLivePr={showLivePr}
        setShowLivePr={setShowLivePr}
        animOn={animOn}
        toggleAnim={() => setAnimOn((v) => !v)}
        soundOn={soundOn}
        toggleSound={toggleSound}
        soundVol={soundVol}
        setSoundVol={setSoundVol}
        canAnalyze={botMatch}
        canResign={!matchOver}
        loggedIn={!!user}
        onTournaments={online && !matchOver ? undefined : menuProps.onTournaments}
        onFriends={online && !matchOver ? undefined : menuProps.onFriends}
        onShop={online && !matchOver ? undefined : menuProps.onShop}
        onLobby={() => {
          if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
          if (online) handleLeaveRoom()
          else setHome(true)
        }}
        onResign={() => setResignOpen(true)}
        onClose={() => setGameMenuOpen(false)}
      />

      <main className="main game-scene">
      <div className="game-area">
        {isTournWaiting && (
          <div className="tourn-wait-banner" role="status" aria-live="polite">
            <span className="tourn-wait-spin" aria-hidden="true" />
            <div className="tourn-wait-txt">
              <strong>{t('mp.tournWaiting')}</strong>
              <span>{t('tourn.autoWinIn', { n: tournWaitSec })}</span>
            </div>
            <span className="tourn-wait-count tnum">{tournWaitSec}</span>
          </div>
        )}
        {/* Maç ID (sol üst): oynanan maçın kimliği — admin panelde bu ID ile bulunur.
            KOPYALANABİLİR: tıklayınca kodu panoya kopyalar (kopyalandı -> aksan renk + tik). */}
        {recordUid && (
          <button
            type="button"
            className={`match-id-hud${matchCodeCopied ? ' copied' : ''}`}
            title={online && !room?.bot ? t('game.copyWatchLink') : t('game.copyMatchId')}
            aria-label={online && !room?.bot ? t('game.copyWatchLink') : t('game.copyMatchId')}
            onClick={() => {
              // Online maç: tam İZLEME linki (paylaş -> canlı izlensin). Yerel/bot: salt ID (admin arar).
              const text = online && !room?.bot ? `${window.location.origin}/izle/${recordUid}` : recordUid
              navigator.clipboard
                ?.writeText(text)
                .then(() => {
                  setMatchCodeCopied(true)
                  window.setTimeout(() => setMatchCodeCopied(false), 1500)
                })
                .catch(() => {})
            }}
          >
            <span className="match-id-hud__label">{t('log.matchId')}</span>
            <span className="match-id-hud__code">#{recordUid}</span>
            <Icon name={matchCodeCopied ? 'check' : 'copy'} size={13} />
          </button>
        )}
        {/* Board flip'lendiginde (yerel oyuncu siyah) kartlar da cevrilir: SEN hep altta */}
        <Sidebar
          top={flipBoard ? bottomInfo : topInfo}
          bottom={flipBoard ? topInfo : bottomInfo}
          length={match.target}
          stake={(potRef.current || stakeRef.current) * (isMoneyGame ? match.cube.value : 1)}
          crawford={match.isCrawford && !gameEnd}
        />
        {clockOn && (
          <ClockStack
            active={
              gameWon || gameEnd || opening
                ? null
                : cubePending // kup karari bekleniyor -> vurgu yanitlayanda (saati o harciyor)
                  ? opponent(cubePending)
                  : turnStart.turn
            }
            delay={clock.delay}
            white={clock.white}
            black={clock.black}
            final={FINAL_STAGE}
            flip={flipBoard}
            topScore={flipBoard ? match.score.white : match.score.black}
            bottomScore={flipBoard ? match.score.black : match.score.white}
          />
        )}
        <Board
          state={boardDisplay}
          checkerSkin={user?.checker ? (CHECKER_BY_ID[user.checker] ?? null) : null}
          selectableFroms={selectableFroms}
          targets={targets}
          selectedFrom={selectedFrom}
          onSelectFrom={handleSelectFrom}
          onSelectTarget={handleSelectTarget}
          onDragFrom={handleDragFrom}
          onDragDrop={handleDragDrop}
          pipTop={pipTop}
          pipBottom={pipBottom}
          cube={match.cube}
          crawford={match.isCrawford}
          classic={!!match.classic}
          centerLeft={centerLeft}
          centerRight={centerRight}
          centerMain={centerMain}
          flip={flipBoard}
          mirror={boardMirror}
          swapStones={swapStones}
          showPip={showPip}
          watermark={ALL_THEMES.find((x) => x.id === boardTheme)?.watermark}
          showLogo={ALL_THEMES.find((x) => x.id === boardTheme)?.rarity !== 'country'}
          pointTexts={ALL_THEMES.find((x) => x.id === boardTheme)?.pointTexts}
        />
        {showAnalysis && botMatch && (
          <AnalysisPanel
            loading={analysisLoading}
            currentProbs={currentProbs}
            ranked={ranked}
            gnubgMoves={gnubgMoves}
            player={turnStart.turn}
            lastError={lastError}
            boardState={analysisBoard}
          />
        )}
        {/* AFK son-15sn uyarisi (sunucu-otoriter): yalniz sirasi gelen YEREL oyuncuya */}
        {online && afkLeft != null && srvActive === myColor && !gameEnd && !matchOver && (
          <div className="afk-warn" role="alert" aria-live="assertive">
            <Icon name="warning-circle" size={15} />
            <span>{t('afk.warn', { n: afkLeft })}</span>
          </div>
        )}
        {/* Oyun menüsü hamburger — board'un sağ kenarına bitişik (flex öğesi) */}
        <button
          className="game-ham"
          onClick={() => setGameMenuOpen((v) => !v)}
          aria-label={t('gm.title')}
          title={t('gm.title')}
        >
          <Icon name="menu" size={22} />
        </button>
      </div>

      <div className="status">
        {/* Alt anlatım satırı ("Beyaz oynuyor. Zarlar…", "hamle yok — geçiliyor…",
           "rakip oynuyor") KALDIRILDI: board zaten zar+sırayı görsel veriyor, bu alan
           board'a bırakıldı. Yalnız Crawford yazıyla kalır (küp neden yok). */}
        {match.isCrawford && !gameEnd && <span className="crawford">{t('status.crawford')}</span>}
      </div>
      </main>

      {online && room && (
        <Chat
          messages={chat}
          mySlot={room.slot}
          onSend={handleSendChat}
          canText={premium}
          onUpgrade={() => setMemOpen(true)}
          loggedIn={!!user}
          onLogin={() => setShowAuth(true)}
          behindMenu={gameMenuOpen}
          notice={chatNotice}
        />
      )}
      {authModal}
      {menuPages}
      {menuOverlays}

      {gameEnd && matchOver && mWinner && (
        <MatchResult
          winnerName={mWinner === 'white' ? bottomInfo.name : topInfo.name}
          loserName={mWinner === 'white' ? topInfo.name : bottomInfo.name}
          winnerAvatar={mWinner === 'white' ? bottomInfo.avatarUrl : topInfo.avatarUrl}
          loserAvatar={mWinner === 'white' ? topInfo.avatarUrl : bottomInfo.avatarUrl}
          winnerColor={mWinner}
          loserColor={opponent(mWinner)}
          winnerScore={match.score[mWinner]}
          loserScore={match.score[opponent(mWinner)]}
          classic={!!match.classic} // KLASIK TAVLA: PR satirlari (hata/pul/kup) gizlenir
          winnerPr={prShown(mWinner)}
          loserPr={prShown(opponent(mWinner))}
          analyzing={prAnalyzing}
          oppAnalyzing={oppPrPending}
          analyzingBoth={mode === 'pvb'}
          winnerCheckerPr={prCheckerShown(mWinner)}
          winnerCubePr={prCubeShown(mWinner)}
          loserCheckerPr={prCheckerShown(opponent(mWinner))}
          loserCubePr={prCubeShown(opponent(mWinner))}
          winnerBand={t(prBand(prShown(mWinner)))}
          loserBand={t(prBand(prShown(opponent(mWinner))))}
          winnerLuck={luckOf(mWinner)}
          loserLuck={luckOf(opponent(mWinner))}
          winnerLuckPct={luckPctOf(mWinner)}
          loserLuckPct={luckPctOf(opponent(mWinner))}
          coinAmount={coinDelta == null ? null : Math.abs(coinDelta)}
          winnerCoin={coinPair?.won ?? null}
          loserCoin={coinPair?.lost ?? null}
          ratingBefore={ratingChange?.before ?? null}
          ratingAfter={ratingChange?.after ?? null}
          ratingIsWinner={prHumanColor === mWinner}
          // Puansız maç açıklaması (kılıç casual / günlük limit / bot). Bot maçında not gösterme
          // (rakip AI olduğu zaten belli) -> yalnız insan maçında.
          ratingReason={botMatch ? null : (ratingChange?.reason ?? null)}
          friendlyLimit={ratingChange?.limit ?? null}
          oppRating={mode === 'pvb' ? 900 + difficulty * 100 : (room?.oppRating ?? null)}
          // Rakip rating değişimi: online PUANLI maçta Elo sıfır-toplamlı -> -(kendi delta). Bot
          // maçında (pvb veya online-bot) AI'nın kalıcı rating'i yok -> null. Arkadaş/kılıç + turnuva
          // dahil TÜM online insan maçları puanlı olduğundan botMatch dışında hep göster (TUTARLI).
          oppRatingDelta={
            !botMatch && ratingChange
              ? -Math.round(ratingChange.after - ratingChange.before)
              : null
          }
          // BOT ODASI: rövanş consensus'ü (mine/theirs 'yes') İNSAN-İNSAN içindir; bot hiç 'yes'
          // demez -> "Rakip bekleniyor…" sonsuza dek takılır. Bot maçında null geçip basit "Rövanş"
          // butonunu göster (idle) -> onRematch anında yeni bot odası açar (bot her zaman kabul).
          rematchState={online && !room?.bot ? rematch : null}
          // TURNUVA MACI: rovans yok; "Turnuva Lobisi" -> turnuva detay sayfasi.
          onTournamentLobby={
            online && tournRoom && room?.code === tournRoom.code
              ? () => {
                  const tid = tournRoom.tid
                  handleLeaveRoom()
                  setMode('pvb')
                  setTournDetailId(tid)
                  setTournDetailSlug(String(tid))
                  setTournOpen(true)
                }
              : undefined
          }
          onRematch={() => {
            // BOT RÖVANŞI: bot "kabul" akışı YOK (openRematchRoom iki doğrulanmış user ID ister ->
            // bot odasında açılmaz). Rövanş = AYNI seviye/uzunlukla ANINDA yeni bot odası.
            if (online && room?.bot) {
              void handleCreateBotRoom(match.target, room.botLevel ?? difficulty)
              return
            }
            if (online) {
              // ROVANS = ayni rakip, ayni ayarlar. Odadan CIKMIYORUZ: teklif sunucuya gider,
              // rakip de kabul edince sunucu yeni odayi acar ve poll ikimizi de oraya sokar.
              if (!room) return
              rematchSentRef.current = 'yes'
              setRematch((r) => ({ ...r, mine: 'yes' }))
              rematchRoom(room.code, true)
                .then((res) => {
                  // İki taraf da kabul ettiyse sunucu YENİ oda kodunu POST yanıtında döner ->
                  // ANINDA gir. Poll'a GÜVENME: maç bitince (saat durunca) show 204 döndüğü için
                  // kod poll ile hiç gelmiyordu -> kabul eden maça yönlenmiyordu (bug).
                  if (res?.rematch?.code) void enterRematchByCode(res.rematch.code)
                })
                .catch((err) => {
                  // Hatayi YUTMA: teklif gitmediyse buton "hicbir sey yapmiyor" gorunuyordu
                  // (or. migration kosmadiysa sunucu 503 "Rövanş bu sunucuda kapalı." doner).
                  rematchSentRef.current = null
                  setRematch((r) => ({ ...r, mine: null }))
                  notify.error((err as { message?: string })?.message || t('mp.connError'))
                })
            } else {
              handleNewMatch(match.target, mode)
            }
          }}
          onRematchDecline={() => {
            if (!room) return
            rematchSentRef.current = 'no'
            setRematch((r) => ({ ...r, mine: 'no' }))
            rematchRoom(room.code, false).catch((err) => {
              rematchSentRef.current = null
              setRematch((r) => ({ ...r, mine: null }))
              notify.error((err as { message?: string })?.message || t('mp.connError'))
            })
          }}
          onNewMatch={() => setSetup('pvb')}
          onHome={() => (online ? handleLeaveRoom() : setHome(true))}
          hasReport={matchLog.length > 0}
          onAnalysis={() => setResultView('analysis')}
          matchCode={online ? (room?.code ?? null) : null}
          endReason={online ? endReason : null}
        />
      )}

      {/* HAKEM=gnubg: gnubg analizi gelene kadar loader (wildbg log GÖSTERME). gnubg yoksa/
          başarısızsa yerel matchLog'a düşülür (analiz yine açılır). */}
      {resultView && analysisBusy && !analysisGnubgLog && (
        <div className="register-overlay modal" role="dialog" aria-modal="true">
          <div className="register-card" style={{ textAlign: 'center', padding: '30px' }}>
            <span className="btn-spinner" aria-hidden="true" /> {t('mr.prCalculating')}
          </div>
        </div>
      )}
      {resultView && !(analysisBusy && !analysisGnubgLog) && (
        <MatchReport
          mode={resultView}
          log={analysisGnubgLog ?? (matchLog as unknown as LogEntry[])}
          pr={prShown(prHumanColor)}
          humanColor={prHumanColor}
          matchLength={match.target}
          whiteName={whiteName}
          blackName={blackName}
          gameResults={gameResultsRef.current}
          matchResult={(() => {
            const w = matchWinner(match)
            return w ? { winner: w, score: { white: match.score.white, black: match.score.black } } : undefined
          })()}
          matchUid={recordUid ?? gameRecordRef.current?.uid ?? undefined}
          luck={{
            white: { mwc: luckPctOf('white'), cost: luckEmgOf('white'), jokers: jokersOf('white') },
            black: { mwc: luckPctOf('black'), cost: luckEmgOf('black'), jokers: jokersOf('black') },
          }}
          authPr={{
            // TEK-KAYNAK PR: Maç Özeti Performans/Pul/Küp'ü sunucu-otoriter (gnubg) serverPr'dan göster
            // (log'dan yeniden hesaplama sapması olmasın) -> sonuç kartı/analiz/istatistik AYNI değer.
            white: { pr: prShown('white'), checker: prCheckerShown('white'), cube: prCubeShown('white') },
            black: { pr: prShown('black'), checker: prCheckerShown('black'), cube: prCubeShown('black') },
          }}
          onClose={() => setResultView(null)}
        />
      )}

      {resignOpen && (
        <div className="register-overlay modal" role="dialog" aria-modal="true">
          <div className="register-card resign-card">
            <h2><Icon name="flag" size={20} /> {t('resign.title')}</h2>
            {/* SİSTEM pes değeri (1/2/3) OYUN DURUMUNDAN belirlenir; kullanıcı 1/2/3 SEÇMEZ.
                Yalnız geçerli teslim sonucu + rakibin kazanacağı puan gösterilir. */}
            <div className="resign-auto">
              {mode === 'pvp' && (
                <div className="resign-help">{t('resign.who', { name: pName(resignLoser) })}</div>
              )}
              <div className="resign-help">{t('resign.about')}</div>
              <b className={`resign-kind m${resignVal}`}>
                {resignWinsMatch ? t('resign.oppWinsMatch') : t('resign.oppGets', { n: resignPoints })}
              </b>
            </div>
            {/* TEK ana buton: geçerli teslim sonucu (küp × sistem-değeri). */}
            <Button variant="destructive" onClick={() => handleResign(resignType)}>
              <Icon name="flag" /> {t('resign.confirmPts', { n: resignPoints })}
            </Button>
            <Button variant="secondary" onClick={() => setResignOpen(false)}>
              {t('reg.cancel')}
            </Button>
            {/* Match play: ayrı ikincil seçenek olarak "Maçtan Çekil" (skordan bağımsız). */}
            {match.target > 1 && (
              <>
                <Button variant="secondary" onClick={handleQuitMatch}>
                  <Icon name="home" /> {t('resign.quitMatch')}
                </Button>
                <div className="resign-quit-note">{t('resign.quitMatchDesc')}</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* KURŞUN GEÇİRMEZ: board 14sn+ yüklenmediyse GÖRÜNÜR kurtarma — oyuncu asla sessiz takılmaz. */}
      {startStuck && online && room?.code && !matchOver && (
        <div
          className="register-overlay modal"
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 2147483600 }}
        >
          <div className="register-card" style={{ textAlign: 'center', maxWidth: 380 }}>
            <Icon name="warning-circle" size={30} />
            <h2 style={{ margin: '8px 0 4px' }}>{t('match.stuckTitle')}</h2>
            <p style={{ opacity: 0.8, marginBottom: 14 }}>{t('match.stuckDesc')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                variant="default"
                onClick={() => {
                  setStartStuck(false)
                  boardBadSinceRef.current = null
                  startHardResyncRef.current = false
                  invalidBoardResyncRef.current = 0
                  const tm = tournMatchRef.current
                  if (tm) void handlePlayTournamentMatch(tm.tid, { key: tm.matchKey }, tm.oppId)
                  else appliedServerVersionRef.current = -1
                }}
              >
                <Icon name="refresh" size={16} /> {t('match.stuckRetry')}
              </Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                {t('match.stuckReload')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
