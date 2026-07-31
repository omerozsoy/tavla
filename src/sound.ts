// Basit ses efektleri (Web Audio ile sentez, harici dosya yok).
// Kullanici etkilesiminden sonra AudioContext olusturulur (tarayici kurali).

let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem('tavla.muted') === '1'
} catch {
  /* yok */
}

export function isMuted(): boolean {
  return muted
}
export function setMuted(v: boolean) {
  muted = v
  try {
    localStorage.setItem('tavla.muted', v ? '1' : '0')
  } catch {
    /* yok */
  }
}

function ac(): AudioContext | null {
  if (muted) return null
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Tek ton (zarf ile)
function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

// Kisa gurultu patlamasi (zar/tas sesi)
function noise(start: number, dur: number, gain = 0.15, hp = 1200) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + start
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
  const src = c.createBufferSource()
  src.buffer = buf
  const filt = c.createBiquadFilter()
  filt.type = 'highpass'
  filt.frequency.value = hp
  const g = c.createGain()
  g.gain.value = gain
  src.connect(filt).connect(g).connect(c.destination)
  src.start(t0)
}

export const Sound = {
  dice() {
    noise(0, 0.09, 0.18, 900)
    noise(0.11, 0.08, 0.15, 1100)
  },
  move() {
    tone(320, 0, 0.08, 'triangle', 0.18)
  },
  hit() {
    tone(160, 0, 0.14, 'square', 0.22)
    noise(0, 0.06, 0.14, 600)
  },
  win() {
    tone(523, 0, 0.16, 'sine', 0.2)
    tone(659, 0.12, 0.16, 'sine', 0.2)
    tone(784, 0.24, 0.28, 'sine', 0.22)
  },
  lose() {
    tone(392, 0, 0.2, 'sine', 0.18)
    tone(311, 0.16, 0.32, 'sine', 0.18)
  },
  double() {
    tone(440, 0, 0.1, 'square', 0.18)
    tone(660, 0.09, 0.14, 'square', 0.18)
  },
}
