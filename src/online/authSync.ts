// Sunucu-otoriter (Faz 2) istemci SENKRON kararları — SAF ve test edilebilir.
//
// Amaç: App.tsx içindeki online senkron mantığının hata yapan çekirdek KARARLARINI buraya
// çıkarmak. Böylece iki-istemci senkronu (desync/tur/açılış) gerçek kod üzerinden vitest ile
// deterministik test edilir (tarayıcı/stack gerekmez). App.tsx bu fonksiyonları KULLANIR;
// test de bunları ÇAĞIRIR -> "test yeşil ama canlıda bozuk" (mirror) tuzağı olmaz.
//
// Tasarım ilkesi: authoritative modda SUNUCU tek gerçek kaynak. İstemci yalnız aksiyon gönderir
// (roll/move/cube/resign) ve sunucu durumunu (poll/response) yansıtır; optimistik yerel akış yok.

import type { Player } from '../engine/types'

/** Poll/reduce kararları için istemcinin yerel durumunun MİNİMAL görünümü. */
export interface SyncLocal {
  turn: Player // turnStart.turn (yerel tahtanın sırası)
  diceCount: number // turnStart.dice.length
  playedCount: number // bu turda oynanan adım sayısı
  appliedServerVersion: number // uygulanan son server_version
}

/** Poll yanıtının senkronu ilgilendiren alanları. */
export interface ServerSyncView {
  authoritative?: boolean
  server_state?: { turn?: Player; dice?: number[] } | null
  server_version?: number
  // Açılış kalkanı (openingNeedsResync) için: sunucuda bu oyunun açılış eli atıldı mı.
  server_match?: { opened?: boolean; done?: boolean } | null
}

/**
 * Poll: gelen sunucu durumunu YEREL tahtaya uygulamalı mıyız?
 *  - authoritative + server_state var + server_version İLERLEDİ, VE
 *  - KENDİ mid-move'umu ezmiyoruz.
 *
 * KRİTİK: "mid-move" YALNIZ KENDİ TURUMDA geçerlidir. Aksi halde (ör. açılışta başlayan-OLMAYAN
 * tarafın tahtasında da açılış zarı görünür -> diceCount>0) poll yanlışlıkla bloklanır, rakibin
 * hamlesi hiç gelmez -> KALICI DESYNC (iki taraf da kendi sırası sanıp saat sayar). Rakip
 * turundaysak DAİMA senkronla. (Bu koşulun sıra-sahipliği kontrolü olmadan yazılması bir
 * canlı bug'a yol açtı; test bunu koruyor.)
 */
export function shouldApplyServerState(local: SyncLocal, rv: ServerSyncView, myColor: Player): boolean {
  if (!rv.authoritative || !rv.server_state) return false
  if ((rv.server_version ?? 0) <= local.appliedServerVersion) return false
  const myTurn = local.turn === myColor
  const midMove = myTurn && (local.playedCount > 0 || local.diceCount > 0)
  return !midMove
}

/**
 * Zar (serverRoll) yanıtını yerel tahtaya optimistik uygulamalı mıyız, yoksa poll'a mı bırakmalı?
 *  - opening: sunucu adil açılışı yaptı (starter + iki zar) -> UYGULA (taze tahta kur).
 *  - reused: sunucuda zaten verilmiş el -> UYGULAMA (poll doğru turn+zar+opened getirir; reused
 *    starter taşımaz, açılışta yanlış turn'e yol açar).
 *  - normal: yeni el -> UYGULA (kendi turumda zar).
 */
export type RollAction = 'apply-opening' | 'apply-normal' | 'defer-to-poll'
export function rollResponseAction(resp: { opening?: boolean; reused?: boolean; starter?: Player }): RollAction {
  if (resp.opening && (resp.starter === 'white' || resp.starter === 'black')) return 'apply-opening'
  if (resp.reused) return 'defer-to-poll'
  return 'apply-normal'
}

