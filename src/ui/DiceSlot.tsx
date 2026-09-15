/**
 * ZAR SLOTU — gerçek fiziksel casino slot makinesinin Tavlai için premium dijital versiyonu.
 * 3 makaralı klasik slot; tavla zarlarıyla (d1..d6 + 64 küpü jackpot). Royal Navy kasa +
 * altın/krom trim, ışıklı marquee, yandan fiziksel kol, gömülü silindirik makaralar.
 *
 * SUNUCU-OTORİTER (DEĞİŞMEDİ): 3 sembolü DAİMA backend seçer (spinDiceSlot). Makaralar yalnız
 * dönen sonuca iner (SlotReel). Kazanç/kayıp, sıralama, jackpot ve coin sunucudan gelir.
 * Frontend KENDİ sonucunu üretmez — yalnız sunucunun sonucunu görsel gösterir.
 *
 * Bu dosya = mantık + veri katmanı (state, spin akışı). Sunum tamamen alt componentlerde:
 * SlotMachine / SlotMarquee / SlotLever / SlotControls / WinEffect / SlotReel / SlotSymbol.
 *
 * Refresh'te /zar-slotu derin-link ile geri açılır (App.tsx applyFromPath).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import Coins from './Coins'
import { useToast } from './Toast'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
import SlotMachine from './SlotMachine'
import SlotControls from './SlotControls'
import WinEffect from './WinEffect'
import { ApiError, getDiceSlot, spinDiceSlot, type DiceSlotState, type SlotSymbolCode, type ServerUser } from '../api'
import './DiceSlot.css'

interface Props {
  loggedIn: boolean
  onClose: () => void
  onRequireLogin: () => void
  onCoinsChange?: (coins: number) => void
  onUser?: (u: ServerUser) => void
}

// Makara durma süreleri (ms) — sırayla dursun: sol < orta < sağ (stagger).
const REEL_MS = [1200, 1600, 2000]
const FINALIZE_MS = REEL_MS[2] + 320 // son makara + snap tamamlandıktan sonra sonucu aç

const INITIAL_REELS: SlotSymbolCode[] = ['d3', 'd5', 'd2']

type WinType = 'none' | 'triple' | 'jackpot' | 'straight'

export default function DiceSlot({ loggedIn, onClose, onRequireLogin, onCoinsChange, onUser }: Props) {
  const { t } = useT()
  const toast = useToast()
  useEscape(onClose)

  const [data, setData] = useState<DiceSlotState | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [reels, setReels] = useState<SlotSymbolCode[]>(INITIAL_REELS)
  const [spinKey, setSpinKey] = useState(0)
  const [lineWin, setLineWin] = useState(false)
  const [result, setResult] = useState<{ winType: WinType; payout: number; matchedValue: number | null } | null>(null)
  const [jackpotActive, setJackpotActive] = useState(false)
  const [jackpotAmount, setJackpotAmount] = useState(0) // kazanılan havuz (pool spin sonrası tabana döner)

  const [jackpot, setJackpot] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [nextFree, setNextFree] = useState<string | null>(null)
  const [coins, setCoins] = useState(0)

  const timerRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await getDiceSlot()
      setData(d)
      setJackpot(d.jackpot)
      setRemaining(d.remainingSpins)
      setNextFree(d.nextFreeSpinAt)
      if (typeof d.coins === 'number') setCoins(d.coins)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [load])

  const spinCost = data?.spinCost ?? 0
  const isPaidNext = remaining <= 0 && spinCost > 0
  const canPaid = remaining <= 0 && spinCost > 0 && coins >= spinCost
  const canSpin = !!data?.enabled && (remaining > 0 || canPaid)

  async function handleSpin() {
    if (!loggedIn) {
      onRequireLogin()
      return
    }
    if (spinning || !canSpin) return // çoklu/rapid-click spin engeli
    setResult(null)
    setJackpotActive(false)
    setLineWin(false)
    setSpinning(true)
    try {
      const res = await spinDiceSlot()
      setReels(res.reels)
      setSpinKey((k) => k + 1)
      if (res.paid && res.spinCost && res.spinCost > 0) {
        const cost = res.spinCost
        setCoins((c) => {
          const next = Math.max(0, c - cost)
          onCoinsChange?.(next)
          return next
        })
      }
      timerRef.current = window.setTimeout(() => {
        const won = res.winType !== 'none'
        setLineWin(won)
        setJackpot(res.jackpot)
        setRemaining(res.remainingSpins)
        setNextFree(res.nextFreeSpinAt)
        if (typeof res.coins === 'number') {
          setCoins(res.coins)
          onCoinsChange?.(res.coins)
        }
        if (res.user) onUser?.(res.user)
        if (res.jackpotWon) {
          setJackpotAmount(res.payout)
          setJackpotActive(true)
        } else {
          setResult({ winType: res.winType, payout: res.payout, matchedValue: res.matchedValue })
        }
        setSpinning(false)
      }, FINALIZE_MS)
    } catch (e) {
      setSpinning(false)
      const msg = e instanceof ApiError ? e.message : t('ds.error')
      toast.error(msg)
      load()
    }
  }

  // Ödül tablosu: TÜM ödenen ödülleri (üçlü zar + STRAIGHT) ÖDENEN COIN'e göre artan sırala
  // (straight kendi payout'una göre araya girer, dibe pinlenmez). Yalnız JACKPOT en sonda kalır
  // (ödülü sabit değil, artan havuz).
  const paytable = data?.paytable ?? []
  const paidRows = paytable.filter((r) => !r.jackpot).sort((a, b) => a.payout - b.payout)
  const jackpotRow = paytable.find((r) => r.jackpot)
  const orderedPaytable = [...paidRows, ...(jackpotRow ? [jackpotRow] : [])]

  return (
    <div className="register-overlay modal page ds-overlay" role="dialog" aria-modal="true">
      <div className="register-card ds-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close ds-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>

        {loading ? (
          <p className="ds-note">{t('common.loading')}</p>
        ) : !data || !data.enabled ? (
          <p className="ds-note">{t('ds.disabled')}</p>
        ) : (
          <div className="ds-stage">
            {/* ÜST BAŞLIK YOK (marquee zaten "ZAR SLOTU" gösterir; bakiye BAKİYE göstergesinde). */}
            {/* ORTA: makine (+ kontrol) SOLA DAYALI, ödül tablosu SAĞDA */}
            <div className="ds-main">
              <div className="ds-main-left">
                {/* fiziksel slot makinesi */}
                <SlotMachine
                  reels={reels}
                  spinKey={spinKey}
                  reelDurations={REEL_MS}
                  spinning={spinning}
                  lineWin={lineWin}
                  jackpot={jackpot}
                  result={result}
                  canSpin={canSpin}
                  celebrate={jackpotActive}
                  onLever={handleSpin}
                />

                {/* KONTROL PANELİ */}
                <SlotControls
                  remaining={remaining}
                  nextFree={nextFree}
                  spinCost={spinCost}
                  isPaidNext={isPaidNext}
                  coins={coins}
                  spinning={spinning}
                  canSpin={canSpin}
                  onSpin={handleSpin}
                  onCooldownExpire={load}
                />
              </div>

              {/* SAĞ: ödül tablosu (coine göre sıralı) */}
              <aside className="ds-paytable">
                <h3 className="ds-paytable-title">{t('ds.paytable')}</h3>
                <ul className="ds-paytable-list">
                  {orderedPaytable.map((row) => (
                  <li
                    key={row.code}
                    className={`ds-pt-row ${row.jackpot ? 'is-jackpot' : ''} ${row.straight ? 'is-straight' : ''}`}
                  >
                    <span className="ds-pt-combo" aria-hidden="true">
                      {row.jackpot ? (
                        <>
                          <span className="ds-pt-cube">64</span>
                          <span className="ds-pt-cube">64</span>
                          <span className="ds-pt-cube">64</span>
                        </>
                      ) : row.straight ? (
                        <>
                          <Icon name="die-1" size={32} weight="fill" />
                          <Icon name="die-2" size={32} weight="fill" />
                          <Icon name="die-3" size={32} weight="fill" />
                        </>
                      ) : (
                        <>
                          <Icon name={`die-${row.value}` as IconName} size={32} weight="fill" />
                          <Icon name={`die-${row.value}` as IconName} size={32} weight="fill" />
                          <Icon name={`die-${row.value}` as IconName} size={32} weight="fill" />
                        </>
                      )}
                    </span>
                    <span className="ds-pt-meta">
                      {row.jackpot ? (
                        <span className="ds-pt-jackpot">{t('ds.jackpot')}</span>
                      ) : (
                        <Coins amount={row.payout} size={19} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
                <p className="ds-pt-note">{t('ds.straightHint')}</p>
                {!loggedIn ? <p className="ds-note ds-note-side">{t('ds.loginRequired')}</p> : null}
              </aside>
            </div>
          </div>
        )}

        {/* JACKPOT kutlama katmanı — tüm kartı kaplar */}
        {jackpotActive && <WinEffect variant="jackpot" amount={jackpotAmount} onClose={() => setJackpotActive(false)} />}
      </div>
    </div>
  )
}
