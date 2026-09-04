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
