import { useEffect, useState } from 'react'
import Board from './Board'
import { pipCount } from '../engine/evaluate'
import type { GameState, Player } from '../engine/types'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import { adminGetPhotoAnalysis, adminLabelPhotoAnalysis, type AdminPhotoAnalysis } from '../api'
import './FotoDuzelt.css'

// Admin foto düzeltme sayfası (/foto-duzelt/<id>): SOLDA foto, SAĞDA GERÇEK temalı Board (standart Board
// bileşeni). Fırça (Sen/Rakip/Sil) + board'daki noktaya tıkla -> taş ekle/çıkar (paint modeli). Bar/Sıra/
// Zar/Küp kontrolleri. Tanımanın okuduğu zar/küp referans gösterilir. Kaydet -> ground_truth (eğitim etiketi).
const EMPTY_FROMS = new Set<number | 'bar'>()
const EMPTY_TARGETS = new Set<number | 'off'>()
const ALL_CLICKABLE: Set<number | 'bar'> = new Set<number | 'bar'>([...Array(24).keys(), 'bar'])
const noop = () => {}
const DICE = [0, 1, 2, 3, 4, 5, 6]
const CUBES = [1, 2, 4, 8, 16, 32, 64]
type Brush = 'me' | 'opp' | 'erase'

export default function FotoDuzelt({ id, onClose }: { id: number; onClose: () => void }) {
  const notify = useToast()
  const [rec, setRec] = useState<AdminPhotoAnalysis | null>(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [brush, setBrush] = useState<Brush>('me')
  const [pts, setPts] = useState<number[]>(() => Array(24).fill(0))
  const [bar, setBar] = useState<{ white: number; black: number }>({ white: 0, black: 0 })
  const [turn, setTurn] = useState<Player>('white')
  const [dice, setDice] = useState<number[]>([])
  const [cube, setCube] = useState<{ value: number; owner: Player | null }>({ value: 1, owner: null })

  useEffect(() => {
    let alive = true
    adminGetPhotoAnalysis(id)
      .then((r) => {
        if (!alive) return
        setRec(r)
        // Düzenleme ground_truth yoksa tanınan konumdan başlar (position); admin yanlışları düzeltir.
        const p = r.position
        if (p) {
          setPts(Array.from({ length: 24 }, (_, i) => p.points?.[i] ?? 0))
          setBar({ white: p.bar?.white ?? 0, black: p.bar?.black ?? 0 })
          setTurn(p.turn === 'black' ? 'black' : 'white')
          setDice((p.dice ?? []).filter((x) => x >= 1 && x <= 6))
          const owner = p.cube?.owner
          setCube({ value: p.cube?.value ?? 1, owner: owner === 'white' || owner === 'black' ? owner : null })
        }
      })
      .catch((e) => alive && setErr((e as { message?: string })?.message || 'Yüklenemedi'))
    return () => {
      alive = false
    }
  }, [id])

  // Noktaya/bara tıkla -> aktif fırçayı uygula. Aynı renk +1 (max 15); zıt renk varsa yeni renge 1; Sil -1.
  function paintPoint(i: number) {
    setPts((prev) => {
      const n = prev.slice()
      const cur = n[i] || 0
      if (brush === 'erase') n[i] = cur > 0 ? cur - 1 : cur < 0 ? cur + 1 : 0
      else {
        const sign = brush === 'me' ? 1 : -1
        n[i] = cur === 0 || Math.sign(cur) === sign ? Math.min(15, Math.abs(cur) + 1) * sign : sign
      }
      return n
    })
  }
  function onSelectFrom(from: number | 'bar') {
    if (from === 'bar') {
      const k = brush === 'opp' ? 'black' : 'white'
      setBar((b) => ({ ...b, [k]: brush === 'erase' ? Math.max(0, b[k] - 1) : Math.min(15, b[k] + 1) }))
    } else paintPoint(from)
  }
  function bumpBar(k: 'white' | 'black', d: number) {
    setBar((b) => ({ ...b, [k]: Math.max(0, Math.min(15, b[k] + d)) }))
  }
  function setDie(idx: number, v: number) {
    const a = [dice[0] || 0, dice[1] || 0]
    a[idx] = v
    setDice(a.filter((x) => x >= 1 && x <= 6))
  }

  const state: GameState = { points: pts, bar, off: { white: 0, black: 0 }, turn, dice, diceUsed: [] }
  const readDice = rec?.recognized?.dice ?? []
  const readCube = rec?.recognized?.cube

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      await adminLabelPhotoAnalysis(id, { points: pts, bar, turn, dice, cube })
      notify.success('Kaydedildi — eğitime hazır')
      onClose()
    } catch (e) {
      notify.error((e as { message?: string })?.message || 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fd-page">
      <button className="fd-x" onClick={onClose} type="button" aria-label="Kapat">
        <Icon name="x" size={20} />
      </button>
      <h1 className="fd-title">
        <Icon name="pencil" size={22} /> Foto Düzelt <span className="fd-id">#{id}</span>
      </h1>

      {err ? (
        <div className="fd-err">{err}</div>
      ) : !rec ? (
        <div className="fd-loading">
          <span className="btn-spinner" aria-hidden="true" /> Yükleniyor…
        </div>
      ) : (
        <>
          <div className="fd-brush">
            <b>Renk:</b>
            <button type="button" className={brush === 'me' ? 'on me' : ''} onClick={() => setBrush('me')}>● Sen</button>
            <button type="button" className={brush === 'opp' ? 'on opp' : ''} onClick={() => setBrush('opp')}>● Rakip</button>
            <button type="button" className={brush === 'erase' ? 'on erase' : ''} onClick={() => setBrush('erase')}>✕ Sil</button>
            <button type="button" className="fd-clear" onClick={() => { setPts(Array(24).fill(0)); setBar({ white: 0, black: 0 }) }}>🗑 Temizle</button>
            <span className="fd-hint">Noktaya tıkla → taş ekle/çıkar</span>
          </div>

          <div className="fd-main">
            <img className="fd-photo" src={rec.image_url} alt="" />
            <div className="fd-board">
              <Board
                state={state}
                selectableFroms={EMPTY_FROMS}
                clickableFroms={ALL_CLICKABLE}
                targets={EMPTY_TARGETS}
                selectedFrom={null}
                onSelectFrom={onSelectFrom}
                selectOnPointerDown
                onSelectTarget={noop}
                onDragFrom={noop}
                pipTop={pipCount(state, 'black')}
                pipBottom={pipCount(state, 'white')}
                cube={cube}
                mirror={rec.flip}
                swapStones={rec.photographer === 'dark'}
                numberFrom="white"
                showPip
              />
            </div>
          </div>

          <div className="fd-ctl">
            <div className="fd-row">
              <b>Bar</b>
              <span>Sen</span>
              <button type="button" onClick={() => bumpBar('white', -1)}>−</button>
              <span className="fd-num">{bar.white}</span>
              <button type="button" onClick={() => bumpBar('white', 1)}>+</button>
              <span>Rakip</span>
              <button type="button" onClick={() => bumpBar('black', -1)}>−</button>
              <span className="fd-num">{bar.black}</span>
              <button type="button" onClick={() => bumpBar('black', 1)}>+</button>
            </div>
            <div className="fd-row">
              <b>Sıra</b>
              <button type="button" className={turn === 'white' ? 'on' : ''} onClick={() => setTurn('white')}>Sen</button>
              <button type="button" className={turn === 'black' ? 'on' : ''} onClick={() => setTurn('black')}>Rakip</button>
              <b>Zar</b>
              <select value={dice[0] || 0} onChange={(e) => setDie(0, Number(e.target.value))}>
                {DICE.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
              </select>
              <select value={dice[1] || 0} onChange={(e) => setDie(1, Number(e.target.value))}>
                {DICE.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
              </select>
              {readDice.length > 0 && <span className="fd-read">okudu: {readDice.join('-')}</span>}
            </div>
            <div className="fd-row">
              <b>Küp</b>
              <select value={cube.value} onChange={(e) => setCube((c) => ({ ...c, value: Number(e.target.value), owner: Number(e.target.value) === 1 ? null : c.owner }))}>
                {CUBES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={cube.owner ?? ''} onChange={(e) => setCube((c) => ({ value: e.target.value ? c.value : 1, owner: (e.target.value || null) as Player | null }))}>
                <option value="">orta</option>
                <option value="white">sen</option>
                <option value="black">rakip</option>
              </select>
              {readCube && <span className="fd-read">okudu: {readCube.value}{readCube.owner ? ` (${readCube.owner === 'white' ? 'sen' : 'rakip'})` : ' (orta)'}</span>}
            </div>
          </div>

          <Button className="fd-save" onClick={save} disabled={saving}>
            {saving ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="check" size={16} />}
            Kaydet → Eğitime hazır
          </Button>
        </>
      )}
    </div>
  )
}
