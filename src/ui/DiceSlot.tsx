/**
 * ZAR SLOTU — 3 makaralı klasik slot makinesi, tavla zarlarıyla (meyve/BAR/7 yerine d1..d6
 * + 64 küpü). İlk bakışta standart bir slot gibi anlaşılır; görsel dil tamamen siteye özel.
 *
 * SUNUCU-OTORİTER: 3 sembolü DAİMA backend seçer (spinDiceSlot). Makaralar yalnızca dönen
 * sonuca iner (SlotReel). Kazanç/kayıp, sıralama (kent), jackpot ve coin sunucudan gelir.
 *
 * Kazanç tipleri: üçlü zar (d{v} -> payout_{v}), sıralama/kent (ardışık üç farklı zar ->
 * payout_straight), üçlü 64 -> artan JACKPOT. Makara duruşu sıralı: sol<orta<sağ.
 *
 * Tasarım: koyu "kabin" (oyun sahnesi gibi kasıtlı koyu), kiremit bezel + marquee; refresh'te
 * /zar-slotu derin-link ile geri açılır (App.tsx applyFromPath). Modal değil, kalıcı sayfa hissi.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import Coins from './Coins'
import { useToast } from './Toast'
import { useEscape } from './useEscape'
import { Countdown } from './Countdown'
import { Button } from '@/components/ui/button'
import SlotReel from './SlotReel'
import SlotResult from './SlotResult'
import JackpotAnimation from './JackpotAnimation'
import { ApiError, getDiceSlot, spinDiceSlot, type DiceSlotState, type SlotSymbolCode, type ServerUser } from '../api'
import './DiceSlot.css'

interface Props {
  loggedIn: boolean
  onClose: () => void
  onRequireLogin: () => void
  onCoinsChange?: (coins: number) => void
  onUser?: (u: ServerUser) => void
}

// Makara durma süreleri (ms) — sırayla dursun: sol < orta < sağ.
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
    if (spinning || !canSpin) return
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

  const paytable = data?.paytable ?? []

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
          <div className="ds-layout">
            {/* SOL: makine kabini */}
            <section className="ds-cabinet">
              <header className="ds-marquee">
                <h2 className="ds-title">{t('ds.title')}</h2>
                <p className="ds-sub">{t('ds.tagline')}</p>
              </header>

              <div className="ds-jp-banner">
                <span className="ds-jp-label">{t('ds.jackpot')}</span>
                <span className="ds-jp-value">
                  <Coins amount={jackpot} size={22} />
                </span>
              </div>

              {/* EKRAN: bezel + 3 makara + payline + cam parlaması */}
              <div className={`ds-screen ${spinning ? 'is-spinning' : ''} ${lineWin ? 'is-win' : ''}`}>
                <div className="ds-payline" aria-hidden="true" />
                <div className="ds-reels">
                  {reels.map((code, i) => (
                    <SlotReel key={i} finalCode={code} spinKey={spinKey} duration={REEL_MS[i]} win={lineWin} />
                  ))}
                </div>
                <div className="ds-glass" aria-hidden="true" />
                {result && (
                  <div className="ds-result-slot">
                    <SlotResult winType={result.winType} payout={result.payout} matchedValue={result.matchedValue} />
                  </div>
                )}
              </div>

              {/* KONTROL PANELİ: istatistik + ÇEVİR */}
              <div className="ds-deck">
                <div className="ds-stats">
                  <div className="ds-stat">
                    <span className="ds-stat-label">{t('ds.remaining')}</span>
                    <span className="ds-stat-value tnum">{remaining}</span>
                  </div>
                  <div className="ds-stat">
                    <span className="ds-stat-label">{t('ds.nextFree')}</span>
                    <span className="ds-stat-value">
                      {remaining <= 0 && nextFree ? <Countdown target={nextFree} onExpire={load} /> : '—'}
                    </span>
                  </div>
                  <div className="ds-stat">
                    <span className="ds-stat-label">{t('ds.cost')}</span>
                    <span className="ds-stat-value">
                      {isPaidNext ? <Coins amount={spinCost} size={16} /> : <span className="ds-free">{t('ds.free')}</span>}
                    </span>
                  </div>
                  <div className="ds-stat">
                    <span className="ds-stat-label">{t('ds.balance')}</span>
                    <span className="ds-stat-value">
                      <Coins amount={coins} size={16} />
                    </span>
                  </div>
                </div>

                <Button className="ds-spin-btn" onClick={handleSpin} disabled={spinning || !canSpin}>
                  {spinning ? (
                    <>{t('ds.spinning')}…</>
                  ) : isPaidNext ? (
                    <>
                      {t('ds.spinFor', { n: spinCost })} <Icon name="coin" size={18} />
                    </>
                  ) : (
                    <>{t('ds.spin')}</>
                  )}
                </Button>
              </div>
            </section>

            {/* SAĞ: ödül tablosu + bilgi */}
            <aside className="ds-side">
              <div className="ds-paytable">
                <h3 className="ds-paytable-title">{t('ds.paytable')}</h3>
                <ul className="ds-paytable-list">
                  {paytable.map((row) => (
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
                            <Icon name="die-1" size={20} weight="fill" />
                            <Icon name="die-2" size={20} weight="fill" />
                            <Icon name="die-3" size={20} weight="fill" />
                          </>
                        ) : (
                          <>
                            <Icon name={`die-${row.value}` as IconName} size={20} weight="fill" />
                            <Icon name={`die-${row.value}` as IconName} size={20} weight="fill" />
                            <Icon name={`die-${row.value}` as IconName} size={20} weight="fill" />
                          </>
                        )}
                      </span>
                      <span className="ds-pt-meta">
                        {row.straight ? <span className="ds-pt-tag">{t('ds.straightLabel')}</span> : null}
                        {row.jackpot ? (
                          <span className="ds-pt-jackpot">{t('ds.jackpot')}</span>
                        ) : (
                          <Coins amount={row.payout} size={15} />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="ds-pt-note">{t('ds.straightHint')}</p>
              </div>
              {!loggedIn ? <p className="ds-note ds-note-side">{t('ds.loginRequired')}</p> : null}
            </aside>
          </div>
        )}

        {/* JACKPOT kutlama katmanı — tüm kartı kaplar */}
        {jackpotActive && <JackpotAnimation amount={jackpotAmount} onClose={() => setJackpotActive(false)} />}
      </div>
    </div>
  )
}
