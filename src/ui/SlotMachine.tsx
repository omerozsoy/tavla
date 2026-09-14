/**
 * SlotMachine — fiziksel casino slot makinesinin gövdesi. Royal Navy kasa + altın/krom trim,
 * hafif 3D hacim (bevel + gölge + üst rim), üstte ışıklı marquee, ortada gömülü makara ekranı
 * (cam + payline + silindirik makaralar) ve sağ yanda fiziksel KOL.
 *
 * SALT SUNUM: hangi sembollerin geleceğini, kazanç/jackpot'u BİLMEZ — hepsi parent'tan (gerçek
 * sunucu sonucu) gelir. Kol ve ÇEVİR aynı `onLever` spin fonksiyonunu çağırır.
 *
 * Makara geometrisi (SlotReel + --slot-row + 1.6 oranı) DOKUNULMAZ.
 */
import { useT } from '../i18n'
import Coins from './Coins'
import SlotReel from './SlotReel'
import SlotResult from './SlotResult'
import SlotMarquee from './SlotMarquee'
import SlotLever from './SlotLever'
import WinEffect from './WinEffect'
import type { SlotSymbolCode } from '../api'

type WinType = 'none' | 'triple' | 'jackpot' | 'straight'

interface Props {
  reels: SlotSymbolCode[]
  spinKey: number
  reelDurations: number[]
  spinning: boolean
  lineWin: boolean
  jackpot: number
  result: { winType: WinType; payout: number; matchedValue: number | null } | null
  canSpin: boolean
  celebrate?: boolean // jackpot kutlaması sürerken marquee ışıkları koşar
  onLever: () => void
}

export default function SlotMachine({
  reels,
  spinKey,
  reelDurations,
  spinning,
  lineWin,
  jackpot,
  result,
  canSpin,
  celebrate,
  onLever,
}: Props) {
  const { t } = useT()
  const showWinBurst = lineWin && !!result && result.winType !== 'none' && !spinning

  return (
    <div className="sm-wrap">
      <div className={`sm-cabinet ${spinning ? 'is-spinning' : ''} ${lineWin ? 'is-win' : ''}`}>
        {/* Kasanın üst/yan fiziksel yüzeyleri (hacim) */}
        <span className="sm-top-face" aria-hidden="true" />
        <span className="sm-side-face" aria-hidden="true" />

        <SlotMarquee title={t('ds.title')} spinning={spinning} celebrate={celebrate} />

        {/* JACKPOT bandı — altın/kiremit metal pill */}
        <div className="sm-jackpot-banner">
          <span className="sm-jackpot-label">{t('ds.jackpot')}</span>
          <span className="sm-jackpot-value">
            <Coins amount={jackpot} size={22} />
          </span>
        </div>

        {/* EKRAN: gömülü metal bezel + cam + 3 silindirik makara */}
        <div className={`sm-screen ${spinning ? 'is-spinning' : ''} ${lineWin ? 'is-win' : ''}`}>
          <span className="sm-bezel" aria-hidden="true" />
          <span className="sm-rivet sm-rivet-tl" aria-hidden="true" />
          <span className="sm-rivet sm-rivet-tr" aria-hidden="true" />
          <span className="sm-rivet sm-rivet-bl" aria-hidden="true" />
          <span className="sm-rivet sm-rivet-br" aria-hidden="true" />

          <div className="sm-reels">
            {reels.map((code, i) => (
              <div className="sm-reel-col" key={i}>
                <SlotReel finalCode={code} spinKey={spinKey} duration={reelDurations[i]} win={lineWin} />
              </div>
            ))}
          </div>

          <div className="sm-payline" aria-hidden="true" />
          <div className="sm-glass" aria-hidden="true" />

          {showWinBurst && <WinEffect variant="win" amount={result!.payout} />}

          {result && (
            <div className="sm-result-slot">
              <SlotResult winType={result.winType} payout={result.payout} matchedValue={result.matchedValue} />
            </div>
          )}
        </div>

        {/* Fiziksel kol — kasanın sağ yanına biner (ÇEVİR ile aynı spin'i tetikler). */}
        <SlotLever pulling={spinning} disabled={spinning || !canSpin} onPull={onLever} label={t('ds.spin')} />
      </div>
    </div>
  )
}
