import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'

type Side = 'white' | 'black'

interface Props {
  winnerName: string
  loserName: string
  winnerAvatar?: string | null
  loserAvatar?: string | null
  winnerColor: Side
  loserColor: Side
  winnerScore: number
  loserScore: number
  winnerPr: number | null
  loserPr: number | null
  analyzing?: boolean // HAKEM=gnubg: insanın PR'ı gnubg ile hesaplanıyor (async) -> sayı yerine "…"
  analyzingBoth?: boolean // pvb: tek gnubg job İKİ tarafı da (insan+bot) hesaplar -> ikisinde de "…"
  oppAnalyzing?: boolean // online: RAKİBİN PR'ı ayrı/geç gelir -> gelene kadar onun hücresinde de "…" (boş — değil)
  // GERÇEK PR ilerleme yüzdesi (0-100): gnubg'ye giden pozisyonların analiz oranı (matchGnubgPr poll'u).
  // null -> gerçek veri yok (online rakip tarafı / eski maç) -> zaman-tabanlı tahmine düşülür.
  progressPct?: number | null
  // XG kırılım: checker-yalnız + küp-yalnız PR (overall = winnerPr/loserPr). null -> —.
  winnerCheckerPr?: number | null
  winnerCubePr?: number | null
  loserCheckerPr?: number | null
  loserCubePr?: number | null
  winnerBand: string
  loserBand: string
  // Şans = yalnız Tavlai Luck V1 (gnubg NATIVE MWC-luck, YÜZDE), BAĞIMSIZ per-oyuncu. İKİSİ de
  // doluysa gösterilir; değilse loader/"—" (istemci HAM luck fallback KALDIRILDI — güvenilmezdi).
  winnerLuckPct?: number | null
  loserLuckPct?: number | null
  // Bahisli macta coin transfer tutari (mutlak); kazanan +, kaybeden -. null = bahissiz
  coinAmount: number | null
  // Komisyon (rake): kazananin ALDIGI (won) ve kaybedenin ODEDIGI (lost) ayri (asimetrik). İkisi
  // de doluysa bunlar gosterilir (kazanan +won / kaybeden -lost); null -> coinAmount simetrik fallback.
  winnerCoin?: number | null
  loserCoin?: number | null
  // Rating degisimi (giris yapmis insan icin). Hangi tarafta gosterilecegi:
  ratingBefore: number | null
  ratingAfter: number | null
  ratingIsWinner: boolean // true: rating kazanan tarafta
  oppRating: number | null // rakip rating (online rakip / AI zorluga gore) — maç ÖNCESİ
  // Rakip rating değişimi (online puanlı maçta). Elo sıfır-toplamlı -> = -(kendi delta). null ->
  // gösterme (pvb/AI kalıcı rating yok, veya puansız). Her iki ekranda TUTARLI (deterministik).
  oppRatingDelta?: number | null
  // Puansız maç açıklaması: neden rating/PR değişmedi. null -> puanlı (not gösterilmez).
  ratingReason?: 'bot' | 'unrated' | 'guest' | 'friendly_cap' | 'friendly' | 'casual' | null
  friendlyLimit?: number | null // 'friendly_cap' metninde "limit (N)" göstermek için
  onNewMatch: () => void
  onRematch: () => void
  // ROVANS (yalniz online): iki tarafin cevabi. null -> offline, dogrudan yeniden baslar.
  rematchState?: { mine: string | null; theirs: string | null; code: string | null } | null
  onRematchDecline?: () => void
  onHome: () => void
  /** Turnuva maci: verilirse rovans/yeni mac gizlenir, "Turnuva Lobisi" gosterilir. */
  onTournamentLobby?: () => void
  onAnalysis: () => void
  hasReport: boolean
  // Zar Kontrol (provably-fair): online puanlı/paralı/bot maçında sunucu zarını doğrula. undefined -> gizli.
  onDiceCheck?: () => void
  matchCode?: string | null // online maç kodu (kopyalanabilir; hata bildirimi/destek için)
  // Maç saat/terk ile bittiyse sebep: 'TIMEOUT' | 'AFK_TIMEOUT' | 'ABANDON'. null -> normal bitiş
  // (pul bitirme / pes). Kaybeden "kimse çıkmadan kendi kendine bitti" sanmasın diye gösterilir.
  endReason?: string | null
  // İZLEYİCİ/MİSAFİR modu: oyuncuya-özel aksiyonlar (rövanş/yeni maç/turnuva lobisi) gizlenir,
  // yalnız Analiz/İstatistik + Kapat kalır. Rating değişimi yok -> iki tarafın GÜNCEL rating'i
  // doğrudan gösterilir (winnerRating/loserRating). coin/rövanş prop'ları null geçilir.
  spectator?: boolean
  winnerRating?: number | null
  loserRating?: number | null
  // KLASIK TAVLA: PR satırları (Hata Oranı / Pul Oyunu PR / Küp PR) + "PR hesaplanıyor" notu gizlenir.
  classic?: boolean
  // Küp hiç olmayan maç (1 puanlık, para değil): Küp PR satırı gizlenir ("—" bile yazılmaz).
  noCube?: boolean
}

