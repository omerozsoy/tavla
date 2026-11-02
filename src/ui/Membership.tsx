import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { PLANS, type PlanId } from '../plans'
import { type BankTransferResult } from '../api'
import { Button } from '@/components/ui/button'

export default function Membership({
  current,
  onClose,
  onExtend,
  daysLeft,
  titleOverride,
}: {
  current: PlanId
  onClose: () => void
  onExtend?: () => void // premiumu 1 yillik SEPETE ekler; odeme (kart/havale) SEPETTE secilir
  daysLeft?: number // aktif premium: uyeligin bitmesine kalan gun (buton alti "hemen uzat" notu)
  // onBankTransfer: artik kullanilmiyor (odeme sepette yonetiliyor); App uyumu icin opsiyonel tutuldu
  onBankTransfer?: (r: BankTransferResult) => void
  // admin "Sayfa Metni" baslik override'i (bos -> i18n varsayilani)
  titleOverride?: string
}) {
  const { t } = useT()
  useEscape(onClose)
  // Zaten premium olan uyeye "Üyeliği Yükselt" + Ücretsiz plan kiyaslamasi saçma; bu ekran
  // onlar icin "Üyeliğini Uzat" (yalniz mevcut plan + uzatma). Ucretsiz/misafir icin degismez.
  const premium = current === 'premium'
  const plans = premium ? PLANS.filter((p) => p.id !== 'free') : PLANS

  return (
    <div className="register-overlay modal mem-overlay">
      <div className="mem-card" onClick={(e) => e.stopPropagation()}>
        <Button type="button" variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2 className="mem-title"><Icon name="crown" size={20} /> {titleOverride || (premium ? t('mem.status.renew') : t('mem.title'))}</h2>

        <div className={`mem-grid ${premium ? 'mem-grid--single' : ''}`}>
          {plans.map((p) => {
            const isCurrent = current === p.id
            const price = p.yearly
            return (
              <div key={p.id} className={`mem-plan ${p.id !== 'free' ? 'paid' : ''}`}>
                <div className="mem-plan-name" style={{ color: p.color }}>
                  {t(p.nameKey)}
                </div>
                {/* Fiyat basligi — her zaman gorunur (yenileme durumunda bile) */}
                <div className="mem-price-head">
                  <span className="mem-price-num">
                    {price.toLocaleString('tr-TR', {
                      minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ₺
                  </span>
                  <span className="mem-price-per">/{t('mem.perYear')}</span>
                </div>
                <ul className="mem-feats">
                  {p.features.map((f) => (
                    <li key={f.key} className={f.on ? 'on' : 'off'}>
                      <Icon name={f.on ? 'check' : 'x'} size={14} /> {t(f.key)}
                    </li>
                  ))}
                </ul>
                <div className="mem-cta">
                  {p.id === 'free' ? (
                    <span className="mem-free-note">—</span>
                  ) : (
                    // Premium: HER ZAMAN sepete ekle (kart/havale SEPETTE secilir, modalde degil).
                    // Etiket: aktif uyelikte "Üyeliğini Uzat", degilse "Sepete Ekle". onExtend App'te
                    // premiumu sepete koyup sepeti acar.
                    <>
                      <Button
                        variant={isCurrent ? 'secondary' : 'default'}
                        className="w-full"
                        onClick={() => onExtend?.()}
                      >
                        {isCurrent ? t('mem.status.renew') : t('products.addToCart')}
                      </Button>
                      {/* Aktif premium: buton alti "Üyeliğin bitmesine X gün kaldı, hemen uzat" -> sepete */}
                      {isCurrent && daysLeft != null && (
                        <button
                          type="button"
                          className="mem-renew-note"
                          onClick={() => onExtend?.()}
                          style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center' }}
                        >
                          {t('mem.daysLeft', { n: daysLeft })}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
