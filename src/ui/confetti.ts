// Hafif, bagimsiz konfeti patlamasi (yeni baimlilik YOK). Belirtilen ekran
// koordinatindan renkli parcaciklar sacar; transform/opacity ile GPU-hizlandirmali.
// [[fixed-portal-transform-tuzagi]]: body'ye eklenir (position:fixed) -> ust bar
// transform'undan kirpilmaz/kaymaz. prefers-reduced-motion'da sessizce atlanir.

const CONFETTI_COLORS = [
  '#c9563f', // kiremit (accent ailesi)
  '#e0a458', // altin/sari
  '#3f7d6e', // yesil
  '#6e93c9', // mavi
  '#d8c3a5', // krem
  '#b5485f', // koyu pembe/bordo
]

export function burstConfetti(x: number, y: number, count = 30): void {
  if (typeof document === 'undefined') return
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  } catch {
    /* matchMedia yoksa devam */
  }

  const root = document.createElement('div')
  root.className = 'confetti-burst'
  root.style.left = `${x}px`
  root.style.top = `${y}px`

  for (let i = 0; i < count; i++) {
    const p = document.createElement('i')
    const angle = Math.random() * Math.PI * 2
    const dist = 55 + Math.random() * 95
    const dx = Math.cos(angle) * dist
    // Baslangicta yukari dogru itki (yer cekimi keyframe'de asagi ceker)
    const dy = Math.sin(angle) * dist - (35 + Math.random() * 55)
    p.style.setProperty('--dx', `${dx.toFixed(1)}px`)
    p.style.setProperty('--dy', `${dy.toFixed(1)}px`)
    p.style.setProperty('--rot', `${(Math.random() * 720 - 360).toFixed(0)}deg`)
    p.style.setProperty('--delay', `${(Math.random() * 70).toFixed(0)}ms`)
    p.style.setProperty('--sz', `${(6 + Math.random() * 5).toFixed(1)}px`)
    p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    if (Math.random() < 0.45) p.style.borderRadius = '50%'
    root.appendChild(p)
  }

  document.body.appendChild(root)
  window.setTimeout(() => root.remove(), 1500)
}

// Bir DOM ogesinin merkezinden patlat (buton rect'i).
export function burstConfettiAt(el: Element | null, count?: number): void {
  if (!el) return
  const r = el.getBoundingClientRect()
  burstConfetti(r.left + r.width / 2, r.top + r.height / 2, count)
}
