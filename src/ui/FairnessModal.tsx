import { useState } from 'react'
import { useT } from '../i18n'
import { sha256Hex, verifyRoll } from '../engine/fairDice'

interface Props {
  commitment: string
  clientSeed: string
  serverSeed?: string // yalnizca mac bittiginde ifsa edilir
  rolls: number
  onClose: () => void
}

export default function FairnessModal({ commitment, clientSeed, serverSeed, rolls, onClose }: Props) {
  const { t } = useT()
  const [vServer, setVServer] = useState(serverSeed ?? '')
  const [vClient, setVClient] = useState(clientSeed)
  const [vNonce, setVNonce] = useState(0)
  const [result, setResult] = useState<{ dice: number[]; match: boolean } | null>(null)

  function doVerify() {
    const dice = verifyRoll(vServer.trim(), vClient.trim(), vNonce)
    const match = sha256Hex(vServer.trim()) === commitment
    setResult({ dice, match })
  }

  return (
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card fair-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
        <h2>🎲 {t('fair.title')}</h2>
        <p className="register-sub">{t('fair.intro')}</p>

        <div className="fair-field">
          <label>{t('fair.commitment')}</label>
          <code className="fair-code">{commitment}</code>
        </div>
        <div className="fair-field">
          <label>{t('fair.clientSeed')}</label>
          <code className="fair-code">{clientSeed}</code>
        </div>
        <div className="fair-field">
          <label>{t('fair.serverSeed')}</label>
          {serverSeed ? (
            <code className="fair-code">{serverSeed}</code>
          ) : (
            <span className="fair-hidden">{t('fair.hidden')}</span>
          )}
        </div>
        <div className="fair-rolls">{t('fair.rolls', { n: rolls })}</div>

        <div className="fair-verify">
          <h3>{t('fair.verifyTitle')}</h3>
          <label>
            serverSeed
            <input value={vServer} onChange={(e) => setVServer(e.target.value)} placeholder="…" />
          </label>
          <label>
            clientSeed
            <input value={vClient} onChange={(e) => setVClient(e.target.value)} />
          </label>
          <label>
            nonce (0…{Math.max(0, rolls - 1)})
            <input
              type="number"
              min={0}
              value={vNonce}
              onChange={(e) => setVNonce(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <button className="menu-btn" onClick={doVerify}>
            {t('fair.verifyBtn')}
          </button>

          {result && (
            <div className="fair-result">
              <div>
                {t('fair.dice')}: <b>{result.dice.slice(0, 2).join(' - ')}</b>
                {result.dice.length === 4 && ' (çift)'}
              </div>
              <div className={result.match ? 'fair-ok' : 'fair-bad'}>
                {result.match ? `✓ ${t('fair.hashOk')}` : `✕ ${t('fair.hashBad')}`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
