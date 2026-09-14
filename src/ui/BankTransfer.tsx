import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'

const fmtTL = (kurus: number) =>
  `${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`

// Havale/EFT talimat ekrani: kart formu YERINE gosterilir. Musteri IBAN'a gonderir,
// ACIKLAMAYA referans (siparis no) yazar. Odeme 'pending' kalir; admin dekontu gorup
// panelden elle onaylar (coin/uyelik/kargo elle verilir).
export default function BankTransfer({
  reference,
  amount,
  iban,
  name,
  bank,
  note,
  onDone,
}: {
  reference: string
  amount: number // kurus
  iban: string
  name: string
  bank: string
  note?: string
  onDone: () => void
}) {
  useEscape(onDone)
  const notify = useToast()
  const [copied, setCopied] = useState<string>('')

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

  return (
    <div className="register-overlay page setup-page">
      <div className="register-card bt-card">
        <button type="button" className="checkout-back" onClick={onDone}>
          <Icon name="arrow-right" size={16} /> Kapat
        </button>
        <h2 className="bt-title">
          <Icon name="bank" size={20} /> Havale / EFT ile Ödeme
        </h2>
        <p className="bt-intro">
          Aşağıdaki hesaba <b>{fmtTL(amount)}</b> tutarında havale/EFT gönder. <b>Açıklama</b> kısmına mutlaka
          referans numaranı yaz — ödemeni bu numarayla eşleştiriyoruz.
        </p>

        <div className="bt-box">
          {row('Tutar', fmtTL(amount), 'amount')}
          {row('IBAN', iban, 'iban', true)}
          {name && row('Hesap sahibi', name)}
          {bank && row('Banka', bank)}
          {row('Açıklama (referans)', reference, 'reference', true)}
        </div>

        {note && (
          <div className="bt-note">
            <Icon name="info" size={15} /> <span>{note}</span>
          </div>
        )}

        <div className="bt-status" role="status">
          <Icon name="clock" size={15} />
          <span>
            Ödemen bize ulaşıp <b>onaylanınca</b> siparişin işleme alınır. Onay öncesi durum “Bekliyor” görünür.
          </span>
        </div>

        <div className="bt-actions">
          <Button onClick={onDone}>
            <Icon name="check" size={16} /> Anladım
          </Button>
        </div>
      </div>
    </div>
  )
}
