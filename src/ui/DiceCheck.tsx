import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { sha256Hex, verifyServerRolls, type ServerDiceEntry } from '../engine/fairDice'
import { showRoom } from '../api'

// Zar Kontrol: online puanlı/paralı/bot maçlarının SUNUCU zarını (commit-reveal) doğrular.
// Maç sırasında yalnız `commit` (mühür) gösterilir + kopyalanır; maç bitince backend
// serverSeed + clientSeed + rolls (dice_rolls) açar -> burada TÜM zarlar tohumdan yeniden
// üretilip birebir karşılaştırılır. Üretim App\Services\FairDiceService ile BYTE-AYNI
// (src/engine/fairDice serverRoll/serverSingle, PHP vektörleriyle test edildi).
interface Props {
  commit: string | null
  serverSeed?: string | null // REVEAL: yalnız maç bitince
  clientSeed?: string | null
  rolls?: ServerDiceEntry[] | null // REVEAL: dice_rolls
  code?: string // oda kodu: reveal props'ta yoksa maç-sonu burada taze çekilir (bkz aşağıdaki effect)
  onClose: () => void
  embed?: boolean
}

function dieIcon(v: number): IconName {
  const n = Math.min(6, Math.max(1, Math.round(v)))
  return ('die-' + n) as IconName
}

