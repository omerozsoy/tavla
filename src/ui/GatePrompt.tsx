import { useEffect, useState } from 'react'
import { setGate, onGateRequired } from '../api'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'

// "Kapali test" sifre ekrani. Kok seviyede (main.tsx) mount edilir; normalde HIC bir sey
// gostermez. Bir /api istegi 401 {gate:true} donunce (SITE_PASSWORD tanimli ve sifre yok/yanlis)
// onGateRequired tetiklenir -> tum ekrani kaplayan form gorunur. Dogru sifre girilince
// localStorage'a yazilir ve sayfa yenilenir (tum veri X-Site-Gate basligiyla yeniden cekilir).
export default function GatePrompt() {
  const [show, setShow] = useState(false)
  const [pw, setPw] = useState('')

  useEffect(() => {
    onGateRequired(() => setShow(true))
  }, [])

  if (!show) return null

  const submit = () => {
    const v = pw.trim()
    if (!v) return
    setGate(v)
    window.location.reload()
  }

  return (
    <div className="gate-overlay">
      <div className="gate-card">
        <span className="gate-icon" aria-hidden="true">
          <Icon name="lock" size={26} />
        </span>
        <h1 className="gate-title">Kapalı Test</h1>
        <p className="gate-sub">Bu ortam şu an yalnızca erişim şifresi olanlara açık.</p>
        <input
          className="gate-input"
          type="password"
          autoFocus
          value={pw}
          placeholder="Erişim şifresi"
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <Button variant="default" className="w-full" onClick={submit} disabled={!pw.trim()}>
          <Icon name="arrow-right" size={16} /> Giriş
        </Button>
      </div>
    </div>
  )
}
