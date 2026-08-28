import type { CSSProperties } from 'react'
import './SoberFrame.css'

// Sade-premium avatar cerceve (CSS/SVG, Rive YOK) + genis animasyon kutuphanesi.
// Ince halka + merkez seffaf (yuz kapanmaz). Tek 'motion' prop'u hangi animasyonun oynayacagini secer.
export type SoberMotion =
  | 'static' | 'hover' | 'breathe' | 'glowPulse' | 'flicker' | 'heartbeat' | 'fade' | 'ember'
  | 'pulse' | 'float' | 'levitate' | 'bounce' | 'jelly' | 'heartScale' | 'nudge'
  | 'sway' | 'wobble' | 'tilt' | 'rock' | 'pendulum' | 'spin' | 'spinSlow' | 'flip3d'
  | 'sheen' | 'shimmer' | 'drift'
  | 'hueCycle' | 'saturate' | 'bright' | 'contrast' | 'invert' | 'blur'
  | 'sweep' | 'sweepRev' | 'sweepFast' | 'dualSweep' | 'trace'
  | 'gradSpin' | 'gradPulse'
  | 'sparkle' | 'twinkle' | 'sparkleBurst'
  | 'orbit' | 'comet' | 'dualOrbit'
  | 'aura' | 'auraPulse' | 'ripple' | 'radar' | 'dualRipple'

export type SoberRarity = 'rare' | 'epic' | 'legendary' | 'mythic'

export interface SoberFrameProps {
  rarity?: SoberRarity
  accent?: string
  motion?: SoberMotion
  size?: number
  src?: string | null
}

const SWEEP = new Set<SoberMotion>(['sweep', 'sweepRev', 'sweepFast', 'dualSweep', 'trace'])
const SPARK_MULTI = new Set<SoberMotion>(['twinkle', 'sparkleBurst'])

const AVA =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#3b4a6b"/><stop offset="1" stop-color="#0d1120"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="40" r="17" fill="#c9d4e8"/><path d="M21 90c0-18 14-28 29-28s29 10 29 28z" fill="#c9d4e8"/></svg>`,
  )

export default function SoberFrame({
  rarity = 'rare',
  accent,
  motion = 'static',
  size = 104,
  src,
}: SoberFrameProps) {
  const style = {
    ['--sf-size']: `${size}px`,
    ...(accent
      ? { ['--sf-grad']: `linear-gradient(135deg, ${accent}, ${accent}cc)`, ['--sf-glow']: `${accent}99` }
      : {}),
  } as CSSProperties
  const multiSpark = SPARK_MULTI.has(motion)
  return (
    <span className={`sf ${accent ? '' : 'sf-r-' + rarity} sf-m-${motion}`} style={style} aria-hidden="true">
      <span className="sf-glow" />
      <span className="sf-ring" />
      {SWEEP.has(motion) && <span className="sf-sweep" />}
      {(motion === 'sparkle' || multiSpark) && <span className="sf-spark sf-spark-1" />}
      {multiSpark && <span className="sf-spark sf-spark-2" />}
      {multiSpark && <span className="sf-spark sf-spark-3" />}
      <img className="sf-avatar" src={src || AVA} alt="" draggable={false} />
    </span>
  )
}
