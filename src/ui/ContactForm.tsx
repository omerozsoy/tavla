import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { sendContact, ApiError } from '../api'
import './contactForm.css'

// İletişim / turnuva organizasyonu talep formu. /iletisim sayfasinda ve turnuva
// organizasyonu landing'lerinde (kurumsal/belediye/avm/hub) render edilir. Misafir de
// gonderebilir; /api/contact ucuna POST eder. source_page + varsayilan talep turu (subject)
// hangi sayfadan geldigini panelde gosterir.
interface Props {
  sourcePage: string // slug (source_page + panelde koken)
  defaultSubject?: string // kurumsal | belediye | avm | online | genel
  heading?: string
}

const SUBJECTS: { value: string; label: string }[] = [
  { value: 'kurumsal', label: 'Kurumsal Turnuva' },
  { value: 'belediye', label: 'Belediye Turnuvası' },
  { value: 'avm', label: 'AVM Turnuvası' },
  { value: 'online', label: 'Online Turnuva' },
  { value: 'genel', label: 'Genel / Diğer' },
]

export default function ContactForm({ sourcePage, defaultSubject = 'genel', heading }: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState(defaultSubject)
  const [city, setCity] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [participants, setParticipants] = useState('')
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (name.trim().length < 2) {
      toast.error('Lütfen adınızı girin.')
      return
    }
    if (!email.trim() && !phone.trim()) {
      toast.error('Size dönebilmemiz için e-posta veya telefon bırakın.')
      return
    }
    if (message.trim().length < 5) {
      toast.error('Lütfen kısa bir mesaj yazın.')
      return
    }
    setBusy(true)
    try {
      const partNum = parseInt(participants.replace(/\D+/g, ''), 10)
      await sendContact({
        name: name.trim(),
        org: org.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        subject,
        city: city.trim() || null,
        event_date: eventDate.trim() || null,
        participants: Number.isFinite(partNum) ? partNum : null,
        message: message.trim(),
        source_page: sourcePage,
        url: typeof location !== 'undefined' ? location.href : null,
      })
      setDone(true)
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 429
          ? 'Çok fazla istek. Lütfen birkaç dakika sonra tekrar deneyin.'
          : err instanceof ApiError && err.status === 422
            ? err.message
            : 'Gönderilemedi. Lütfen daha sonra tekrar deneyin.'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="contact-form contact-done">
        <div className="contact-done-icon">
          <Icon name="check" size={28} />
        </div>
        <h3>Talebiniz alındı</h3>
        <p>
          En kısa sürede size dönüş yapacağız. Teklif ve organizasyon detayları için ekibimiz
          sizinle iletişime geçecek.
        </p>
      </div>
    )
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      {heading && <h3 className="contact-form-title">{heading}</h3>}

      <div className="cf-grid">
        <label className="cf-field">
          <span>Ad Soyad *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </label>
        <label className="cf-field">
          <span>Kurum / Şirket</span>
          <input
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            maxLength={160}
            placeholder="Firma, belediye, AVM…"
          />
        </label>
        <label className="cf-field">
          <span>E-posta</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={190}
            placeholder="ornek@kurum.com"
          />
        </label>
        <label className="cf-field">
          <span>Telefon</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            placeholder="05xx xxx xx xx"
          />
        </label>
        <label className="cf-field">
          <span>Talep türü</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cf-field">
          <span>İl / Şehir</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
        </label>
        <label className="cf-field">
          <span>Etkinlik tarihi</span>
          <input
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            maxLength={60}
            placeholder="Örn: Kasım 2026 / henüz net değil"
          />
        </label>
        <label className="cf-field">
          <span>Tahmini katılımcı</span>
          <input
            inputMode="numeric"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            maxLength={6}
            placeholder="Örn: 64"
          />
        </label>
      </div>

      <label className="cf-field cf-full">
        <span>Mesajınız *</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Etkinlik amacınız, beklentileriniz ve varsa bütçe/tarih bilgisi…"
          required
        />
      </label>

      <p className="cf-note">
        * En az bir iletişim kanalı (e-posta veya telefon) bırakın. Bilgileriniz yalnızca size
        dönüş için kullanılır.
      </p>

      <Button type="submit" className="cf-submit" disabled={busy}>
        <Icon name="paper-plane-right" size={16} />
        {busy ? 'Gönderiliyor…' : 'Talebi Gönder'}
      </Button>
    </form>
  )
}
