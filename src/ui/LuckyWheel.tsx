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
const RIM = R + 8 // dış çerçeve (rim) yarıçapı

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

// Rengi koyulaştır (dilim dış kenarına gölge/derinlik için). hex -> hex.
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (num & 255) + amt))
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
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

  // Dış çerçeve ampulleri (dekoratif, dönmez) — dilim sayısının 2 katı, en az 16.
  const bulbs = Math.min(32, Math.max(16, n * 2))

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card lw-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>

        <header className="lw-head">
          <div className="lw-head-text">
            <h2>
              <Icon name="gift" size={20} weight="fill" /> {t('lw.title')}
            </h2>
            <p className="lw-sub">{t('lw.freeInfo')}</p>
          </div>
        </header>

        {loading ? (
          <p className="lw-note">{t('common.loading')}</p>
        ) : !data || !data.enabled ? (
          <p className="lw-note">{t('lw.disabled')}</p>
        ) : n < 2 || !ready ? (
          <p className="lw-note">{t('lw.notReady')}</p>
        ) : (
          <>
            <div className={`lw-stage ${spinning ? 'is-spinning' : ''}`}>
              <svg className="lw-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
                <defs>
                  {/* Merkeze doğru koyulaşan derinlik katmanı */}
                  <radialGradient id="lw-depth" cx="50%" cy="42%" r="62%">
                    <stop offset="0%" stopColor="#000" stopOpacity="0" />
                    <stop offset="72%" stopColor="#000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
                  </radialGradient>
                  {/* Üstten hafif ışık (parlaklık) */}
                  <radialGradient id="lw-sheen" cx="50%" cy="30%" r="60%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
                    <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                  </radialGradient>
                  <filter id="lw-win-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ffd54a" floodOpacity="0.95" />
                  </filter>
                  <linearGradient id="lw-rim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f6d179" />
                    <stop offset="50%" stopColor="#d9a41f" />
                    <stop offset="100%" stopColor="#9c6f12" />
                  </linearGradient>
                </defs>

                {/* Dış çerçeve (rim) */}
                <circle cx={C} cy={C} r={RIM + 4} fill="url(#lw-rim)" />
                <circle cx={C} cy={C} r={RIM} fill="#2a1a0e" />
                {/* Rim ampulleri (dekoratif, sabit) */}
                {Array.from({ length: bulbs }).map((_, i) => {
                  const [bx, by] = polar(C, C, RIM + 2, (360 / bulbs) * i - 90)
                  return <circle key={i} className="lw-bulb" cx={bx} cy={by} r={2.6} />
                })}

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
                    const [lx, ly] = polar(C, C, R * 0.55, mid)
                    const [ix, iy] = polar(C, C, R * 0.85, mid)
                    const isWin = winIdx === i
                    return (
                      <g key={rw.id} filter={isWin ? 'url(#lw-win-glow)' : undefined}>
                        <path
                          d={`M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`}
                          fill={rw.sliceColor}
                          stroke={isWin ? '#ffd54a' : shade(rw.sliceColor, -26)}
                          strokeWidth={isWin ? 3 : 1}
                        />
                        <text
                          x={lx.toFixed(2)}
                          y={ly.toFixed(2)}
                          fill={rw.textColor}
                          fontSize={n > 10 ? 10 : 12}
                          fontWeight={700}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${(mid + 180).toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})`}
                          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.18)', strokeWidth: 2 }}
                        >
                          {rw.name.length > 16 ? rw.name.slice(0, 15) + '…' : rw.name}
                        </text>
                        <foreignObject x={ix - 11} y={iy - 11} width={22} height={22}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: rw.textColor }}>
                            <Icon name={iconFor(rw.type, rw.icon)} size={16} weight="fill" />
                          </div>
                        </foreignObject>
                      </g>
                    )
                  })}
                </g>

                {/* Sabit katmanlar (dönmez): derinlik + parlaklık */}
                <circle cx={C} cy={C} r={R} fill="url(#lw-depth)" pointerEvents="none" />
                <circle cx={C} cy={C} r={R} fill="url(#lw-sheen)" pointerEvents="none" />

                {/* Merkez göbek (hub): altın rim + TavlaTV marka logosu (dönmez, sabit). */}
                <circle cx={C} cy={C} r={46} fill="url(#lw-rim)" />
                <circle cx={C} cy={C} r={42} fill="#1C1A17" />
                <foreignObject x={C - 40} y={C - 40} width={80} height={80} pointerEvents="none">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                    <TavlaTvMark size={70} background="transparent" />
                  </div>
                </foreignObject>
              </svg>

              {/* Üst sabit gösterge (pointer) */}
              <div className="lw-pointer" aria-hidden="true">
                <svg width="34" height="40" viewBox="0 0 34 40">
                  <path d="M17 40 L4 12 A15 15 0 1 1 30 12 Z" fill="url(#lw-rim)" stroke="#7a560d" strokeWidth="1.5" />
                  <circle cx="17" cy="14" r="6" fill="#2a1a0e" />
                </svg>
              </div>

              {result && (
                <div className="lw-win" onClick={closeWin}>
                  <div className="lw-win-inner" onClick={(e) => e.stopPropagation()}>
                    <div className="lw-win-badge" style={{ background: result.slice_color || 'var(--accent, #a83a2b)' }}>
                      <Icon name={iconFor(result.type, result.icon)} size={38} weight="fill" />
                    </div>
                    <div className="lw-win-title">{t('lw.congrats')}</div>
                    <div className="lw-win-reward">
                      {result.type === 'COIN' ? (
                        <Coins amount={result.amount} gain pill size={18} />
                      ) : (
                        result.name
                      )}
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

            {/* ÇEVİR butonu — çarkın ALTINDA (merkezde değil), standart site butonu. */}
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

            <div className="lw-meta">
              <span>
                {t('lw.remaining')}: <strong>{remaining}</strong>
              </span>
              {remaining <= 0 && spinCost > 0 ? <span>{t('lw.paidHint', { n: spinCost })}</span> : null}
              {remaining <= 0 && nextFree ? (
                <span className="lw-next">
                  {t('lw.nextFree')}: <Countdown target={nextFree} className="lw-cd" onExpire={load} />
                </span>
              ) : null}
              <span className="lw-coins">
                <Coins amount={coins} size={15} />
              </span>
            </div>

            {!loggedIn ? (
              <p className="lw-note">{t('lw.loginRequired')}</p>
            ) : showProb ? (
              <p className="lw-note">{t('lw.probShown')}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
