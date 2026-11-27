import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import {
  uploadPhotoAnalysis,
  getPhotoAnalysis,
  setPhotoAnalysisSettings,
  type PhotoAnalysisResult,
} from '../api'
import PhotoCamera from './PhotoCamera'
import './PhotoAnalysis.css'

// Taninan konumu (points[24], fotografi ceken +, rakip -) hafif SVG tahtaya cizer — kullanici tanimanin
// dogrulugunu GORSEL dogrulasin (oyunun Board bileseni oyun-durumuna bagli; burada gerekmez).
// Standart numaralama: ust 13-18|19-24 (sol->sag), alt 12-7|6-1 (sol->sag), orta bar.
// mineDark: fotografi ceken KOYU taslarla oynuyor -> pozitifler koyu cizilir (fotodaki gercek renk).
// dice + diceRight: okunan zarlar fotodaki TARAFINDA cizilir (sag = fotografi ceken atti, sol = rakip).
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}
export function PositionBoard({
  points,
  mineDark,
  dice,
  diceRight,
  homeLeft = false,
  cube,
}: {
  points: number[]
  mineDark: boolean
  dice: number[]
  diceRight: boolean
  /** kup: bar uzerinde, sahibinin tarafinda (rakip ust / ceken alt / orta); orta kup 64 gosterir */
  cube?: { value: number; owner: string | null } | null
  /** evler solda: numaralama aynali -> cizim fotodaki gibi gorunsun diye kolonlar aynalanir */
  homeLeft?: boolean
}) {
  const W = 360, H = 240, m = 6, barW = 20
  const fieldW = (W - 2 * m - barW) / 2
  const pw = fieldW / 6
  const r = Math.min(pw / 2 - 1.5, 12)
  const colX = (c: number) => (c < 6 ? m + (c + 0.5) * pw : m + fieldW + barW + (c - 6 + 0.5) * pw)
  // c = fotodaki kolon (soldan saga 0..11). Evler sagda: ust 13..24, alt 12..1; solda: ayna.
  const topPoint = (c: number) => (homeLeft ? 24 - c : 13 + c)
  const botPoint = (c: number) => (homeLeft ? 1 + c : 12 - c)

  const tri = (c: number, top: boolean, dark: boolean) => {
    const x = colX(c), hw = pw / 2 - 1
    const baseY = top ? m : H - m
    const apexY = top ? H / 2 - 14 : H / 2 + 14
    return <polygon key={`t${top ? 'T' : 'B'}${c}`} points={`${x - hw},${baseY} ${x + hw},${baseY} ${x},${apexY}`} fill={dark ? '#2f4150' : '#d8cfc0'} opacity={0.55} />
  }
  const stack = (c: number, top: boolean, n: number) => {
    if (!n) return null
    const x = colX(c), count = Math.abs(n), white = n > 0 !== mineDark, vis = Math.min(count, 5)
    const dy = 2 * r - 2
    const cy = (i: number) => (top ? m + r + i * dy : H - m - r - i * dy)
    return (
      <g key={`s${top ? 'T' : 'B'}${c}`}>
        {Array.from({ length: vis }, (_, i) => (
          <circle key={i} cx={x} cy={cy(i)} r={r} fill={white ? '#f3eee1' : '#b5423a'} stroke="rgba(0,0,0,.35)" strokeWidth={1} />
        ))}
        {count > 5 && (
          <text x={x} y={cy(4) + 3.5} fontSize={10} textAnchor="middle" fontWeight="700" fill={white ? '#333' : '#fff'}>{count}</text>
        )}
      </g>
    )
  }

  // Zarlar: ilgili yarinin ortasinda yan yana (en fazla 2 cizilir; cift zar bile 2 zar olarak atilir)
  const ds = 24
  const shown = dice.filter((d) => d >= 1 && d <= 6).slice(0, 2)
  const halfCx = diceRight ? m + fieldW + barW + fieldW / 2 : m + fieldW / 2
  const die = (v: number, i: number) => {
    const cx = halfCx + (i - (shown.length - 1) / 2) * (ds + 8)
    const cy = H / 2
    return (
      <g key={`d${i}`}>
        <rect x={cx - ds / 2} y={cy - ds / 2} width={ds} height={ds} rx={5} fill="#fbf8f1" stroke="rgba(0,0,0,.45)" strokeWidth={1} />
        {PIPS[v].map(([px, py], k) => (
          <circle key={k} cx={cx + px * ds * 0.27} cy={cy + py * ds * 0.27} r={2.4} fill="#1b2730" />
        ))}
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="photo-board" role="img" aria-label="board">
      <rect x={0} y={0} width={W} height={H} rx={8} fill="#1b2730" />
      <rect x={W / 2 - barW / 2} y={0} width={barW} height={H} fill="#0f1720" />
      {Array.from({ length: 12 }, (_, c) => tri(c, true, c % 2 === 0))}
      {Array.from({ length: 12 }, (_, c) => tri(c, false, c % 2 === 1))}
      {Array.from({ length: 12 }, (_, c) => stack(c, true, points[topPoint(c) - 1] || 0))}
      {Array.from({ length: 12 }, (_, c) => stack(c, false, points[botPoint(c) - 1] || 0))}
      {shown.map(die)}
      {cube && (
        <g>
          {(() => {
            const cs = 22
            const cy = cube.owner === 'black' ? m + cs / 2 + 2 : cube.owner === 'white' ? H - m - cs / 2 - 2 : H / 2
            return (
              <>
                <rect x={W / 2 - cs / 2} y={cy - cs / 2} width={cs} height={cs} rx={3} fill="#fbf8f1" stroke="#c9a227" strokeWidth={1.5} />
                <text x={W / 2} y={cy + 4} fontSize={cube.value >= 10 || !cube.owner ? 10 : 12} fontWeight="800" textAnchor="middle" fill="#1b2730">
                  {cube.owner ? cube.value : 64}
                </text>
              </>
            )
          })()}
        </g>
      )}
    </svg>
  )
}

/**
 * Fotograftan Pozisyon Analizi: kullanici tahta fotografi ceker/secer -> sunucu tanima (foto->
 * yapisal konum) + gnubg -> en iyi hamle. Tanima tahtayi OTOMATIK bulup duzeltir (manuel kose YOK).
 * Cekim: KILAVUZ CERCEVELI uygulama-ici kamera (PhotoCamera; tahta yatay + kenarda bosluk + bar orta
 * cizgide). getUserMedia yok/izin reddi -> eski yol: <input capture="environment"> (telefonun kamerasi).
 * Galeriden secim ayrica (capture'siz input).
 */
const HOME_KEY = 'photoHomeSide'
const MATCH_KEY = 'photoMatch'
const MATCH_LENGTHS = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 25]
interface MatchSet {
  ml: number // 0 = para oyunu
  me: number
  opp: number
  crawford: boolean
}
// Mac skoru tahtadan OKUNAMIYOR (skor karti modeli yok) -> kullanici secer; ayni macta sonraki
// fotolarda da gecerli olsun diye hatirlanir.
function loadMatch(): MatchSet {
  try {
    const m = JSON.parse(localStorage.getItem(MATCH_KEY) || 'null') as MatchSet | null
    if (m && MATCH_LENGTHS.includes(m.ml)) return { ml: m.ml, me: m.me || 0, opp: m.opp || 0, crawford: !!m.crawford }
  } catch {
    /* bozuk kayit */
  }
  return { ml: 0, me: 0, opp: 0, crawford: false }
}
// Mac kurallarina uydur: skor < uzunluk; crawford yalniz TAM BIR oyuncu maca 1 kalaysa.
function normMatch(m: MatchSet): MatchSet {
  if (!m.ml) return { ml: 0, me: 0, opp: 0, crawford: false }
  const me = Math.min(m.me, m.ml - 1)
  const opp = Math.min(m.opp, m.ml - 1)
  const oneAway = (me === m.ml - 1) !== (opp === m.ml - 1)
  return { ml: m.ml, me, opp, crawford: oneAway && m.crawford }
}
// Pip: fotografi ceken (+) 1 yonunde (hane n = n pip), rakip (-) 24 yonunde (hane n = 25-n pip); bar 25.
function pips(points: number[], bar?: { white: number; black: number }): [number, number] {
  let me = (bar?.white || 0) * 25
  let opp = (bar?.black || 0) * 25
  points.forEach((v, i) => {
    if (v > 0) me += v * (i + 1)
    else if (v < 0) opp += -v * (24 - i)
  })
  return [me, opp]
}

