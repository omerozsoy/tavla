import { useCallback, useEffect, useState } from 'react'
import { useEscape } from './useEscape'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n'
import {
  organizerTournaments,
  organizerTournament,
  organizerAddParticipant,
  organizerRemoveParticipant,
  organizerEnterResult,
  type OrganizerTournament,
  type OrganizerDetail,
} from '../api'

interface Props {
  onClose: () => void
  titleOverride?: string
}

// ORGANİZATÖR PANELİ: admin'in atadığı yetkili kullanıcı SADECE kendi (Dışarda/salon) turnuvalarına
// katılımcı ekler + maç sonuçlarını girer. Admin paneline erişmez; veri /organizer/* ile sunucuda korunur.
export default function OrganizerPanel({ onClose, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const title = titleOverride || t('menu.organizerPanel')

  const [list, setList] = useState<OrganizerTournament[] | null>(null)
  const [sel, setSel] = useState<OrganizerDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    organizerTournaments().then(setList).catch(() => setList([]))
  }, [])

  const openTournament = useCallback(async (id: number) => {
    setErr('')
    setSel(null)
    try {
      setSel(await organizerTournament(id))
    } catch {
      setErr(t('org.loadErr'))
    }
  }, [t])

  const reload = useCallback(async () => {
    if (sel) setSel(await organizerTournament(sel.id).catch(() => sel))
  }, [sel])

  async function addP(e: React.FormEvent) {
    e.preventDefault()
    if (!sel || busy || !name.trim()) return
    setBusy(true)
    setErr('')
    try {
      await organizerAddParticipant(sel.id, name.trim())
      setName('')
      await reload()
    } catch {
      setErr(t('org.addErr'))
    } finally {
      setBusy(false)
    }
  }

  async function removeP(playerId: number) {
    if (!sel || busy) return
    setBusy(true)
    try {
      await organizerRemoveParticipant(sel.id, playerId)
      await reload()
    } catch {
      setErr(t('org.removeErr'))
    } finally {
      setBusy(false)
    }
  }

  async function result(match: string, winner: number) {
    if (!sel || busy) return
    setBusy(true)
    setErr('')
    try {
      await organizerEnterResult(sel.id, match, winner)
      await reload()
    } catch {
      setErr(t('org.resultErr'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card info-card org-card">
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2 className="org-title"><Icon name="settings" size={20} /> {title}</h2>

        {!sel ? (
          // --- Turnuva listesi ---
          list === null ? (
            <div className="org-empty">{t('common.loading')}</div>
          ) : list.length === 0 ? (
            <div className="org-empty">{t('org.none')}</div>
          ) : (
            <ul className="org-list">
              {list.map((tr) => (
                <li key={tr.id}>
                  <button type="button" className="org-row" onClick={() => openTournament(tr.id)}>
                    <span className="org-row-name">{tr.name}</span>
                    <span className={`org-badge org-st-${tr.status}`}>{t(`tourn.status.${tr.status}`)}</span>
                    <span className="org-row-count">
                      <Icon name="users" size={14} /> {tr.count}{tr.size > 0 ? `/${tr.size}` : ''}
                    </span>
                    <Icon name="arrow-right" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          // --- Turnuva detayı: katılımcı ekle + sonuç gir ---
          <div className="org-detail">
            <button type="button" className="org-back" onClick={() => setSel(null)}>
              <Icon name="caret-left" size={16} /> {t('org.back')}
            </button>
            <h3 className="org-detail-name">
              {sel.name} <span className={`org-badge org-st-${sel.status}`}>{t(`tourn.status.${sel.status}`)}</span>
            </h3>

            {/* Katılımcılar (yalnız kayıt açıkken ekle/çıkar) */}
            <section className="org-sec">
              <h4 className="org-sec-h"><Icon name="users" size={16} /> {t('org.participants')} ({sel.players.length})</h4>
              {sel.status === 'open' ? (
                <form className="org-add" onSubmit={addP}>
                  <input
                    className="org-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('org.namePh')}
                    maxLength={60}
                  />
                  <Button type="submit" variant="default" disabled={busy || !name.trim()}>{t('org.add')}</Button>
                </form>
              ) : (
                <p className="org-note">{t('org.startedNote')}</p>
              )}
              <ul className="org-players">
                {sel.players.map((p) => (
                  <li key={p.id} className="org-player">
                    <span>{p.name}</span>
                    {sel.status === 'open' && (
                      <button type="button" className="org-del" onClick={() => removeP(p.id)} disabled={busy} aria-label={t('org.remove')}>
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </li>
                ))}
                {sel.players.length === 0 && <li className="org-note">{t('org.noPlayers')}</li>}
              </ul>
            </section>

            {/* Bekleyen maçlar -> sonuç gir (kazananı seç / çift mağlubiyet) */}
            {sel.status === 'running' && (
              <section className="org-sec">
                <h4 className="org-sec-h"><Icon name="swords" size={16} /> {t('org.pending')} ({sel.pending.length})</h4>
                {sel.pending.length === 0 ? (
                  <p className="org-note">{t('org.noPending')}</p>
                ) : (
                  <ul className="org-matches">
                    {sel.pending.map((m) => (
                      <li key={m.key} className="org-match">
                        {m.round != null && <span className="org-round">{t('org.round', { n: m.round })}</span>}
                        <div className="org-match-btns">
                          <Button variant="default" disabled={busy} onClick={() => result(m.key, m.p1.id)}>{m.p1.name}</Button>
                          <span className="org-vs">{t('org.vs')}</span>
                          <Button variant="default" disabled={busy} onClick={() => result(m.key, m.p2.id)}>{m.p2.name}</Button>
                          <Button variant="ghost" disabled={busy} onClick={() => result(m.key, 0)} title={t('org.doubleLoss')}>{t('org.doubleLossShort')}</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="org-note">{t('org.drawNote')}</p>
              </section>
            )}

            {err && <p className="org-err">{err}</p>}
          </div>
        )}
        {!sel && err && <p className="org-err">{err}</p>}
      </div>
    </div>
  )
}