/** Sunucu maç durumunun (server_match) senkronu ilgilendiren alanları. */
export interface ServerMatchView {
  target?: number
  score?: { white?: number; black?: number }
  cube?: { value?: number; owner?: Player | null; pending?: Player | null }
  done?: boolean
  winner?: Player | null
  opened?: boolean
  // Bu OYUNDA tamamlanan tur sayisi (sunucu sayar). Kup hakki icin sart: ilk el (acilis)
  // oynanmadan kup teklif edilemez. Otoriter modda istemcinin yerel sayaci ARTMAZ
  // (commitTurn sunucuya devreder) -> bu alan olmadan kup butonu HIC cikmaz.
  turns?: number
  crawford?: boolean
}

/** Maç bitti mi + kazanan. */
export interface MatchEndInfo {
  matchOver: boolean
  winner: Player | null
}

/**
 * Maç-sonu durumu: kazanan SUNUCU skorundan TÜRETİLİR (hedefe ulaşan). İki istemci de aynı
 * (senkron) skoru aldığından İKİSİ de aynı kazananı hesaplar -> "kazandım ama kayıp yazıldı" /
 * "iki taraf da kazandı" sınıfı bug OLMAZ. settle/rating zaten backend'de server_match'ten
 * (forge-red); bu yalnız istemci GÖSTERİMİ. sm.done/sm.winner ile tutarlı olmalı (test eder).
 */
export function matchEndFromServer(sm: ServerMatchView): MatchEndInfo {
  const t = sm.target ?? 1
  const w = sm.score?.white ?? 0
  const b = sm.score?.black ?? 0
  const winner: Player | null = w >= t ? 'white' : b >= t ? 'black' : null

  return { matchOver: winner !== null, winner }
}

/** Yerel maç durumunun otoriterden türetilen alanları (App.tsx applyServerBoard bunu uygular). */
export interface LocalMatchState {
  target: number
  score: { white: number; black: number }
  cubeValue: number
  cubeOwner: Player | null
  cubePending: Player | null
  turns: number // bu oyunda tamamlanan tur sayisi (App: setTurnsPlayed -> kup hakki + auto-roll)
  crawford: boolean // Crawford oyunu mu (kup YASAK) — sunucu da reddeder, istemci butonu gizler
}

/**
 * server_match -> yerel maç durumu (skor + KÜP). App.tsx `applyServerBoard` bunu KULLANIR;
 * test bunu çağırır. Küp değeri/sahibi/bekleyen-teklif SUNUCUDAN gelir (forge edilemez);
 * istemci yalnız yansıtır. Böylece küp senkronu (offer -> pending -> take/drop) tek yerde + testli.
 */
export function serverMatchToLocal(sm: ServerMatchView, prevTarget: number): LocalMatchState {
  return {
    target: sm.target ?? prevTarget,
    score: { white: sm.score?.white ?? 0, black: sm.score?.black ?? 0 },
    cubeValue: sm.cube?.value ?? 1,
    cubeOwner: sm.cube?.owner ?? null,
    cubePending: sm.cube?.pending ?? null,
    turns: Math.max(0, sm.turns ?? 0),
    crawford: !!sm.crawford,
  }
}

/**
 * Yeni oyun açılışı tetiklensin mi? (applyServerBoard: !done iken opened===false -> 'roll',
 * değilse null.) done iken 'keep' (maç sonu ekranı; opening'e dokunma).
 */
export function openingStateFromMatch(sm: ServerMatchView): 'roll' | null | 'keep' {
  if (sm.done) return 'keep'
  return sm.opened === false ? 'roll' : null
}