// Kupun durumu cumlesi: once mevcut (kullanici duzeltmis olabilir) sahip/deger; tanimanin buldugu
// yer ayni sahipse "nerede bulundugu" da eklenir.
function cubeState(
  cube: { value: number; owner: string | null } | null,
  found: { zone: string; owner: string | null } | null,
  t: (k: string) => string,
): string {
  if (!cube || !cube.owner) return t('photo.cubeStateCenter')
  const base = `${t('photo.cube')} ${cube.value} · ${cube.owner === 'black' ? t('photo.cubeStateOpp') : t('photo.cubeStateMine')}`
  if (!found || found.owner !== cube.owner) return base
  const where: Record<string, string> = {
    right: t('photo.cubeWhereRight'),
    left: t('photo.cubeWhereLeft'),
    front_opp: t('photo.cubeWhereFrontOpp'),
    front_me: t('photo.cubeWhereFrontMe'),
  }
  return where[found.zone] ? `${base} (${where[found.zone]})` : base
}

// gnubg kup karari metni (or. "Double, pass", "No redouble, take", "Too good to double, pass") -> Turkce
function cubeAction(proper: string, t: (k: string) => string): string {
  const p = proper.toLowerCase()
  if (p.startsWith('too good')) return t('photo.cubeTooGood')
  if (p.startsWith('no double') || p.startsWith('no redouble')) return t('photo.cubeNoDouble')
  if (p.includes('pass')) return t('photo.cubeDoublePass')
  if (p.includes('take') || p.includes('beaver')) return t('photo.cubeDoubleTake')
  return proper
}

