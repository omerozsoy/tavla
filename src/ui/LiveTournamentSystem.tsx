import { useState } from 'react'
import { useEscape } from './useEscape'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n'

interface Props {
  onClose: () => void
  titleOverride?: string
}

type Where = 'tavlatv' | 'self'
type TType = 'swiss' | 'bracket'
type Size = 8 | 16 | 32 | 64 | 128 | 'unlimited'
type Bye = 'manual' | 'auto'

const BRACKET_SIZES: Size[] = [8, 16, 32, 64, 128, 'unlimited']
const SWISS_LIVES = [1, 2, 3]

// Canlı Turnuva Sistemi — dallanan kurulum formu. Maçların yeri + turnuva tipi; Swiss ise
// hak sayısı, Bracket ise kişi sayısı sorulur. Gönderim backend'i henüz YOK -> şimdilik
// seçimler özetlenir (ponytail: submit hedefi tanımlanınca burada POST aç).
export default function LiveTournamentSystem({ onClose, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [where, setWhere] = useState<Where | null>(null)
  const [ttype, setTtype] = useState<TType | null>(null)
  const [lives, setLives] = useState<number | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [bye, setBye] = useState<Bye | null>(null)
  const [done, setDone] = useState(false)

  const title = titleOverride || t('menu.liveTournSystem')
  // Swiss: hak + kişi sayısı; Bracket: yalnız kişi sayısı. Kişi sayısından sonra bay (bye) çekim usulü.
  const sizeDone =
    size != null && (ttype === 'swiss' ? lives != null : ttype === 'bracket' ? true : false)
  const complete = !!where && sizeDone && bye != null

  // Turnuva tipi değişince alt cevapları sıfırla (Swiss hak ≠ Bracket kişi).
  const pickType = (v: TType) => {
    setTtype(v)
    setLives(null)
    setSize(null)
    setBye(null)
  }

  const reset = () => {
    setWhere(null)
    setTtype(null)
    setLives(null)
    setSize(null)
    setBye(null)
    setDone(false)
  }

  const Opt = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <Button type="button" variant={active ? 'default' : 'outline'} className="lts-opt" onClick={onClick}>
      {children}
    </Button>
  )

  const sizeLabel = (s: Size) => (s === 'unlimited' ? t('lts.unlimited') : String(s))

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card info-card lts-card">
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2 className="info-title">
          <Icon name="trophy" size={22} /> {title}
        </h2>

        {done ? (
          <div className="lts-done">
            <p className="info-rich rich">{t('lts.done')}</p>
            <ul className="lts-summary">
              <li>
                <b>{t('lts.q1')}</b> {t(where === 'tavlatv' ? 'lts.where.tavlatv' : 'lts.where.self')}
              </li>
              <li>
                <b>{t('lts.q2')}</b> {ttype === 'swiss' ? 'Swiss' : 'Bracket'}
              </li>
              {ttype === 'swiss' && (
                <li>
                  <b>{t('lts.q3.swiss')}</b> {lives}
                </li>
              )}
              <li>
                <b>{t('lts.q3.bracket')}</b> {size != null ? sizeLabel(size) : ''}
              </li>
              <li>
                <b>{t('lts.q5')}</b> {bye ? t(bye === 'manual' ? 'lts.bye.manual' : 'lts.bye.auto') : ''}
              </li>
            </ul>
            <Button type="button" variant="outline" onClick={reset}>
              {t('lts.again')}
            </Button>
          </div>
        ) : (
          <form
            className="lts-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (complete) setDone(true)
            }}
          >
            <p className="info-rich rich lts-intro">{t('lts.intro')}</p>

            <div className="lts-q">
              <h3 className="lts-q-label">1. {t('lts.q1')}</h3>
              <div className="lts-opts">
                <Opt active={where === 'tavlatv'} onClick={() => setWhere('tavlatv')}>
                  {t('lts.where.tavlatv')}
                </Opt>
                <Opt active={where === 'self'} onClick={() => setWhere('self')}>
                  {t('lts.where.self')}
                </Opt>
              </div>
            </div>

            {where && (
              <div className="lts-q">
                <h3 className="lts-q-label">2. {t('lts.q2')}</h3>
                <div className="lts-opts">
                  <Opt active={ttype === 'swiss'} onClick={() => pickType('swiss')}>
                    Swiss
                  </Opt>
                  <Opt active={ttype === 'bracket'} onClick={() => pickType('bracket')}>
                    Bracket
                  </Opt>
                </div>
              </div>
            )}

            {ttype === 'swiss' && (
              <div className="lts-q">
                <h3 className="lts-q-label">3. {t('lts.q3.swiss')}</h3>
                <div className="lts-opts">
                  {SWISS_LIVES.map((n) => (
                    <Opt key={n} active={lives === n} onClick={() => setLives(n)}>
                      {n}
                    </Opt>
                  ))}
                </div>
              </div>
            )}

            {/* Swiss: hak seçilince kişi sayısı da sorulur (Bracket ile aynı seçenekler). */}
            {ttype === 'swiss' && lives != null && (
              <div className="lts-q">
                <h3 className="lts-q-label">4. {t('lts.q3.bracket')}</h3>
                <div className="lts-opts">
                  {BRACKET_SIZES.map((s) => (
                    <Opt key={String(s)} active={size === s} onClick={() => setSize(s)}>
                      {sizeLabel(s)}
                    </Opt>
                  ))}
                </div>
              </div>
            )}

            {ttype === 'bracket' && (
              <div className="lts-q">
                <h3 className="lts-q-label">3. {t('lts.q3.bracket')}</h3>
                <div className="lts-opts">
                  {BRACKET_SIZES.map((s) => (
                    <Opt key={String(s)} active={size === s} onClick={() => setSize(s)}>
                      {sizeLabel(s)}
                    </Opt>
                  ))}
                </div>
              </div>
            )}

            {/* Kişi sayısı seçilince bay (bye) çekim usulü. Numara dala göre (Swiss 5, Bracket 4). */}
            {sizeDone && (
              <div className="lts-q">
                <h3 className="lts-q-label">
                  {ttype === 'swiss' ? 5 : 4}. {t('lts.q5')}
                </h3>
                <div className="lts-opts">
                  <Opt active={bye === 'manual'} onClick={() => setBye('manual')}>
                    {t('lts.bye.manual')}
                  </Opt>
                  <Opt active={bye === 'auto'} onClick={() => setBye('auto')}>
                    {t('lts.bye.auto')}
                  </Opt>
                </div>
              </div>
            )}

            {complete && (
              <Button type="submit" className="lts-submit">
                {t('lts.submit')}
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