export default function DiceCheck({ commit, serverSeed, clientSeed, rolls, code, onClose, embed }: Props) {
  const { t } = useT()
  useEscape(embed ? () => {} : onClose)
  const [fetched, setFetched] = useState<{ seed: string; client: string; rolls: ServerDiceEntry[] } | null>(null)
  const revealed = !!serverSeed || !!fetched
  const [vServer, setVServer] = useState(serverSeed ?? '')
  const [vClient, setVClient] = useState(clientSeed ?? '')
  const [copied, setCopied] = useState(false)
  const [checked, setChecked] = useState(!!serverSeed) // REVEAL varsa açılışta oto-doğrula

  // REVEAL poll maç bittikten BİRKAÇ SANİYE sonra gelebilir; modal açıkken tohum dolunca
  // alanları doldur + otomatik doğrula (kullanıcı tekrar açmak zorunda kalmasın).
  useEffect(() => {
    if (serverSeed) {
      setVServer(serverSeed)
      if (clientSeed != null) setVClient(clientSeed)
      setChecked(true)
    }
  }, [serverSeed, clientSeed])

  // REVEAL'İ KENDİN ÇEK (maç-sonu Zar Kontrol boş kalıyordu): reveal (dice_seed/client_seed/rolls)
  // yalnız toClient'te gelir; maç bitince server_version artmaz -> poll 204 döner ve KAZANAN bitişi
  // kendi hamle-yanıtından öğrenince (reveal YOK) room.dice_seed HİÇ dolmaz -> props boş. Props'ta
  // reveal yoksa ama oda kodu + commit varsa since'siz showRoom ile taze çek (maç bittiyse reveal
  // döner; bitmediyse dice_seed null -> gizli kalır, güvenli).
  useEffect(() => {
    if (serverSeed || !code || !commit || embed) return
    let alive = true
    showRoom(code)
      .then((rv) => {
        if (!alive || !rv?.dice_seed) return
        setFetched({
          seed: rv.dice_seed,
          client: (rv.dice_client_seed ?? '') as string,
          rolls: (rv.dice_rolls ?? []) as ServerDiceEntry[],
        })
        setVServer(rv.dice_seed)
        setVClient((rv.dice_client_seed ?? '') as string)
        setChecked(true)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [code, commit, serverSeed, embed])

  const entries = (fetched?.rolls ?? rolls ?? []) as ServerDiceEntry[]

  const result = useMemo(() => {
    if (!checked || !vServer.trim()) return null
    const seed = vServer.trim()
    const cs = vClient.trim()
    const commitOk = commit ? sha256Hex(seed) === commit : null
    const verified = verifyServerRolls(seed, cs, entries)
    return { commitOk, verified, bad: verified.filter((r) => !r.ok).length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, vServer, vClient, commit, rolls, fetched])

  function copyCommit() {
    if (!commit) return
    try {
      navigator.clipboard?.writeText(commit)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* pano yoksa sessiz geç */
    }
  }

  const body = (
    <>
      <p className="dc-intro">{t('dc.intro')}</p>

      {!commit && <div className="dc-note dc-warn">{t('dc.noData')}</div>}

      {commit && (
        <>
          {/* Mühür (commit) — maç sırasında da görünür + kopyalanır */}
          <div className="dc-commit">
            <div className="dc-commit-label">{t('dc.commit')}</div>
            <div className="dc-commit-row">
              <code>{commit}</code>
              <button type="button" className="fair-copy" onClick={copyCommit} aria-label={t('dc.copy')} title={t('dc.copy')}>
                <Icon name={copied ? 'check' : 'copy'} size={14} />
              </button>
            </div>
            {copied && <div className="fair-copied-note">{t('dc.copied')}</div>}
          </div>

          {!revealed && <div className="dc-note">{t('dc.sealedNote')}</div>}

          {/* Doğrulama: maç bitince serverSeed dolu gelir; elle de yapıştırılabilir */}
          <div className="dc-verify">
            <label className="fair-vlabel">
              <span className="fair-vlabel-head">
                <span className="fair-vlabel-main">{t('dc.serverSeed')}</span>
              </span>
              <input
                value={vServer}
                onChange={(e) => {
                  setVServer(e.target.value)
                  setChecked(false)
                }}
                placeholder={revealed ? '' : '…'}
              />
            </label>
            <label className="fair-vlabel">
              <span className="fair-vlabel-head">
                <span className="fair-vlabel-main">{t('dc.clientSeed')}</span>
              </span>
              <input
                value={vClient}
                onChange={(e) => {
                  setVClient(e.target.value)
                  setChecked(false)
                }}
              />
            </label>
            <Button
              variant="default"
              className="fair-verify-cta"
              disabled={!vServer.trim()}
              onClick={() => setChecked(true)}
            >
              <Icon name="search" size={16} /> {t('dc.verify')}
            </Button>
            {!vServer.trim() && <div className="dc-note dc-muted">{t('dc.needSeed')}</div>}

            {result && (
              <div className="dc-result">
                {result.commitOk != null && (
                  <div className={`dc-vbanner ${result.commitOk ? 'ok' : 'bad'}`}>
                    <Icon name={result.commitOk ? 'shield-check' : 'warning-circle'} size={18} />
                    {result.commitOk ? t('dc.commitOk') : t('dc.commitBad')}
                  </div>
                )}
                {entries.length > 0 && (
                  <div className={`dc-vbanner ${result.bad === 0 ? 'ok' : 'bad'}`}>
                    <Icon name={result.bad === 0 ? 'check' : 'warning-circle'} size={18} />
                    {result.bad === 0
                      ? t('dc.allOk', { n: entries.length })
                      : t('dc.someBad', { bad: result.bad, n: entries.length })}
                  </div>
                )}
                <ol className="dc-list">
                  {result.verified.map((r, i) => (
                    <li key={i} className={`dc-row ${r.ok ? 'ok' : 'bad'}`}>
                      <span className="dc-row-label">
                        {r.kind === 'opening'
                          ? t('dc.opening', { g: r.gameNo ?? 0 })
                          : t('dc.roll', { i: r.index ?? 0 })}
                      </span>
                      <span className="dc-row-dice" aria-hidden="true">
                        {r.recorded.map((d, j) => (
                          <Icon key={j} name={dieIcon(d)} size={20} />
                        ))}
                      </span>
                      <Icon name={r.ok ? 'check' : 'x'} size={15} className="dc-row-mark" />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )

  if (embed) return <div className="fair-embed">{body}</div>

  // body'ye PORTAL: oyun görünümü (.app.game-view) + .register-overlay.modal (backdrop-filter)
  // stacking context kuruyor -> içeride render edilen modal, z-index 5400 olsa bile oyun
  // ekranının ARKASINDA/bozuk kalıyordu ("açılıyor ama arkada"). Portal ile en tepe (body)
  // bağlamına taşınır -> z-index gerçekten topmost olur (chat görsel önizleme ile aynı çözüm).
  return createPortal(
    // ORTALI MODAL (page DEĞİL): body'ye portal edildiği için `.register-overlay.page`'in
    // `left:254px` + sol-hizası `.game-view .page{left:0}` düzeltmesini ALMIYORDU -> solda koyu
    // şerit + sayfa gibi sol-hizalı açılıyordu. `modal` (+:not(.page)) -> flex-center scrim.
    <div className="register-overlay modal dicecheck-overlay" role="dialog" aria-modal="true">
      <div className="register-card fair-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="dice" size={20} /> {t('dc.title')}
        </h2>
        {body}
      </div>
    </div>,
    document.body,
  )
}
