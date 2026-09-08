/**
 * Şans Çarkı — kullanıcı arayüzü. Dilim sayısı SUNUCUDAN gelen aktif ödül sayısı kadardır
 * (sabit değil). Kazananı DAİMA backend belirler (weighted random); burada yalnızca
 * winningRewardId'nin dilimine dönüş animasyonu yapılır — sonuç değiştirilemez.
 *
 * ANİMASYON: dönen <g>'nin transition'ı DAİMA açıktır (spinning'e bağlı DEĞİL). Böylece
 * rotation state'i değişince tarayıcı güvenilir biçimde animasyonu başlatır (transition +
 * transform'u aynı commit'te değiştirince animasyon atlanması "iki-kare" tuzağı önlenir).
 * rotation yalnızca artar (birikimli) -> geri-snap gerekmez.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import Coins from './Coins'
import { useToast } from './Toast'
import { useEscape } from './useEscape'
import { Countdown } from './Countdown'
import { TavlaTvMark } from './TavlaTvLogo'
import { Button } from '@/components/ui/button'
import {
  ApiError,
  getLuckyWheel,
  spinLuckyWheel,
  type WheelReward,
  type WheelState,
  type WheelSpinReward,
  type ServerUser,
} from '../api'
import './LuckyWheel.css'

interface Props {
  loggedIn: boolean
  onClose: () => void
  onRequireLogin: () => void
  onCoinsChange?: (coins: number) => void
  onUser?: (u: ServerUser) => void
}

const SIZE = 340
const C = SIZE / 2 // 170 — merkez
const R = 150 // dilim yarıçapı
const RING = R + 6 // ince dış halka (flat, ink)
const HUB = 46 // merkez göbek yarıçapı

// Backend ikon adını (Phosphor) güvenli frontend IconName'e çevir; yoksa tipe göre.
function iconFor(type: string, icon?: string | null): IconName {
  const valid: Record<string, IconName> = {
    coins: 'coins',
    coin: 'coin',
    star: 'star',
    medal: 'medal',
    gift: 'gift',
    crown: 'crown',
    trophy: 'trophy',
    ticket: 'ticket',
    refresh: 'refresh',
    'arrows-clockwise': 'refresh',
    robot: 'robot',
    user: 'user',
    shop: 'shop',
  }
  if (icon && valid[icon]) return valid[icon]
  switch (type) {
    case 'COIN':
      return 'coin'
    case 'PREMIUM_DAY':
      return 'star'
    case 'AVATAR':
      return 'user'
    case 'BOARD_THEME':
      return 'shop'
    case 'BADGE':
      return 'medal'
    case 'FREE_SPIN':
      return 'refresh'
    default:
      return 'gift'
  }
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

// Dilim rengine göre OKUNUR metin rengi: açık zeminde ink, koyu zeminde beyaz.
// (Canlı palette'te sarı/amber/limon açık; beyaz metin okunmaz → ink'e düşer.)
function readableText(bg?: string | null): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((bg ?? '').trim())
  if (!m) return '#ffffff'
  const num = parseInt(m[1], 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 150 ? '#1c1a17' : '#ffffff'
}

export default function LuckyWheel({ loggedIn, onClose, onRequireLogin, onCoinsChange, onUser }: Props) {
  const { t } = useT()
  const toast = useToast()
  useEscape(onClose)

  const [data, setData] = useState<WheelState | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<WheelSpinReward | null>(null)
  const [winIdx, setWinIdx] = useState<number | null>(null) // kazanan dilim (parlama)
  const [remaining, setRemaining] = useState(0)
  const [nextFree, setNextFree] = useState<string | null>(null)
  const [coins, setCoins] = useState(0)

  const timerRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await getLuckyWheel()
      setData(d)
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

  const rewards: WheelReward[] = data?.rewards ?? []
  const n = rewards.length
  const step = n > 0 ? 360 / n : 360
  const duration = Math.max(2500, data?.settings.animationDuration ?? 5000)
  const ready = !!data?.ready
  const spinCost = data?.spinCost ?? 0
  const canPaid = remaining <= 0 && spinCost > 0 && coins >= spinCost
  const isPaidNext = remaining <= 0 && spinCost > 0
  const canSpin = ready && (remaining > 0 || canPaid)

  async function handleSpin() {
    if (!loggedIn) {
      onRequireLogin()
      return
    }
    if (spinning || !canSpin) return
    setResult(null)
    setWinIdx(null)
    setSpinning(true)
    try {
      const res = await spinLuckyWheel()
      const idx = rewards.findIndex((r) => r.id === res.winningRewardId)
      if (idx < 0) {
        await load()
        setSpinning(false)
        toast.error(t('lw.error'))
        return
      }
      // PARAYI ÖNCE AL: ödemeli çevirmede coin ücreti sunucuda spin anında zaten düşüldü;
      // gösterilen bakiyeden de ÜCRETİ çark DÖNMEDEN ÖNCE hemen düş ki kullanıcı ödemeyi
      // çevrilmeden görsün. Kazanç (ör. COIN ödülü) ve otoriter bakiye animasyon bitince
      // uygulanır — böylece kazanç, sonuç açılmadan bakiyeyi "yukarı zıplatmaz".
      if (res.paid && res.spinCost && res.spinCost > 0) {
        const cost = res.spinCost
        setCoins((c) => {
          const next = Math.max(0, c - cost)
          onCoinsChange?.(next)
          return next
        })
      }
      // Kazanan dilimin MERKEZİ tam üstteki göstergenin altına gelsin.
      // Dilim i merkezi açısı = -90 + (i+0.5)*step (SVG'de -90 = üst). Göstergeyi (üst)
      // bu merkeze getirmek için çarkı -(i+0.5)*step kadar döndür + tam turlar.
      const targetMod = (((360 - (idx + 0.5) * step) % 360) + 360) % 360
      const current = ((rotation % 360) + 360) % 360
      let delta = targetMod - current
      if (delta < 0) delta += 360
      // Küçük rastgele sapma dışında dilim ortasında dursun (hile değil; sadece görsel çeşitlilik).
      const turns = 6
      setRotation(rotation + turns * 360 + delta)

      timerRef.current = window.setTimeout(() => {
        setResult(res.reward)
        setWinIdx(idx)
        setRemaining(res.remainingSpins)
        setNextFree(res.nextFreeSpinAt)
        // Otoriter bakiye (varsa kazanç dahil) burada uygulanır.
        if (typeof res.coins === 'number') {
          setCoins(res.coins)
          onCoinsChange?.(res.coins)
        }
        if (res.user) onUser?.(res.user)
        setSpinning(false)
      }, duration + 150)
    } catch (e) {
      setSpinning(false)
      const msg = e instanceof ApiError ? e.message : t('lw.error')
      toast.error(msg)
      load()
    }
  }

  function closeWin() {
    setResult(null)
  }
  function spinAgain() {
    setResult(null)
    setWinIdx(null)
    window.setTimeout(() => handleSpin(), 60)
  }

  const showProb = !!data?.settings.showProbability

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card lw-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>

        <header className="lw-head">
          <h2>
            <Icon name="gift" size={22} /> {t('lw.title')}
          </h2>
          <p className="lw-sub">{t('lw.freeInfo')}</p>
        </header>

        {loading ? (
          <p className="lw-note">{t('common.loading')}</p>
        ) : !data || !data.enabled ? (
          <p className="lw-note">{t('lw.disabled')}</p>
        ) : n < 2 || !ready ? (
          <p className="lw-note">{t('lw.notReady')}</p>
        ) : (
          <div className="lw-layout">
            {/* SOL: istatistik + çark + çevir */}
            <section className="lw-wheel-panel">
              {/* İstatistik şeridi: kalan hak · yeni hak (geri sayım) · bakiye */}
              <div className="lw-stats">
                <div className="lw-stat">
                  <span className="lw-stat-label">{t('lw.remaining')}</span>
                  <span className="lw-stat-value tnum">{remaining}</span>
                </div>
                <div className="lw-stat">
                  <span className="lw-stat-label">{t('lw.nextFree')}</span>
                  <span className="lw-stat-value">
                    {remaining <= 0 && nextFree ? (
                      <Countdown target={nextFree} className="lw-cd" onExpire={load} />
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
                <div className="lw-stat">
                  <span className="lw-stat-label">{t('shop.balance')}</span>
                  <span className="lw-stat-value">
                    <Coins amount={coins} size={16} />
                  </span>
                </div>
              </div>

              <div className={`lw-stage ${spinning ? 'is-spinning' : ''}`}>
                {/* Üst gösterge (pointer): kiremit üçgen, aşağı bakar */}
                <div className="lw-pointer" aria-hidden="true">
                  <svg width="26" height="30" viewBox="0 0 26 30">
                    <path className="lw-pointer-tri" d="M13 29 L1 3 L25 3 Z" />
                  </svg>
                </div>

                <svg className="lw-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
                  {/* İnce dış halka (flat, ink) */}
                  <circle className="lw-ring" cx={C} cy={C} r={RING} />

                  {/* DÖNEN grup: dilimler + etiketler + ikonlar */}
                  <g
                    className="lw-wheel"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transitionProperty: 'transform',
                      transitionDuration: `${duration}ms`,
                      transitionTimingFunction: 'cubic-bezier(0.12, 0.75, 0.05, 1)',
                    }}
                  >
                    {rewards.map((rw, i) => {
                      const start = -90 + i * step
                      const end = -90 + (i + 1) * step
                      const [x0, y0] = polar(C, C, R, start)
                      const [x1, y1] = polar(C, C, R, end)
                      const large = step > 180 ? 1 : 0
                      const mid = -90 + (i + 0.5) * step
                      const [lx, ly] = polar(C, C, R * 0.58, mid)
                      const [ix, iy] = polar(C, C, R * 0.86, mid)
                      const isWin = winIdx === i
                      return (
                        <g key={rw.id}>
                          <path
                            className={`lw-slice ${isWin ? 'is-win' : ''}`}
                            d={`M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`}
                            fill={rw.sliceColor}
                          />
                          <text
                            x={lx.toFixed(2)}
                            y={ly.toFixed(2)}
                            fill={readableText(rw.sliceColor)}
                            fontSize={n > 10 ? 10 : 12}
                            fontWeight={500}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${(mid + 180).toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})`}
                          >
                            {rw.name.length > 16 ? rw.name.slice(0, 15) + '…' : rw.name}
                          </text>
                          <foreignObject x={ix - 10} y={iy - 10} width={20} height={20}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: readableText(rw.sliceColor) }}>
                              <Icon name={iconFor(rw.type, rw.icon)} size={15} weight="fill" />
                            </div>
                          </foreignObject>
                        </g>
                      )
                    })}
                  </g>

                  {/* Merkez göbek (hub): flat ink daire + TavlaTV logosu (dönmez) */}
                  <circle className="lw-hub" cx={C} cy={C} r={HUB} />
                  <foreignObject x={C - 38} y={C - 38} width={76} height={76} pointerEvents="none">
                    <div className="lw-hub-logo">
                      <TavlaTvMark size={64} background="transparent" />
                    </div>
                  </foreignObject>
                </svg>

                {result && (
                  <div className="lw-win">
                    <div className="lw-win-inner">
                      <div
                        className="lw-win-badge"
                        style={{ background: result.slice_color || 'var(--accent)', color: readableText(result.slice_color) }}
                      >
                        <Icon name={iconFor(result.type, result.icon)} size={34} weight="fill" />
                      </div>
                      <div className="lw-win-title">{t('lw.congrats')}</div>
                      <div className="lw-win-reward">
                        {result.type === 'COIN' ? <Coins amount={result.amount} gain pill size={18} /> : result.name}
                      </div>
                      {result.description ? <div className="lw-win-sub">{result.description}</div> : null}
                      <div className="lw-win-sub">{t('lw.rewardAdded')}</div>
                      {result.type === 'FREE_SPIN' && remaining > 0 ? (
                        <Button onClick={spinAgain}>
                          <Icon name="refresh" size={16} /> {t('lw.spinAgain')}
                        </Button>
                      ) : (
                        <Button onClick={closeWin}>{t('lw.great')}</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ÇEVİR butonu — çarkın altında (standart site butonu) */}
              <div className="lw-actions">
                <Button className="lw-spin-btn" onClick={handleSpin} disabled={spinning || !canSpin}>
                  {spinning ? (
                    <>
                      <Icon name="refresh" size={18} className="lw-spin-ic" /> {t('lw.spin')}…
                    </>
                  ) : isPaidNext ? (
                    <>
                      {t('lw.spinFor', { n: spinCost })} <Icon name="coin" size={16} />
                    </>
                  ) : (
                    <>{t('lw.spin')}</>
                  )}
                </Button>
              </div>
            </section>

            {/* SAĞ: ödül listesi + bilgi notu */}
            <aside className="lw-side">
              <div className="lw-side-card">
                <h3 className="lw-side-title">{t('lw.rewardsTitle')}</h3>
                <ul className="lw-prizes">
                  {rewards.map((rw, i) => (
                    <li key={rw.id} className={`lw-prize ${winIdx === i ? 'is-win' : ''}`}>
                      <span className="lw-prize-sw" style={{ background: rw.sliceColor, color: readableText(rw.sliceColor) }}>
                        <Icon name={iconFor(rw.type, rw.icon)} size={14} weight="fill" />
                      </span>
                      <span className="lw-prize-name">{rw.name}</span>
                      {showProb && rw.probability != null ? (
                        <span className="lw-prize-pct tnum">%{rw.probability}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              {!loggedIn ? (
                <p className="lw-note">{t('lw.loginRequired')}</p>
              ) : remaining <= 0 && spinCost > 0 ? (
                <p className="lw-note">{t('lw.paidHint', { n: spinCost })}</p>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
