import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import {
  adminListContents,
  createContent,
  updateContent,
  deleteContent,
  type Content,
  type ContentType,
} from '../api'

const TYPES: { id: ContentType; key: string }[] = [
  { id: 'service', key: 'menu.services' },
  { id: 'event', key: 'menu.calendar' },
  { id: 'club', key: 'menu.clubs' },
  { id: 'blog', key: 'menu.blog' },
  { id: 'news', key: 'menu.news' },
]

const emptyForm = (type: ContentType): Partial<Content> => ({
  type,
  title: '',
  body: '',
  published: true,
  sort: 0,
})

const dtVal = (s?: string | null) => {
  if (!s) return ''
  const d = new Date(s)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export default function AdminContent({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [type, setType] = useState<ContentType>('service')
  const [items, setItems] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Partial<Content> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    adminListContents(type)
      .then((r) => !cancel && setItems(r))
      .catch(() => {})
      .finally(() => !cancel && setLoading(false))
    return () => {
      cancel = true
    }
  }, [type])

  const refresh = () => {
    setLoading(true)
    adminListContents(type)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  async function save() {
    if (!form?.title?.trim() || busy) return
    setBusy(true)
    try {
      if (form.id) await updateContent(form.id, form)
      else await createContent({ ...form, type })
      setForm(null)
      refresh()
    } catch {
      /* yoksay */
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: number) {
    if (busy || !confirm(t('content.confirmDel'))) return
    setBusy(true)
    try {
      await deleteContent(id)
      refresh()
    } catch {
      /* yoksay */
    } finally {
      setBusy(false)
    }
  }

  const field = (k: keyof Content, val: string | number | boolean) =>
    setForm((f) => ({ ...(f as Partial<Content>), [k]: val }))

  const isEvent = type === 'event'
  const isClub = type === 'club'
  const isPost = type === 'blog' || type === 'news'

  return (
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card admin-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="pencil" size={20} /> {t('content.manage')}
        </h2>

        <div className="content-type-tabs">
          {TYPES.map((ty) => (
            <button
              key={ty.id}
              className={`setup-tile ${type === ty.id ? 'active' : ''}`}
              onClick={() => {
                setType(ty.id)
                setForm(null)
              }}
            >
              {t(ty.key)}
            </button>
          ))}
        </div>

        {form ? (
          <div className="content-form">
            <label className="cf-row">
              <span>{t('content.f.title')}</span>
              <input value={form.title ?? ''} onChange={(e) => field('title', e.target.value)} />
            </label>

            {isEvent && (
              <>
                <label className="cf-row">
                  <span>{t('content.f.organizer')}</span>
                  <input
                    value={form.organizer ?? ''}
                    onChange={(e) => field('organizer', e.target.value)}
                  />
                </label>
                <label className="cf-row">
                  <span>{t('content.f.place')}</span>
                  <input value={form.place ?? ''} onChange={(e) => field('place', e.target.value)} />
                </label>
                <label className="cf-row">
                  <span>{t('content.f.datetime')}</span>
                  <input
                    type="datetime-local"
                    value={dtVal(form.event_at)}
                    onChange={(e) => field('event_at', e.target.value)}
                  />
                </label>
              </>
            )}

            {isClub && (
              <>
                <label className="cf-row">
                  <span>{t('content.f.province')}</span>
                  <input
                    value={form.province ?? ''}
                    onChange={(e) => field('province', e.target.value)}
                  />
                </label>
                <label className="cf-row">
                  <span>{t('content.f.address')}</span>
                  <input value={form.place ?? ''} onChange={(e) => field('place', e.target.value)} />
                </label>
              </>
            )}

            {isPost && (
              <label className="cf-row">
                <span>{t('content.f.date')}</span>
                <input
                  type="date"
                  value={form.event_at ? dtVal(form.event_at).slice(0, 10) : ''}
                  onChange={(e) => field('event_at', e.target.value)}
                />
              </label>
            )}

            {(isEvent || isClub) && (
              <label className="cf-row">
                <span>{t('content.f.contact')}</span>
                <input
                  value={form.contact ?? ''}
                  onChange={(e) => field('contact', e.target.value)}
                />
              </label>
            )}

            <label className="cf-row">
              <span>{t('content.f.body')}</span>
              <textarea
                rows={isPost || type === 'service' ? 8 : 3}
                value={form.body ?? ''}
                onChange={(e) => field('body', e.target.value)}
              />
            </label>

            <label className="cf-check">
              <input
                type="checkbox"
                checked={form.published ?? true}
                onChange={(e) => field('published', e.target.checked)}
              />
              <span>{t('content.f.published')}</span>
            </label>

            <div className="admin-edit-actions">
              <button className="menu-btn" disabled={busy} onClick={save}>
                {t('admin.save')}
              </button>
              <button className="menu-btn" onClick={() => setForm(null)}>
                {t('reg.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button className="menu-btn admin-new-tourn" onClick={() => setForm(emptyForm(type))}>
              <Icon name="play" size={14} /> {t('content.add')}
            </button>
            {loading ? (
              <div className="admin-empty">{t('admin.loading')}</div>
            ) : items.length === 0 ? (
              <div className="admin-empty">{t('content.empty')}</div>
            ) : (
              <div className="admin-list">
                {items.map((c) => (
                  <div key={c.id} className="admin-row">
                    <div className="admin-row-top">
                      <div className="admin-row-main">
                        <span className="admin-name">
                          {c.title}
                          {!c.published && <span className="admin-badge ban">gizli</span>}
                        </span>
                        <span className="admin-email">
                          {c.province ? c.province + ' · ' : ''}
                          {c.event_at ? new Date(c.event_at).toLocaleString('tr-TR') : ''}
                        </span>
                      </div>
                      <div className="admin-row-stats">
                        <button
                          className="admin-edit-btn"
                          onClick={() => setForm({ ...c })}
                          aria-label={t('admin.edit')}
                        >
                          <Icon name="pencil" size={15} />
                        </button>
                        <button
                          className="admin-edit-btn"
                          onClick={() => remove(c.id)}
                          aria-label={t('admin.delTournament')}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
