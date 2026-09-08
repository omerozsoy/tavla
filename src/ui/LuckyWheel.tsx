/**
 * Şans Çarkı — kullanıcı arayüzü. Dilim sayısı SUNUCUDAN gelen aktif ödül sayısı kadardır
 * (sabit değil). Kazananı DAİMA backend belirler (weighted random); burada yalnızca
 * winningRewardId'nin dilimine dönüş animasyonu yapılır — sonuç değiştirilemez.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import Coins from './Coins'
import { useToast } from './Toast'
import { useEscape } from './useEscape'
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

interface Props {
  loggedIn: boolean
  onClose: () => void
  onRequireLogin: () => void
  onCoinsChange?: (coins: number) => void
  onUser?: (u: ServerUser) => void
}

const SIZE = 320
const C = SIZE / 2 // 160 — merkez
const R = 150 // yarıçap

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

export default function LuckyWheel({ loggedIn, onClose, onRequireLogin, onCoinsChange, onUser }: Props) {
  const { t } = useT()
  const toast = useToast()
  useEscape(onClose)

  const [data, setData] = useState<WheelState | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<WheelSpinReward | null>(null)
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
  // Ücretsiz/bonus hak yoksa coin ile ödemeli çevirme mümkün mü?
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
    setSpinning(true)
    try {
      const res = await spinLuckyWheel()
      const idx = rewards.findIndex((r) => r.id === res.winningRewardId)
      if (idx < 0) {
        // Havuz istemci ile senkron değil (ödül bitti/eklendi) -> tazele, bu spin'i iptal et.
        await load()
        setSpinning(false)
        toast.error(t('lw.error'))
        return
      }
      // Kazanan dilimin merkezini üstteki göstergenin altına getir.
      const targetMod = (((360 - (idx + 0.5) * step) % 360) + 360) % 360
      const current = ((rotation % 360) + 360) % 360
      let delta = targetMod - current
      if (delta < 0) delta += 360
      const turns = 6
      setRotation(rotation + turns * 360 + delta)

      timerRef.current = window.setTimeout(() => {
        setResult(res.reward)
        setRemaining(res.remainingSpins)
        setNextFree(res.nextFreeSpinAt)
        if (typeof res.coins === 'number') {
          setCoins(res.coins)
          onCoinsChange?.(res.coins)
        }
        if (res.user) onUser?.(res.user)
        setSpinning(false)
      }, duration + 200)
    } catch (e) {
      setSpinning(false)
      const msg = e instanceof ApiError ? e.message : t('lw.error')
      toast.error(msg)
      // Hak/limit değişmiş olabilir -> güncel durumu çek.
      load()
    }
  }

  function closeWin() {
    setResult(null)
  }
  function spinAgain() {
    setResult(null)
    // Bir sonraki karede tekrar çevir (state güncellensin).
    window.setTimeout(() => handleSpin(), 60)
  }

  const showProb = !!data?.settings.showProbability

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card lw-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>

        <div className="lw-head">
          <Icon name="gift" size={20} />
          <span>{t('lw.title')}</span>
        </div>

        {loading ? (
          <p className="lw-note">{t('common.loading')}</p>
        ) : !data || !data.enabled ? (
          <p className="lw-note">{t('lw.disabled')}</p>
        ) : n < 2 || !ready ? (
          <p className="lw-note">{t('lw.notReady')}</p>
        ) : (
          <>
            <div className="lw-stage">
              {/* Üst sabit gösterge */}
              <svg className="lw-pointer" width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
                <polygon points="13,30 2,3 24,3" fill="var(--accent, #a83a2b)" />
                <circle cx="13" cy="6" r="4" fill="#fff" />
              </svg>

              <svg className="lw-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
                <g
                  className="lw-wheel"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? `transform ${duration}ms cubic-bezier(0.15, 0.6, 0.05, 1)` : 'none',
                  }}
                >
                  {rewards.map((rw, i) => {
                    const start = -90 + i * step
                    const end = -90 + (i + 1) * step
                    const [x0, y0] = polar(C, C, R, start)
                    const [x1, y1] = polar(C, C, R, end)
                    const large = step > 180 ? 1 : 0
                    const mid = -90 + (i + 0.5) * step
                    // Etiket RADYAL (dikine): dilim ekseni boyunca, dıştan içe okunur.
                    const [lx, ly] = polar(C, C, R * 0.52, mid)
                    const [ix, iy] = polar(C, C, R * 0.86, mid)
                    return (
                      <g key={rw.id}>
                        <path
                          d={`M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`}
                          fill={rw.sliceColor}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                        <text
                          x={lx.toFixed(2)}
                          y={ly.toFixed(2)}
                          fill={rw.textColor}
                          fontSize={n > 10 ? 10 : 12}
                          fontWeight={600}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${(mid + 180).toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})`}
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
                  <circle cx={C} cy={C} r={40} fill="#ffffff" opacity={0.9} />
                </g>
              </svg>

              <button className="lw-spin-btn" onClick={handleSpin} disabled={spinning || !canSpin}>
                {spinning ? (
                  <Icon name="refresh" size={22} />
                ) : isPaidNext ? (
                  <span className="lw-spin-cost">
                    <span>{t('lw.spinFor', { n: spinCost })}</span>
                    <Icon name="coin" size={16} />
                  </span>
                ) : (
                  <span>{t('lw.spin')}</span>
                )}
              </button>

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

            <div className="lw-meta">
              <span>
                {t('lw.remaining')}: <strong>{remaining}</strong>
              </span>
              {remaining <= 0 && spinCost > 0 ? (
                <span>{t('lw.paidHint', { n: spinCost })}</span>
              ) : remaining <= 0 && nextFree ? (
                <span>
                  {t('lw.nextFree')}: <strong>{new Date(nextFree).toLocaleString()}</strong>
                </span>
              ) : null}
              <span className="lw-coins">
                <Coins amount={coins} size={15} />
              </span>
            </div>

            {!loggedIn ? (
              <p className="lw-note">{t('lw.loginRequired')}</p>
            ) : (
              <p className="lw-note">
                {t('lw.freeInfo')}
                {showProb ? ' · ' + t('lw.probShown') : ''}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
