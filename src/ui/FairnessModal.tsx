import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { sha256Hex, verifyRoll } from '../engine/fairDice'

interface Props {
  commitment: string
  clientSeed: string
  serverSeed?: string // yalnizca mac bittiginde ifsa edilir
  rolls: number
  onClose: () => void
}

// Infografik 4 adimi (Phosphor ikon + i18n anahtar koku). DOKUNMA: dogrulama mantigi ayri.
const STEPS: { icon: IconName; key: string }[] = [
  { icon: 'lock-key', key: 's1' },
  { icon: 'fingerprint', key: 's2' },
  { icon: 'dice', key: 's3' },
  { icon: 'shield-check', key: 's4' },
]

// Zar degeri (1..6) -> Phosphor zar yuzu ikonu
function dieIcon(v: number): IconName {
  const n = Math.min(6, Math.max(1, Math.round(v)))
  return ('die-' + n) as IconName
}

export default function FairnessModal({ commitment, clientSeed, serverSeed, rolls, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [vServer, setVServer] = useState(serverSeed ?? '')
  const [vClient, setVClient] = useState(clientSeed)
  const [vNonce, setVNonce] = useState(0)
  const [result, setResult] = useState<{ dice: number[]; match: boolean } | null>(null)
  const [showTech, setShowTech] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // DEGISTIRME: mevcut dogrulama (SHA-256 commitment + verifyRoll) aynen korunur.
  function doVerify() {
    const dice = verifyRoll(vServer.trim(), vClient.trim(), vNonce)
    const match = sha256Hex(vServer.trim()) === commitment
    setResult({ dice, match })
  }

  function copy(text: string, key: string) {
    try {
      navigator.clipboard?.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600)
    } catch {
      /* pano erisimi yoksa sessiz gec */
    }
  }

  // Kisaltilmis hash (kanit ornegi): 8…8
  const shortHash = commitment.length > 20 ? `${commitment.slice(0, 8)}…${commitment.slice(-8)}` : commitment

  const techRows: { key: string; label: string; value: string; hidden?: boolean }[] = [
    { key: 'commitment', label: t('fair.commitment'), value: commitment },
    { key: 'clientSeed', label: t('fair.clientSeed'), value: clientSeed },
    { key: 'serverSeed', label: t('fair.serverSeed'), value: serverSeed ?? '', hidden: !serverSeed },
  ]

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card fair-card" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="shield-check" size={20} /> {t('fair.title')}
        </h2>

        {/* ==================== INFOGRAFİK ==================== */}
        <section className="fair-info" aria-label={t('fair.howTitle')}>
          <div className="fair-info-head">
            <span className="fair-info-ic" aria-hidden="true">
              <Icon name="dice" size={26} />
            </span>
            <h3>{t('fair.howTitle')}</h3>
            <p>{t('fair.howSub')}</p>
          </div>

          {/* 4 adimli akis */}
          <ol className="fair-steps">
            {STEPS.map((s, i) => (
              <li className="fair-step" key={s.key}>
                <span className="fair-step-num">{i + 1}</span>
                <span className="fair-step-ic" aria-hidden="true">
                  <Icon name={s.icon} size={26} />
                </span>
                <span className="fair-step-title">{t(`fair.${s.key}.title`)}</span>
                <span className="fair-step-desc">{t(`fair.${s.key}.desc`)}</span>

                {s.key === 's2' && (
                  <span className="fair-step-proof">
                    <code>{shortHash}</code>
                  </span>
                )}
                {s.key === 's3' && (
                  <span className="fair-step-dice" aria-hidden="true">
                    <Icon name="die-5" size={26} />
                    <Icon name="die-3" size={26} />
                  </span>
                )}
                {s.key === 's4' && (
                  <span className="fair-step-badge">
                    <Icon name="check" size={13} /> {t('fair.s4.badge')}
                  </span>
                )}

                {(s.key === 's1' || s.key === 's2' || s.key === 's4') && (
                  <span className="fair-step-sub">{t(`fair.${s.key}.sub`)}</span>
                )}
              </li>
            ))}
          </ol>

          {/* Mühürlü kutu benzetmesi */}
          <div className="fair-box">
            <div className="fair-box-title">
              <Icon name="package" size={18} /> {t('fair.box.title')}
            </div>
            <div className="fair-box-steps">
              <div className="fair-box-step">
                <span className="fair-box-ic" aria-hidden="true"><Icon name="lock-key" size={22} /></span>
                <span>{t('fair.box.1')}</span>
              </div>
              <div className="fair-box-step">
                <span className="fair-box-ic" aria-hidden="true"><Icon name="tag" size={22} /></span>
                <span>{t('fair.box.2')}</span>
              </div>
              <div className="fair-box-step">
                <span className="fair-box-ic" aria-hidden="true"><Icon name="lock-open" size={22} /></span>
                <span>{t('fair.box.3')}</span>
              </div>
            </div>
            <div className="fair-box-result">
              <Icon name="check" size={15} /> {t('fair.box.result')}
            </div>
          </div>

          {/* Ana mesaj (callout) */}
          <div className="fair-callout">
            <span className="fair-callout-ic" aria-hidden="true">
              <Icon name="shield-check" size={30} />
            </span>
            <div className="fair-callout-text">
              <div className="fair-callout-title">{t('fair.callout.title')}</div>
              <div className="fair-callout-sub">{t('fair.callout.sub')}</div>
            </div>
          </div>
        </section>

        {/* ==================== TEKNİK DETAYLAR (accordion) ==================== */}
        <div className={`fair-tech ${showTech ? 'open' : ''}`}>
          <button
            type="button"
            className="fair-tech-toggle"
            onClick={() => setShowTech((v) => !v)}
            aria-expanded={showTech}
          >
            <Icon name="code" size={16} />
            <span className="fair-tech-toggle-txt">
              {showTech ? t('fair.techToggleHide') : t('fair.techToggle')}
            </span>
            <Icon name="chevron" size={16} className="fair-tech-chev" />
          </button>
          {showTech && (
            <div className="fair-tech-body">
              {techRows.map((r) => (
                <div className="fair-trow" key={r.key}>
                  <span className="fair-trow-label">{r.label}</span>
                  {r.hidden ? (
                    <span className="fair-hidden">{t('fair.hidden')}</span>
                  ) : (
                    <span className="fair-trow-val">
                      <code>{r.value}</code>
                      <button
                        type="button"
                        className="fair-copy"
                        onClick={() => copy(r.value, r.key)}
                        aria-label={t('fair.copied')}
                        title={t('fair.copied')}
                      >
                        <Icon name={copied === r.key ? 'check' : 'copy'} size={14} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
              <div className="fair-rolls">{t('fair.rolls', { n: rolls })}</div>
              {copied && <div className="fair-copied-note">{t('fair.copied')}</div>}
            </div>
          )}
        </div>

        {/* ==================== DOĞRULAMA ARACI ==================== */}
        <section className="fair-verify">
          <h3>{t('fair.verify.title')}</h3>
          <p className="fair-verify-sub">{t('fair.verify.sub')}</p>

          <label className="fair-vlabel">
            <span className="fair-vlabel-head">
              <span className="fair-vlabel-main">{t('fair.verify.serverLabel')}</span>
              <span className="fair-vlabel-tech">serverSeed</span>
            </span>
            <input value={vServer} onChange={(e) => setVServer(e.target.value)} placeholder="…" />
          </label>
          <label className="fair-vlabel">
            <span className="fair-vlabel-head">
              <span className="fair-vlabel-main">{t('fair.verify.clientLabel')}</span>
              <span className="fair-vlabel-tech">clientSeed</span>
            </span>
            <input value={vClient} onChange={(e) => setVClient(e.target.value)} />
          </label>
          <label className="fair-vlabel">
            <span className="fair-vlabel-head">
              <span className="fair-vlabel-main">{t('fair.verify.nonceLabel')}</span>
              <span className="fair-vlabel-tech">nonce · 0…{Math.max(0, rolls - 1)}</span>
            </span>
            <input
              type="number"
              min={0}
              value={vNonce}
              onChange={(e) => setVNonce(Math.max(0, Number(e.target.value)))}
            />
          </label>

          <Button variant="default" className="fair-verify-cta" onClick={doVerify}>
            <Icon name="search" size={16} /> {t('fair.verify.cta')}
          </Button>

          {result && (
            <div className={`fair-vresult ${result.match ? 'ok' : 'bad'}`}>
              <div className="fair-vresult-head">
                <Icon name={result.match ? 'shield-check' : 'warning-circle'} size={20} />
                <b>{result.match ? t('fair.verify.okTitle') : t('fair.verify.badTitle')}</b>
              </div>
              <p className="fair-vresult-desc">
                {result.match ? t('fair.verify.okDesc') : t('fair.verify.badDesc')}
              </p>
              <div className="fair-vdice" aria-hidden="true">
                {result.dice.slice(0, result.dice.length === 4 ? 4 : 2).map((d, i) => (
                  <Icon key={i} name={dieIcon(d)} size={38} />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
