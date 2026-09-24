// Ses efektleri: zar/tas/kirma gercek kayit (sample), kazanma/kaybetme sentez.
// Kullanici etkilesiminden sonra AudioContext olusturulur (tarayici kurali).
import diceUrl from './assets/dice-roll.wav' // zar atma (gercek kayit)
import moveUrl from './assets/checker-move.mp3' // tas oynama (her hamlede)
import hitUrl from './assets/checker-hit.ogg' // tas kirma (vurus)
import winUrl from './assets/win.wav' // kazanma marsi (gercek kayit, fade-out)
import loseUrl from './assets/lose.wav' // kaybetme (womp-womp, gercek kayit, fade-out)

let ctx: AudioContext | null = null
// Ses kullanıcı tercihi (kalıcı): VARSAYILAN AÇIK (misafirlere de standart açık gelir).
// Oyun Menüsü > Ses (hoparlör + kaydırıcı) ile kısılıp kapatılabilir.
// localStorage 'tavla.soundoff'='1' -> KULLANICI KAPATTI (sessiz); değer yoksa/'0' -> AÇIK.
// muted true iken ac() null döner, tüm efektler no-op.
let muted = (() => {
  try {
    return localStorage.getItem('tavla.soundoff') === '1'
  } catch {
    return false
  }
})()

// Ses seviyesi (0..1), kalıcı: 'tavla.soundvol'. Tüm efekt gain'leri bununla ölçeklenir.
// Varsayılan 0.7. Slider (Oyun Menüsü) ile ayarlanır.
let volume = (() => {
  try {
    const v = parseFloat(localStorage.getItem('tavla.soundvol') ?? '')
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.7
  } catch {
    return 0.7
  }
})()

export function getVolume(): number {
  return volume
}
export function setVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v))
  try {
    localStorage.setItem('tavla.soundvol', String(volume))
  } catch {
    /* yok */
  }
}

export function isMuted(): boolean {
  return muted
}
export function setMuted(v: boolean): void {
  muted = v
  try {
    localStorage.setItem('tavla.soundoff', v ? '1' : '0')
  } catch {
    /* yok */
  }
  // Açılışta AudioContext'i (kullanıcı jesti içinde) hazırla -> ilk efekt gecikmesiz çalsın.
  if (!v) {
    ac()
    // Örnekleri önceden çöz: ilk zar/hamle/vuruş anında gecikme olmasın.
    void loadSample(diceUrl)
    void loadSample(moveUrl)
    void loadSample(hitUrl)
    void loadSample(winUrl)
    void loadSample(loseUrl)
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
  g.gain.linearRampToValueAtTime(Math.max(0.0001, gain * volume), t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

// --- Gercek kayit (sample) calar: lazy fetch + decode, buffer cache, muted'a saygili ---
const buffers = new Map<string, AudioBuffer>()
const loading = new Map<string, Promise<AudioBuffer | null>>()

function loadSample(url: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(url)
  if (cached) return Promise.resolve(cached)
  const inflight = loading.get(url)
  if (inflight) return inflight
  const c = ac()
  if (!c) return Promise.resolve(null) // muted iken indirme yok
  const p = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((ab) => c.decodeAudioData(ab))
    .then((buf) => {
      buffers.set(url, buf)
      loading.delete(url)
      return buf
    })
    .catch(() => {
      loading.delete(url)
      return null
    })
  loading.set(url, p)
  return p
}

function playBuffer(c: AudioContext, buf: AudioBuffer, gain: number) {
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = gain * volume
  src.connect(g).connect(c.destination)
  src.start()
}

function play(url: string, gain = 0.7) {
  const c = ac()
  if (!c) return
  const buf = buffers.get(url)
  if (buf) {
    playBuffer(c, buf, gain)
    return
  }
  // Henuz yuklenmedi -> yukle ve hazir olunca bir kez cal (ilk sefer kucuk gecikme).
  void loadSample(url).then((b) => {
    const cc = ac()
    if (b && cc) playBuffer(cc, b, gain)
  })
}

export const Sound = {
  dice() {
    play(diceUrl, 0.5)
  },
  move() {
    play(moveUrl, 0.32)
  },
  hit() {
    play(hitUrl, 0.5)
  },
  win() {
    play(winUrl, 0.75)
  },
  lose() {
    play(loseUrl, 0.55)
  },
  double() {
    tone(440, 0, 0.1, 'square', 0.18)
    tone(660, 0.09, 0.14, 'square', 0.18)
  },
}
