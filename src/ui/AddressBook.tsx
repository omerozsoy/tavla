import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import { getAddresses, createAddress, updateAddress, deleteAddress, type Address, type AddressInput } from '../api'
import './AddressBook.css'

type Editing = { mode: 'new'; type: 'shipping' | 'billing' } | { mode: 'edit'; addr: Address } | null

const EMPTY: AddressInput = {
  type: 'shipping', title: '', name: '', phone: '', address: '', city: '', district: '',
  postal: '', company: '', tax_office: '', tax_number: '', is_default: false,
}

// Adres defteri (Adreslerim): teslimat + fatura adresleri; ekle/düzenle/sil, varsayılan.
export default function AddressBook() {
  const notify = useToast()
  const [list, setList] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Editing>(null)

  const load = () => {
    setLoading(true)
    getAddresses()
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const shipping = list.filter((a) => a.type === 'shipping')
  const billing = list.filter((a) => a.type === 'billing')

  async function remove(a: Address) {
    if (!window.confirm(`"${a.title || a.name}" adresini sil?`)) return
    try {
      await deleteAddress(a.id)
      notify.success('Adres silindi.')
      load()
    } catch {
      notify.error('Adres silinemedi.')
    }
  }

  if (editing) {
    return (
      <AddressForm
        initial={editing.mode === 'edit' ? editing.addr : { ...EMPTY, type: editing.type }}
        editId={editing.mode === 'edit' ? editing.addr.id : null}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    )
  }

  const group = (title: string, type: 'shipping' | 'billing', items: Address[]) => (
    <section className="ab-group">
      <div className="ab-group-head">
        <h3>{title}</h3>
        <Button variant="outline" size="default" onClick={() => setEditing({ mode: 'new', type })}>
          <Icon name="user-plus" size={15} /> Yeni Adres
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="ab-empty">Kayıtlı {type === 'shipping' ? 'teslimat' : 'fatura'} adresi yok.</p>
      ) : (
        <div className="ab-list">
          {items.map((a) => (
            <div className="ab-card" key={a.id}>
              <div className="ab-card-main">
                <div className="ab-card-title">
                  {a.title || a.name}
                  {a.is_default && <span className="ab-default">Varsayılan</span>}
                </div>
                <div className="ab-card-line">{a.name} · {a.phone}</div>
                <div className="ab-card-line">
                  {a.address}
                  {a.district ? ', ' + a.district : ''} — {a.city}
                  {a.postal ? ' ' + a.postal : ''}
                </div>
                {a.type === 'billing' && (a.company || a.tax_number) && (
                  <div className="ab-card-line ab-card-tax">
                    {a.company ? a.company + ' · ' : ''}
                    {a.tax_office ? 'VD: ' + a.tax_office + ' · ' : ''}
                    {a.tax_number ? 'VNo: ' + a.tax_number : ''}
                  </div>
                )}
              </div>
              <div className="ab-card-actions">
                <button type="button" onClick={() => setEditing({ mode: 'edit', addr: a })} title="Düzenle">
                  <Icon name="pencil" size={15} />
                </button>
                <button type="button" onClick={() => remove(a)} title="Sil">
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <section className="prof-ov-col ab-wrap">
      {loading ? (
        <p className="prof-ov-empty">Yükleniyor…</p>
      ) : (
        <>
          {group('Teslimat Adresleri', 'shipping', shipping)}
          {group('Fatura Adresleri', 'billing', billing)}
        </>
      )}
    </section>
  )
}

function AddressForm({
  initial,
  editId,
  onCancel,
  onSaved,
}: {
  initial: AddressInput
  editId: number | null
  onCancel: () => void
  onSaved: () => void
}) {
  const notify = useToast()
  const [f, setF] = useState<AddressInput>(initial)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof AddressInput, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))
  const isBilling = f.type === 'billing'
  const valid = f.name.trim() && f.phone.trim() && f.address.trim() && f.city.trim()

  async function save() {
    if (!valid || busy) return
    setBusy(true)
    try {
      const payload: AddressInput = {
        ...f,
        title: f.title?.trim() || undefined,
        district: f.district?.trim() || undefined,
        postal: f.postal?.trim() || undefined,
        company: isBilling ? f.company?.trim() || undefined : undefined,
        tax_office: isBilling ? f.tax_office?.trim() || undefined : undefined,
        tax_number: isBilling ? f.tax_number?.trim() || undefined : undefined,
      }
      if (editId) await updateAddress(editId, payload)
      else await createAddress(payload)
      notify.success('Adres kaydedildi.')
      onSaved()
    } catch (e) {
      notify.error((e as { message?: string })?.message || 'Adres kaydedilemedi.')
      setBusy(false)
    }
  }

  return (
    <section className="prof-ov-col ab-form">
      <button type="button" className="checkout-back" onClick={onCancel}>
        <Icon name="arrow-right" size={16} /> Geri
      </button>
      <h3>{editId ? 'Adresi Düzenle' : 'Yeni Adres'}</h3>

      <div className="ab-form-grid">
        <label className="ab-row">
          <span>Adres tipi</span>
          <select value={f.type} onChange={(e) => set('type', e.target.value as 'shipping' | 'billing')} disabled={!!editId}>
            <option value="shipping">Teslimat</option>
            <option value="billing">Fatura</option>
          </select>
        </label>
        <label className="ab-row">
          <span>Başlık (Ev, İş…)</span>
          <input value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} maxLength={60} />
        </label>
        <label className="ab-row">
          <span>Ad Soyad {isBilling ? '/ Ünvan' : ''}</span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120} />
        </label>
        <label className="ab-row">
          <span>Telefon</span>
          <input value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} inputMode="tel" />
        </label>
        <label className="ab-row ab-wide">
          <span>Adres</span>
          <textarea value={f.address} onChange={(e) => set('address', e.target.value)} rows={2} maxLength={1000} />
        </label>
        <label className="ab-row">
          <span>İlçe</span>
          <input value={f.district ?? ''} onChange={(e) => set('district', e.target.value)} maxLength={80} />
        </label>
        <label className="ab-row">
          <span>İl</span>
          <input value={f.city} onChange={(e) => set('city', e.target.value)} maxLength={80} />
        </label>
        <label className="ab-row">
          <span>Posta kodu</span>
          <input value={f.postal ?? ''} onChange={(e) => set('postal', e.target.value)} maxLength={20} inputMode="numeric" />
        </label>

        {isBilling && (
          <>
            <label className="ab-row">
              <span>Firma (kurumsal)</span>
              <input value={f.company ?? ''} onChange={(e) => set('company', e.target.value)} maxLength={160} />
            </label>
            <label className="ab-row">
              <span>Vergi dairesi</span>
              <input value={f.tax_office ?? ''} onChange={(e) => set('tax_office', e.target.value)} maxLength={120} />
            </label>
            <label className="ab-row">
              <span>Vergi no / TCKN</span>
              <input value={f.tax_number ?? ''} onChange={(e) => set('tax_number', e.target.value)} maxLength={40} />
            </label>
          </>
        )}

        <label className="ab-row ab-check">
          <input type="checkbox" checked={!!f.is_default} onChange={(e) => set('is_default', e.target.checked)} />
          <span>Bu tip için varsayılan adres</span>
        </label>
      </div>

      <div className="ab-form-actions">
        <Button variant="outline" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button onClick={save} disabled={!valid || busy}>
          <Icon name="check" size={16} /> Kaydet
        </Button>
      </div>
    </section>
  )
}
