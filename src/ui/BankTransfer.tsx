import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'

const fmtTL = (kurus: number) =>
  `${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`

// Havale/EFT ekrani. İKİ FAZ:
//  1) ONAY ÖNCESİ (reference yok + onConfirm var): IBAN + tutar gosterilir. "Siparişi Onayla"ya
//     basilinca onConfirm sunucuda odeme kaydini OLUSTURUR (kayit panele O AN duser, referans o an
//     verilir). Onaylamadan vazgecen panele DUSMEZ (kullanici direktifi: phantom kayit olmasin).
//  2) ONAY SONRASI (reference dolu): referans no + havale talimati; odeme 'pending', admin dekontu
//     gorup panelden elle onaylar (coin/uyelik/kargo elle verilir).
export default function BankTransfer({
  reference,
  amount,
  iban,
  name,
  bank,
  note,
  onConfirm,
  onDone,
}: {
  reference?: string
  amount: number // kurus
  iban: string
  name: string
  bank: string
  note?: string
  onConfirm?: () => Promise<void> // odeme kaydini olusturur; basarinca parent reference'i gecer (faz 2)
  onDone: () => void
}) {
  useEscape(onDone)
  const notify = useToast()
  const [copied, setCopied] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const confirmed = !!reference // referans geldiyse odeme kaydi olustu demektir (faz 2)

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      notify.success('Kopyalandı')
      setTimeout(() => setCopied((c) => (c === label ? '' : c)), 1500)
    } catch {
      notify.error('Kopyalanamadı')
    }
  }

  const row = (label: string, value: string, copyKey?: string, mono = false) => (
    <div className="bt-row">
      <span className="bt-label">{label}</span>
      <span className={`bt-value ${mono ? 'bt-mono' : ''}`}>{value}</span>
      {copyKey && (
        <button type="button" className="bt-copy" onClick={() => copy(copyKey, value)} aria-label={`${label} kopyala`}>
          <Icon name={copied === copyKey ? 'check' : 'copy'} size={15} />
        </button>
      )}
    </div>
  )

  // "Siparişi Onayla": odeme kaydini SIMDI olustur. Basarinca parent reference prop'unu set eder ->
  // bilesen yeniden render olur ve faz 2'ye (referans goruntusu) gecer.
  async function confirm() {
    if (!onConfirm || busy) return
    setErr('')
    setBusy(true)
    try {
      await onConfirm()
    } catch (e) {
      setErr((e as { message?: string })?.message || 'Sipariş oluşturulamadı.')
      setBusy(false)
    }
  }

  return (
    <div className="register-overlay page setup-page">
      <div className="register-card bt-card">
        <button type="button" className="checkout-back" onClick={onDone}>
          <Icon name="arrow-right" size={16} /> {confirmed ? 'Kapat' : 'Vazgeç'}
        </button>
        <h2 className="bt-title">
          <Icon name="money" size={20} /> Havale / EFT ile Ödeme
        </h2>

        {confirmed ? (
          <p className="bt-intro">
            Aşağıdaki hesaba <b>{fmtTL(amount)}</b> tutarında havale/EFT gönder. <b>Açıklama</b> kısmına mutlaka
            referans numaranı yaz — ödemeni bu numarayla eşleştiriyoruz.
          </p>
        ) : (
          <p className="bt-intro">
            Aşağıdaki hesaba <b>{fmtTL(amount)}</b> havale/EFT göndereceksin. <b>Siparişi Onayla</b>’ya bastığında
            siparişin oluşturulur ve havale açıklamasına yazacağın <b>referans numaran</b> verilir.
          </p>
        )}

        <div className="bt-box">
          {row('Tutar', fmtTL(amount), 'amount')}
          {row('IBAN', iban, 'iban', true)}
          {name && row('Hesap sahibi', name)}
          {bank && row('Banka', bank)}
          {confirmed && row('Açıklama (referans)', reference!, 'reference', true)}
        </div>

        {note && (
          <div className="bt-note">
            <Icon name="info" size={15} /> <span>{note}</span>
          </div>
        )}

        <div className="bt-status" role="status">
          <Icon name={confirmed ? 'clock' : 'info'} size={15} />
          {confirmed ? (
            <span>
              Ödemen bize ulaşıp <b>onaylanınca</b> siparişin işleme alınır. Onay öncesi durum “Bekliyor” görünür.
            </span>
          ) : (
            <span>
              Onaylamadan sipariş <b>oluşturulmaz</b>. Referans numaran onaydan sonra bu ekranda görünür.
            </span>
          )}
        </div>

        {err && (
          <p className="bt-note" role="alert" style={{ color: '#c0392b' }}>
            <Icon name="info" size={15} /> <span>{err}</span>
          </p>
        )}

        <div className="bt-actions">
          {confirmed ? (
            <Button onClick={onDone}>
              <Icon name="check" size={16} /> Tamam
            </Button>
          ) : (
            <Button onClick={confirm} disabled={busy}>
              <Icon name="check" size={16} /> {busy ? 'İşleniyor…' : 'Siparişi Onayla'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