export default function PhotoAnalysis({ onClose, titleOverride }: { onClose: () => void; titleOverride?: string }) {
  const { t } = useT()
  const notify = useToast()
  const fileRef = useRef<HTMLInputElement>(null) // galeri (capture yok)
  const captureRef = useRef<HTMLInputElement>(null) // kamera fallback (uygulama-ici kamera acilamazsa)
  const [camOpen, setCamOpen] = useState(false)
  const [camFailed, setCamFailed] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PhotoAnalysisResult | null>(null)
  const [cubeBusy, setCubeBusy] = useState(false)
  const [match, setMatch] = useState<MatchSet>(loadMatch)
  // Evler hangi tarafta (tek fotodan guvenilir cikarilamiyor: iki yorumun pip toplami ~esit).
  // Oyuncu genelde hep ayni duzende oynar -> secim hatirlanir. Sunucuya flip=1 olarak gider.
  const [homeLeft, setHomeLeft] = useState(() => {
    try {
      return localStorage.getItem(HOME_KEY) === 'left'
    } catch {
      return false
    }
  })

  function pick(f: File) {
    setFile(f)
    setResult(null)
    setPreview(URL.createObjectURL(f))
  }

  function openCamera() {
    if (camFailed) captureRef.current?.click()
    else setCamOpen(true)
  }

  // Telefon fotograflari buyuk (10MB+) + EXIF donuk olabilir -> upload once kucult + EXIF duzelt.
  async function downscale(f: File, max = 1600, quality = 0.85): Promise<Blob> {
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' })
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    return await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', quality),
    )
  }

  // Ayarlari (kup + mac) sunucuya gonder -> ayni konum yeniden analiz. Kup: deger 1 = ortada (sahipsiz);
  // >1 sahip ister (yoksa tespit edilen ya da ceken).
  function settingsFor(r: PhotoAnalysisResult, m: MatchSet, value?: number, owner?: 'white' | 'black' | null) {
    let v = value ?? r.position?.cube?.value ?? 1
    let o = owner !== undefined ? owner : ((r.position?.cube?.owner as 'white' | 'black' | null) ?? null)
    if (v === 1) o = null
    else if (!o) o = (r.debug?.cube?.owner as 'white' | 'black' | null) ?? 'white'
    if (!v) v = 1
    const n = normMatch(m)
    return { cube_value: v, cube_owner: o, match_length: n.ml, score_me: n.me, score_opp: n.opp, crawford: n.crawford }
  }

  async function applySettings(m: MatchSet, value?: number, owner?: 'white' | 'black' | null) {
    if (!result || cubeBusy) return
    const n = normMatch(m)
    setMatch(n)
    try {
      localStorage.setItem(MATCH_KEY, JSON.stringify(n))
    } catch {
      /* gizli mod */
    }
    setCubeBusy(true)
    try {
      setResult(await setPhotoAnalysisSettings(result.id, settingsFor(result, n, value, owner)))
    } catch (e) {
      notify.error((e as { message?: string })?.message || t('photo.failed'))
    } finally {
      setCubeBusy(false)
    }
  }

  function changeCube(value: number, owner: 'white' | 'black' | null) {
    void applySettings(match, value, owner)
  }

  function chooseHome(left: boolean) {
    if (left === homeLeft) return
    setHomeLeft(left)
    try {
      localStorage.setItem(HOME_KEY, left ? 'left' : 'right')
    } catch {
      /* gizli mod */
    }
    // ayni fotoyu yeni yorumla tekrar analiz et (yeniden cekmeye gerek yok)
    if (file && result) void analyze(file, left)
  }

  // f: kameradan yeni cekilen dosya (state henuz guncellenmemis olabilir) -> dogrudan analiz
  async function analyze(f: File | null = file, left: boolean = homeLeft) {
    if (!f || busy) return
    setBusy(true)
    setResult(null)
    try {
      const blob = await downscale(f)
      const { id } = await uploadPhotoAnalysis(blob, left)
      // poll: pending -> done/invalid/failed (~0.7sn aralik, <=60sn; tanima+gnubg tipik 1-2sn)
      for (let i = 0; i < 85; i++) {
        await new Promise((r) => setTimeout(r, 700))
        let r = await getPhotoAnalysis(id)
        if (r.status !== 'pending') {
          // hatirlanan mac skoru varsa (para oyunu degilse) ilk sonucu gostermeden ONA gore analiz et
          if (r.status === 'done' && r.valid && match.ml > 0) {
            try {
              r = await setPhotoAnalysisSettings(r.id, settingsFor(r, match))
            } catch {
              /* skorlu analiz olmazsa para oyunu sonucu gosterilir */
            }
          }
          setResult(r)
          break
        }
      }
    } catch (e) {
      notify.error((e as { message?: string })?.message || t('photo.err'))
    } finally {
      setBusy(false)
    }
  }

  const cands = result?.hint?.result?.hint?.slice(0, 3) ?? []
  // Zar YOK (zar atilmadan once) -> gnubg hamle degil KUP KARARI doner. Eskiden bu "basarisiz"
  // gorunuyordu (yalniz hamle listesi bekleniyordu).
  const cube = cands.length === 0 ? result?.hint?.cube : undefined
  const evalv = result?.hint?.evaluate
  // Kup RAKIPTEYKEN sira sende + zar yok -> katlayamazsin: gnubg karar vermez (proper null), yalniz
  // kazanma olasiliklari doner -> bu da gecerli sonuc.
  const cantDouble = !!cube && !cube.proper && !!evalv && evalv.length >= 5
  const done = result?.status === 'done' && result.valid && (cands.length > 0 || !!cube?.proper || cantDouble)

  return (
    <div className="photo-page">
      <button className="photo-x" onClick={onClose} type="button" aria-label={t('common.close')}>
        <Icon name="x" size={20} />
      </button>
      <div className="photo-head">
        <h1 className="photo-title">
          <Icon name="camera" size={22} /> {titleOverride || t('photo.title')}
        </h1>
        <p className="photo-sub">{t('photo.sub')}</p>
      </div>

      <div className="photo-capture">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
            e.target.value = ''
          }}
        />
        <input
          ref={captureRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
            e.target.value = ''
          }}
        />
        {preview ? (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <img src={preview} className="photo-preview" alt="" onClick={openCamera} />
        ) : (
          <button className="photo-drop" onClick={openCamera} type="button">
            <Icon name="camera" size={40} />
            <div className="photo-drop-title">{t('photo.pick')}</div>
            <div className="photo-drop-hint">{t('photo.pickHint')}</div>
          </button>
        )}

        <div className="photo-pick-row">
          <Button variant="outline" onClick={openCamera} type="button">
            <Icon name="camera" size={16} /> {preview ? t('photo.retake') : t('photo.camOpen')}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} type="button">
            {t('photo.gallery')}
          </Button>
        </div>

        <div className="photo-home" role="group" aria-label={t('photo.home')}>
          {/* Kullanici istegi: u-turn-left 90 derece SOLA = saga toplaniyor (varsayilan);
              u-turn-right 90 derece SAGA = sola toplaniyor */}
          <button type="button" className={!homeLeft ? 'on' : ''} aria-pressed={!homeLeft} onClick={() => chooseHome(false)} disabled={busy}>
            <Icon name="u-turn-left" size={18} className="photo-home-ico rot-l" /> {t('photo.homeRight')}
          </button>
          <button type="button" className={homeLeft ? 'on' : ''} aria-pressed={homeLeft} onClick={() => chooseHome(true)} disabled={busy}>
            <Icon name="u-turn-right" size={18} className="photo-home-ico rot-r" /> {t('photo.homeLeft')}
          </button>
        </div>

        <Button className="photo-analyze-btn" onClick={() => analyze()} disabled={busy || !file}>
          {busy ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="search" size={16} />}
          {busy ? t('photo.analyzing') : t('photo.analyze')}
        </Button>
      </div>

      {camOpen && (
        <PhotoCamera
          onClose={() => setCamOpen(false)}
          onCapture={(f) => {
            setCamOpen(false)
            pick(f)
            void analyze(f) // kamerayla cekildi -> beklemeden analiz (galeri secimi elle "Analiz Et")
          }}
          onError={(reason) => {
            setCamOpen(false)
            setCamFailed(true)
            // Hata adi (NotAllowedError / NotReadableError ...) teshis icin mesajda gorunsun (APK'da
            // kilavuzlu kamera acilmiyordu; nedeni uzaktan gorulemiyor).
            notify.error(t('photo.camErr') + (reason ? ` (${reason})` : ''))
          }}
        />
      )}

      {result && (
        <div className="photo-result">
          {done ? (
            <>
              {result!.position?.points &&
                (() => {
                  // Pip'ler tahtanin KENDI taraflarinda: rakip ustte, fotografi ceken altta (+ tas rengi)
                  const [pm, po] = pips(result!.position!.points, result!.position!.bar)
                  const d = pm - po
                  const mineDark = result!.debug?.photographer === 'dark'
                  const tag = (who: string, n: number, dark: boolean) => (
                    <div className="photo-pip-tag">
                      <span className={`photo-pip-dot${dark ? ' dark' : ''}`} />
                      {who}: <b>{n}</b> {t('photo.pipUnit')}
                    </div>
                  )
                  return (
                    <>
                      {tag(t('photo.opp'), po, !mineDark)}
                      <PositionBoard
                        points={result!.position!.points}
                        mineDark={mineDark}
                        dice={result!.position!.dice ?? []}
                        diceRight={result!.debug?.dice_side !== 'left'}
                        homeLeft={homeLeft}
                        cube={result!.position!.cube}
                      />
                      {tag(t('photo.you'), pm, mineDark)}
                      <div className="photo-pips">
                        {d === 0 ? (
                          <b>{t('photo.pipEven')}</b>
                        ) : (
                          <>
                            {t('photo.pipDiff')}: <b>{Math.abs(d)}</b> ({d < 0 ? t('photo.pipAhead') : t('photo.pipBehind')})
                          </>
                        )}
                      </div>
                    </>
                  )
                })()}
              <div className={`photo-matchctl${cubeBusy ? ' busy' : ''}`}>
                <label>
                  {t('photo.match')}{' '}
                  <select
                    value={match.ml}
                    disabled={cubeBusy}
                    onChange={(e) => applySettings({ ...match, ml: Number(e.target.value) })}
                  >
                    {MATCH_LENGTHS.map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? t('photo.money') : `${n} ${t('photo.points')}`}
                      </option>
                    ))}
                  </select>
                </label>
                {match.ml > 0 && (
                  <>
                    <label>
                      {t('photo.you')}{' '}
                      <select value={match.me} disabled={cubeBusy} onChange={(e) => applySettings({ ...match, me: Number(e.target.value) })}>
                        {Array.from({ length: match.ml }, (_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t('photo.opp')}{' '}
                      <select value={match.opp} disabled={cubeBusy} onChange={(e) => applySettings({ ...match, opp: Number(e.target.value) })}>
                        {Array.from({ length: match.ml }, (_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(match.me === match.ml - 1) !== (match.opp === match.ml - 1) && (
                      <label className="photo-crawford">
                        <input
                          type="checkbox"
                          checked={match.crawford}
                          disabled={cubeBusy}
                          onChange={(e) => applySettings({ ...match, crawford: e.target.checked })}
                        />{' '}
                        Crawford
                      </label>
                    )}
                  </>
                )}
              </div>
              <div className={`photo-cubectl${cubeBusy ? ' busy' : ''}`}>
                {/* kupun durumu (kullanici kurallari): sag = sen cektin -> rakip aldi; sol = sana cekildi ->
                    sen aldin; tahta disinda birinin ONUNDE = o kabul etti; bar = ortada */}
                <div className="photo-cubectl-state">
                  {cubeState(result!.position?.cube ?? null, result!.debug?.cube ?? null, t)}
                </div>
                <div className="photo-cubectl-row">
                  <span className="photo-cubectl-label">{t('photo.cube')}</span>
                  {[1, 2, 4, 8, 16, 32, 64].map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={cubeBusy}
                      className={(result!.position?.cube?.value ?? 1) === v ? 'on' : ''}
                      onClick={() => changeCube(v, (result!.position?.cube?.owner as 'white' | 'black' | null) ?? null)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="photo-cubectl-row">
                  {(
                    [
                      [null, t('photo.cubeCenter')],
                      ['white', t('photo.cubeMine')],
                      ['black', t('photo.cubeOpp')],
                    ] as const
                  ).map(([o, label]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={cubeBusy}
                      className={(result!.position?.cube?.owner ?? null) === o ? 'on' : ''}
                      onClick={() =>
                        o === null
                          ? changeCube(1, null)
                          : changeCube(Math.max(2, result!.position?.cube?.value ?? 2), o)
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="photo-dice">
                {t('photo.dice')}: <b>{result!.position?.dice?.join('-') || '—'}</b>
                {' · '}
                {/* tanima kurali: zar bar'in saginda -> fotografi ceken, solunda -> rakip */}
                <b>{result!.position?.turn === 'black' ? t('photo.turnOpp') : t('photo.turnMe')}</b>
              </div>
              {cube ? (
                <div className="photo-cube">
                  <div className="photo-best">
                    {cube.proper ? (
                      <>
                        {t('photo.cubeTitle')}: <b>{cubeAction(cube.proper, t)}</b>
                      </>
                    ) : (
                      // gnubg karar vermedi: kup rakipte / Crawford oyunu / macta katlamak anlamsiz
                      <b>
                        {result!.position?.cube?.owner === 'black'
                          ? t('photo.cubeCantDouble')
                          : result!.position?.crawford
                            ? t('photo.cubeCrawford')
                            : t('photo.cubeNoPoint')}
                      </b>
                    )}
                  </div>
                  {evalv && evalv.length >= 5 && (
                    <div className="photo-cube-probs">
                      {t('photo.winPct')}: <b>{(evalv[0] * 100).toFixed(1)}%</b>
                      {' · '}
                      {t('photo.gammonPct')}: <b>{(evalv[1] * 100).toFixed(1)}%</b>
                    </div>
                  )}
                  {cube.equities && !Array.isArray(cube.equities) && (
                    <ul className="photo-cands">
                      {(
                        [
                          ['noDouble', t('photo.cubeNoDouble')],
                          ['doubleTake', t('photo.cubeDoubleTake')],
                          ['doublePass', t('photo.cubeDoublePass')],
                        ] as const
                      ).map(([k, label]) =>
                        typeof cube.equities?.[k] === 'number' ? (
                          <li key={k}>
                            <span className="photo-cand-move">{label}</span>
                            <span className="photo-cand-eq">{cube.equities[k]!.toFixed(3)}</span>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  )}
                  <div className="photo-cube-hint">{t('photo.cubeHint')}</div>
                </div>
              ) : (
                <div className="photo-best">
                  {t('photo.best')}: <b>{cands[0].move}</b>
                </div>
              )}
              {cands.length > 1 && (
                <ul className="photo-cands">
                  {cands.map((c, i) => (
                    <li key={i}>
                      <span className="photo-cand-move">{c.move}</span>
                      {typeof c.equity === 'number' && (
                        <span className="photo-cand-eq">{c.equity.toFixed(3)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="photo-invalid">{t(result!.status === 'invalid' ? 'photo.invalid' : 'photo.failed')}</div>
          )}
        </div>
      )}
    </div>
  )
}