/**
 * "Açılış zarı atılıyor…" KALKANI: istemci hâlâ açılış overlay'inde ama SUNUCUDA oyun ZATEN
 * açılmışsa (opened=true ya da server_state'te zar var) otoriter durum KOŞULSUZ uygulanmalıdır.
 *
 * NEDEN: açılışı sunucuda ilk tetikleyen taraf yanıtı (opening+starter) uygular; DİĞER taraf
 * reused/409 alıp poll'a bırakır. O poll tek bir muhasebe hatasında (surum ref'i ileride kalmis,
 * apply sirasinda atilan bir istisna, applyServerBoard'i ezen bir yarış) BİR DAHA uygulanmaz ve
 * overlay SONSUZA KADAR kalır — rakip normal oynarken saat de akmaya devam eder (canli bug).
 * Bu kalkan sebebi ne olursa olsun takılmayı en fazla bir poll (1.2sn) sürdürür: çağıran
 * appliedServerVersion'i sıfırlar ve mid-move korumasını atlar (açılışta oynanan hamle YOKTUR).
 */
export function openingNeedsResync(showingOpening: boolean, rv: ServerSyncView): boolean {
  if (!showingOpening) return false
  if (!rv.authoritative || !rv.server_state) return false
  if (rv.server_match?.done) return false // maç bitti -> açılış değil, sonuç ekranı
  return rv.server_match?.opened === true || (rv.server_state.dice?.length ?? 0) > 0
}

/**
 * Online'da istemci "hazır" mı (tahta etkileşimi açılabilir)? p2 legacy'de rakibin ilk
 * snapshot'ını (oppStarted) bekler; ama AUTHORITATIVE modda o snapshot applyServerBoard'dan gelir
 * (applyOnlineState değil) -> oppStarted asla set olmaz -> p2 HİÇ oynayamaz (yaşanan KRİTİK bug).
 * authoritative'de sunucu turu (myTurn) zaten gate'ler; p2 beklemeye gerek yok -> hazır say.
 */
export function isOnlineReady(p: {
  online: boolean
  status?: string
  slot?: 'p1' | 'p2'
  oppStarted: boolean
  authoritative?: boolean
}): boolean {
  if (!p.online) return true
  if (p.status !== 'playing') return false
  return p.slot === 'p1' || p.oppStarted || !!p.authoritative
}

/**
 * Uygulanan server_version BASKA ODADAN mi kalmis? Her oda kendi server_version'ini 0'dan
 * baslatir; oyuncu ayni sekmede ikinci maca girince (rovans / yeni eslesme) onceki odadan
 * kalan yuksek deger, poll'un "surum ilerledi mi" kontrolunu KALICI olarak dusurur ->
 * otoriter durum bir daha ASLA uygulanmaz (acilis yarisini kaybeden taraf "Acilis zari
 * atiliyor..." ekraninda sonsuza kadar takilir). resetRoomSync giris noktalarinda sifirliyor;
 * bu, kacan bir yol kalirsa kendini onaran emniyet subabi.
 *
 * KIMLIK ODA KODUDUR, SURUM SIRASI DEGIL. Onceki surum "sunucu surumu bizimkinin GERISINDE"
 * diye karar veriyordu ve bu CANLI BIR BUG'A yol acti: ayni odada surumun geride gelmesi eski
 * oda demek DEGILDIR — sunucu surumu oda icinde yalniz ARTAR (RoomController: server_version+1)
 * — ucusta kalmis ESKI bir poll yaniti demektir. Tipik akis: poll GET yola cikar (surum N),
 * oyuncu hamlesini onaylar, serverMove N+1 doner ve uygulanir, sonra o eski GET yanit verir
 * (N < N+1) -> "eski oda" sanilip ref -1'e cekilir -> N'lik ESKI durum tahtaya UYGULANIR:
 * oyuncunun ONAYLADIGI HAMLE GERI ALINIR. Tekrar oynayip onaylayinca sunucu artik N+1'de
 * oldugu icin "Sira sende degil." / "Once zar at." (409) doner.
 *
 * Dogru kural: ref'i YALNIZ oda degistiginde sifirla. Ayni odada geride gelen surumu
 * shouldApplyServerState zaten (surum ilerlemedi diye) eler.
 */
export function serverSyncRoomChanged(appliedRoom: string | null, currentRoom: string | null): boolean {
  if (!currentRoom) return false // oda yok -> karar verme
  return appliedRoom !== currentRoom
}