function Avatar({ url, color }: { url?: string | null; color: Side }) {
  return (
    <div className={`mr-avatar ${color}`}>
      {url ? <img src={url} alt="" /> : <span>{color === 'white' ? '🧑‍🚀' : '🐱'}</span>}
    </div>
  )
}

export default function MatchResult({
  winnerName,
  loserName,
  winnerAvatar,
  loserAvatar,
  winnerColor,
  loserColor,
  winnerScore,
  loserScore,
  winnerPr,
  loserPr,
  analyzing = false,
  analyzingBoth = false,
  oppAnalyzing = false,
  progressPct = null,
  winnerBand,
  loserBand,
  winnerLuckPct,
  loserLuckPct,
  coinAmount,
  winnerCoin,
  loserCoin,
  ratingBefore,
  ratingAfter,
  ratingIsWinner,
  oppRating,
  oppRatingDelta,
  ratingReason,
  friendlyLimit,
  onNewMatch,
  onRematch,
  rematchState,
  onRematchDecline,
  onHome,
  onTournamentLobby,
  onAnalysis,
  hasReport,
  onDiceCheck,
  matchCode,
  endReason,
  spectator = false,
  winnerRating,
  loserRating,
  classic = false,
}: Props) {
  const { t } = useT()
  const [codeCopied, setCodeCopied] = useState(false)
  const copyCode = () => {
    if (!matchCode) return
    navigator.clipboard
      ?.writeText(matchCode)
      .then(() => {
        setCodeCopied(true)
        window.setTimeout(() => setCodeCopied(false), 1500)
      })
      .catch(() => {})
  }
  // ROVANS asamasi (online): idle = teklif edilebilir, waiting = rakip bekleniyor,
  // asked = rakip istedi (kabul/reddet), done = taraflardan biri reddetti -> buton yok.
  const rmPhase: 'idle' | 'waiting' | 'asked' | 'done' = !rematchState
    ? 'idle'
    : rematchState.theirs === 'no' || rematchState.mine === 'no'
      ? 'done'
      : rematchState.mine === 'yes'
        ? 'waiting'
        : rematchState.theirs === 'yes'
          ? 'asked'
          : 'idle'
  const fmtPr = (p: number | null) => (p == null ? '—' : p.toFixed(2))
  // İnsan tarafı: ratingIsWinner ? kazanan(mr-a) : kaybeden(mr-b). Analiz sürerken o tarafın PR
  // hücrelerinde sayı yerine nabızlı "…" gösterilir (wildbg sayısı ASLA gösterilmez).
  // pvb'de tek gnubg job hem insanı hem botu hesaplar -> analyzingBoth ile İKİ tarafta da loader
  // (aksi halde bot tarafı analiz boyunca "—" gösterip sonra sayıya sıçrardı).
  // Rakip tarafı (= yerel oyuncu OLMAYAN taraf): kazanan-görenin rakibi kaybeden(b), kaybeden-görenin
  // rakibi kazanan(a). Rakip PR'ı ayrı/geç geldiğinden, gelene kadar onun hücresinde de "…" göster
  // (boş "—" değil -> "rakibin PR'ı yok" sanılmaz; birkaç sn sonra dolar).
  const aAnalyzing = (analyzing && (analyzingBoth || ratingIsWinner)) || (oppAnalyzing && !ratingIsWinner)
  const bAnalyzing = (analyzing && (analyzingBoth || !ratingIsWinner)) || (oppAnalyzing && ratingIsWinner)
  // gnubg (sunucu) PR hesaplanana kadar DÖNEN loader; wildbg sayısı ASLA gösterilmez.
  const dots = () => <span className="mr-pr-loader" role="status" aria-label={t('mr.prCalculating')} />
  // İLERLEME YÜZDESİ: ÖNCELİK gerçek per-pozisyon oranı (progressPct — gnubg'ye giden pozisyonların
  // analiz edilen oranı, backend Cache'ten). Gerçek veri YOKSA (online rakip tarafı / eski maç)
  // zaman-tabanlı asimptotik tahmine düşülür. MONOTON (geri gitmez) + ASLA %99'u geçmez; gerçek sonuç
  // gelince (analyzing false) hücre sayıya döner. Adımlar CSS width transition'ıyla yumuşatılır.
  const analyzingAny = aAnalyzing || bAnalyzing
  const progressPctRef = useRef<number | null>(null)
  progressPctRef.current = progressPct ?? null
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!analyzingAny) {
      setProgress(0)
      return
    }
    const start = Date.now()
    const TAU = 12500 // tahmin: ~15sn'de %70, ~30sn'de %91, ~45sn'de %97
    const tick = () => {
      const real = progressPctRef.current
      const est = Math.round(100 * (1 - Math.exp(-(Date.now() - start) / TAU)))
      const candidate = Math.min(99, real != null ? real : est)
      setProgress((p) => Math.max(p, candidate)) // monoton: geri gitme (iki kaynak arası blip yok)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [analyzingAny])

  // Dusuk PR daha iyi -> tac dusuk olanda
  const wBetter = winnerPr != null && loserPr != null && winnerPr <= loserPr
  const lBetter = winnerPr != null && loserPr != null && loserPr < winnerPr

  // Rating: insan (rating raporlanan) tarafi degisimli; diger taraf = rakip (online
  // rakip rating / AI zorluk). ratingIsWinner: insan kazanan tarafta mi.
  const ratingText = (winnerSide: boolean) => {
    // KENDİ tarafı: sunucudan gelen before/after.
    if (winnerSide === ratingIsWinner) {
      if (ratingBefore != null && ratingAfter != null) {
        const d = Math.round(ratingAfter - ratingBefore)
        return d !== 0 ? `${Math.round(ratingAfter)} (${d >= 0 ? '+' : ''}${d})` : String(Math.round(ratingAfter))
      }
      return oppRating != null ? String(Math.round(oppRating)) : '—'
    }
    // RAKİP tarafı: Elo sıfır-toplamlı -> rakip delta = -(kendi delta); after = oppRating(before) + delta.
    // Böylece HER İKİ ekranda iki tarafın rating değişimi TUTARLI görünür (kullanıcı isteği).
    if (oppRating != null) {
      if (oppRatingDelta != null && oppRatingDelta !== 0) {
        return `${Math.round(oppRating + oppRatingDelta)} (${oppRatingDelta >= 0 ? '+' : ''}${oppRatingDelta})`
      }
      return String(Math.round(oppRating))
    }
    return '—'
  }
  // Tavlai Luck V1: gnubg NATIVE MWC-luck (%) — İKİSİ de hazırsa gösterilir (BAĞIMSIZ per-oyuncu,
  // sıfır-toplam DEĞİL; her oyuncu kendi zarlarından). HAZIR DEĞİLSE ASLA ham/istemci luck'ına
  // DÜŞME: ham değer yetkili gnubg ile TERS işaret verip "şanslıydım ama kaybettim" yanılgısı
  // yaratıyordu. Hazır olana kadar render'da loader; analiz yoksa "—" (bkz. aşağıdaki Şans satırı).
  const useGnubgPct = winnerLuckPct != null && loserLuckPct != null
  const luckAnalyzing = analyzing || analyzingBoth || oppAnalyzing
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`
  const wLuckText = useGnubgPct ? fmtPct(winnerLuckPct as number) : null
  const lLuckText = useGnubgPct ? fmtPct(loserLuckPct as number) : null
  const wLuckPos = useGnubgPct ? (winnerLuckPct as number) >= 0 : false
  const lLuckPos = useGnubgPct ? (loserLuckPct as number) >= 0 : false
  // Komisyon (asimetrik): kazanan +won / kaybeden -lost. Yoksa simetrik coinAmount.
  const asymCoin = winnerCoin != null && loserCoin != null
  const fmtCoins = (isWinner: boolean) => {
    if (asymCoin) return isWinner ? `+${winnerCoin} GC` : `-${loserCoin} GC`
    return coinAmount == null ? '—' : `${isWinner ? '+' : '-'}${coinAmount} GC`
  }
  // Kazanandan site komisyonu: kaybeden TAM potu (loserCoin) öder, kazanan komisyon sonrası
  // (winnerCoin) alır -> fark = komisyon. Pot başına açıklayıcı not (kullanıcı neden +/- eşit
  // değil görsün). loserCoin = pot; pct = komisyon/pot. Yalnız para maçında (asymCoin) + >0.
  const commission = asymCoin && winnerCoin != null && loserCoin != null ? loserCoin - winnerCoin : 0
  const commissionPct = commission > 0 && loserCoin ? Math.round((commission / loserCoin) * 100) : 0

  return (
    <div className="register-overlay modal mr-overlay">
      <div className="mr-card">
        <div className="mr-head">
          <div className="mr-player">
            <div className="mr-role win">{t('mr.winner')} <Icon name="crown" size={16} /></div>
            <Avatar url={winnerAvatar} color={winnerColor} />
            <div className="mr-name">
              <span className={`dot ${winnerColor}`} /> {winnerName}
            </div>
          </div>

          <div className="mr-center">
            <div className="mr-title">{t('mr.title')}</div>
            <div className="mr-score">
              <span>{winnerScore}</span>
              <em>–</em>
              <span>{loserScore}</span>
            </div>
            {endReason && (
              <div className="mr-endreason">
                <Icon name={endReason === 'ABANDON' ? 'flag' : 'clock'} size={13} />
                {endReason === 'AFK_TIMEOUT'
                  ? t('mr.endAfk')
                  : endReason === 'ABANDON'
                    ? t('mr.endAbandon')
                    : t('mr.endTimeout')}
                {endReason !== 'ABANDON' && (
                  <a className="mr-howclock" href="/bilgi/sure-nasil-isler" target="_blank" rel="noopener noreferrer">
                    {t('mr.howClock')}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="mr-player">
            <div className="mr-role">{t('mr.loser')}</div>
            <Avatar url={loserAvatar} color={loserColor} />
            <div className="mr-name">
              <span className={`dot ${loserColor}`} /> {loserName}
            </div>
          </div>
        </div>

        <div className="mr-table">
          <div className="mr-row">
            <span className="mr-a">{winnerBand}</span>
            <span className="mr-label">{t('mr.level')}</span>
            <span className="mr-b">{loserBand}</span>
          </div>
          {/* KLASIK TAVLA: PR satırları (Hata Oranı / Pul Oyunu PR / Küp PR) + hesaplanıyor notu
              GİZLİ (kullanıcı direktifi; yalnız klasikte). Seviye / Rating / Şans görünür kalır. */}
          {!classic && (
            <>
              <div className="mr-row">
                <span className="mr-a">
                  {aAnalyzing ? dots() : <>{fmtPr(winnerPr)} {wBetter && <Icon name="crown" size={14} />}</>}
                </span>
                <span className="mr-label">{t('mr.errorRate')}</span>
                <span className="mr-b">
                  {bAnalyzing ? dots() : <>{fmtPr(loserPr)} {lBetter && <Icon name="crown" size={14} />}</>}
                </span>
              </div>
              {/* Pul Oyunu PR + Küp PR satırları KALDIRILDI (kullanıcı kararı): küp PR, PR hesabından
                  çıkarıldı -> genel PR (Hata Oranı) artık YALNIZ pul oyunu, ayrı pul satırı onunla aynı
                  olurdu; küp satırı da anlamsız. Tek temiz "Hata Oranı (PR)" kalır. Küp verisi backend'de. */}
              {/* PR hesaplanırken (gnubg async) kullanıcıya açıklayıcı not: "…" spinner'ları tek başına
                  anlaşılmıyordu -> tam genişlik bilgi satırı. */}
              {analyzingAny && (
                <div className="mr-pr-note mr-pr-progress" role="status" aria-live="polite">
                  <div className="mr-pr-progress-head">
                    <span className="mr-pr-loader" aria-hidden="true" /> {t('mr.prCalculating')}
                    <span className="mr-pr-pct">%{progress}</span>
                  </div>
                  <div className="mr-pr-bar" aria-hidden="true">
                    <div className="mr-pr-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
          <div className="mr-row">
            <span className="mr-a">
              {spectator ? (winnerRating != null ? String(Math.round(winnerRating)) : '—') : ratingText(true)}
            </span>
            <span className="mr-label">{t('mr.rating')}</span>
            <span className="mr-b">
              {spectator ? (loserRating != null ? String(Math.round(loserRating)) : '—') : ratingText(false)}
            </span>
          </div>
          {/* PUANSIZ MAÇ notu: kullanıcı kılıç/casual maçta rating değişmeyince "bozuk mu?" diyordu ->
              tam genişlik açıklayıcı satır. Puanlı maçta ratingReason null -> gösterilmez. */}
          {ratingReason && (
            <div className="mr-pr-note" role="note">
              <Icon name="info" size={14} aria-hidden="true" />{' '}
              {ratingReason === 'friendly_cap'
                ? t('mr.unratedCap', { n: friendlyLimit ?? 3 })
                : ratingReason === 'unrated'
                  ? t('mr.unratedChosen')
                  : ratingReason === 'guest'
                    ? t('mr.unratedGuest')
                    : t('mr.unratedFriendly')}
            </div>
          )}
          {(coinAmount != null || asymCoin) && (
            <div className="mr-row">
              <span className="mr-a mr-pos">{fmtCoins(true)}</span>
              <span className="mr-label">{t('mr.coins')}</span>
              <span className="mr-b mr-neg">{fmtCoins(false)}</span>
            </div>
          )}
          {commission > 0 && (
            <div className="mr-pr-note" role="note">
              <Icon name="info" size={14} aria-hidden="true" />{' '}
              {t('mr.commission', { p: commissionPct, n: commission })}
            </div>
          )}
          <div className="mr-row">
            <span className={`mr-a ${useGnubgPct ? (wLuckPos ? 'mr-pos' : 'mr-neg') : ''}`}>
              {wLuckText ?? (luckAnalyzing ? dots() : '—')}
            </span>
            <span className="mr-label">{t('mr.luck')}</span>
            <span className={`mr-b ${useGnubgPct ? (lLuckPos ? 'mr-pos' : 'mr-neg') : ''}`}>
              {lLuckText ?? (luckAnalyzing ? dots() : '—')}
            </span>
          </div>
        </div>

        {(hasReport || onDiceCheck) && (
          <div className="mr-actions mr-report-actions">
            {/* Tek "Maç Özeti" butonu: Analiz + İstatistik aynı raporu açıyordu -> birleştirildi. */}
            {hasReport && (
              <Button variant="outline" onClick={onAnalysis}>
                <Icon name="chart" /> {t('ms.btn')}
              </Button>
            )}
            {/* Zar Kontrol: sunucu zarını (commit-reveal) bağımsız doğrula. */}
            {onDiceCheck && (
              <Button variant="outline" onClick={onDiceCheck}>
                <Icon name="dice" /> {t('dc.open')}
              </Button>
            )}
          </div>
        )}
        {!spectator && rmPhase === 'asked' && (
          <div className="mr-rematch-note">
            <Icon name="refresh" size={14} /> {t('mr.rematchAsk')}
          </div>
        )}
        {!spectator && rematchState?.theirs === 'no' && (
          <div className="mr-rematch-note declined">{t('mr.rematchDeclined')}</div>
        )}
        {spectator ? (
          <div className="mr-actions">
            <Button variant="default" onClick={onHome}>
              <Icon name="x" /> {t('common.close')}
            </Button>
          </div>
        ) : (
        <div className="mr-actions">
          {onTournamentLobby ? (
            <Button variant="default" onClick={onTournamentLobby}>
              <Icon name="trophy" /> {t('tourn.lobby')}
            </Button>
          ) : rmPhase === 'waiting' ? (
            <>
              <Button variant="default" disabled>
                <Icon name="refresh" /> {t('mr.rematchWait')}
              </Button>
              {onRematchDecline && (
                <Button variant="outline" onClick={onRematchDecline}>
                  {t('mr.rematchCancel')}
                </Button>
              )}
            </>
          ) : rmPhase === 'asked' ? (
            <>
              <Button variant="default" onClick={onRematch}>
                <Icon name="refresh" /> {t('mr.rematchAccept')}
              </Button>
              <Button variant="outline" onClick={onRematchDecline}>
                {t('mr.rematchDecline')}
              </Button>
            </>
          ) : rmPhase === 'done' ? null : (
            <Button variant="default" onClick={onRematch}>
              <Icon name="refresh" /> {t('mr.rematch')}
            </Button>
          )}
          {!onTournamentLobby && (
            <Button variant="outline" onClick={onNewMatch}>
              {t('mr.newMatch')}
            </Button>
          )}
          <Button variant="outline" onClick={onHome}>
            <Icon name="home" /> {t('home.title')}
          </Button>
        </div>
        )}
        {matchCode && (
          <button
            type="button"
            className={`mr-code${codeCopied ? ' copied' : ''}`}
            onClick={copyCode}
            title={t('mr.copyCode')}
          >
            <span className="mr-code-lbl">{t('mr.matchCode')}</span>
            <span className="mr-code-val">{matchCode}</span>
            <Icon name={codeCopied ? 'check' : 'copy'} size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
