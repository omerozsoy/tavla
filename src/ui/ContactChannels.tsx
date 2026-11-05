import { Icon, type IconName } from './Icon'
import './contactForm.css'

// Site geneli iletişim kanalları (e-posta/GSM/Instagram/YouTube) + firma/yasal bilgi.
// /iletisim (ServiceLanding) ve /bilgi/hakkinda (Info "Hakkımızda") ortak kullanır → tek kaynak.
const CHANNELS: { icon: IconName; label: string; value: string; href: string; ext?: boolean }[] = [
  { icon: 'mail', label: 'E-posta', value: 'bilgi@tavlatv.com', href: 'mailto:bilgi@tavlatv.com' },
  { icon: 'phone', label: 'GSM', value: '+90 537 389 1907', href: 'tel:+905373891907' },
  { icon: 'instagram', label: 'Instagram', value: 'instagram.com/tavlatv', href: 'https://instagram.com/tavlatv', ext: true },
  { icon: 'youtube', label: 'YouTube', value: 'youtube.com/@TavlaTV', href: 'https://www.youtube.com/@TavlaTV', ext: true },
]

export function ContactChannels() {
  return (
    <div className="contact-channels" aria-label="İletişim kanalları">
      {CHANNELS.map((c) => (
        <a
          key={c.label}
          className="contact-channel"
          href={c.href}
          {...(c.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <span className="cc-icon">
            <Icon name={c.icon} size={20} />
          </span>
          <span className="cc-text">
            <span className="cc-label">{c.label}</span>
            <span className="cc-value">{c.value}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

// Firma / yasal künye: işletme sahibi + Vergi Kimlik No (impressum). Hakkımızda üstünde kartların altında.
export function ContactLegal() {
  return (
    <div className="contact-legal">
      <span className="cc-label">Caner Çelik</span>
      <span className="cc-value">Vergi Kimlik No: 2360567408</span>
    </div>
  )
}
