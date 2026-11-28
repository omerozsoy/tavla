import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import {
  uploadPhotoAnalysis,
  getPhotoAnalysis,
  setPhotoAnalysisSettings,
  reportPhotoAnalysis,
  type PhotoAnalysisResult,
} from '../api'
import Board from './Board'
import { MoveArrows } from './MatReview'
import { Die } from './Dice'
import { PinchZoom } from './PinchZoom'
import { pipCount } from '../engine/evaluate'
import type { GameState, Player } from '../engine/types'
import { moveToSteps } from './photoMoveSteps'
import { IS_NATIVE_APP } from '../appEnv'
import PhotoCamera from './PhotoCamera'
import './PhotoAnalysis.css'

// Temalı Board'u salt-görsel çizmek için (ArticleBoard ile aynı desen): etkileşim yok.
const EMPTY_FROMS: Set<number | 'bar'> = new Set()
const EMPTY_TARGETS: Set<number | 'off'> = new Set()
const noop = () => {}

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

// KUP MODU (kullanici kurali): bir oyuncunun TARAFINDAKI kup onundur; tahtanin ORTASINDAKI kup kimsenin
// degildir = CEKILMIS kup (sag yari: sen cektin, sol yari: sana cekildi); bar/yok = ortada (deger 1).
type CubeMode = 'center' | 'mine' | 'opp' | 'offer_me' | 'offer_opp'
type PosCube = {
  cube?: { value: number; owner: string | null }
  cube_offer?: { by: 'white' | 'black'; value: number } | null
} | null | undefined
function cubeModeOf(p: PosCube): { mode: CubeMode; value: number } {
  if (p?.cube_offer) return { mode: p.cube_offer.by === 'white' ? 'offer_me' : 'offer_opp', value: p.cube_offer.value }
  const c = p?.cube
  if (!c || !c.owner) return { mode: 'center', value: 1 }
  return { mode: c.owner === 'white' ? 'mine' : 'opp', value: c.value }
}

// Kupun durumu cumlesi (mevcut — kullanici duzeltmis olabilir) + tanimanin buldugu yer.
function cubeState(p: PosCube, found: { zone: string } | null, t: (k: string) => string): string {
  const { mode, value } = cubeModeOf(p)
  if (mode === 'center') return t('photo.cubeStateCenter')
  const txt: Record<CubeMode, string> = {
    center: '',
    mine: t('photo.cubeStateMine'),
    opp: t('photo.cubeStateOpp'),
    offer_me: t('photo.cubeStateOfferMe'),
    offer_opp: t('photo.cubeStateOfferOpp'),
  }
  const base = `${t('photo.cube')} ${value} · ${txt[mode]}`
  const where: Record<string, string> = {
    front_opp: t('photo.cubeWhereFrontOpp'),
    front_me: t('photo.cubeWhereFrontMe'),
    opp_side: t('photo.cubeWhereOppSide'),
    my_side: t('photo.cubeWhereMySide'),
    offer_taken: t('photo.cubeWhereTaken'),
  }
  return found && where[found.zone] ? `${base} (${where[found.zone]})` : base
}

// Cekilmis kupte gnubg karari "<ceken eylemi>, <alan eylemi>" (or. "Double, pass", "No double, take",
// "Too good to double, pass"). -> alan: al/pas; ceken: dogru/erken/fazla iyi.
function offerVerdict(proper: string): { take: boolean | null; dbl: 'ok' | 'early' | 'toogood' | null } {
  const p = proper.toLowerCase()
  const take = p.includes('pass') ? false : p.includes('take') || p.includes('beaver') ? true : null
  const dbl = p.startsWith('too good') ? 'toogood' : p.startsWith('no ') ? 'early' : p.includes('double') ? 'ok' : null
  return { take, dbl }
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
  const [reported, setReported] = useState(false) // bu sonuc icin "hatali tarama" bildirildi mi
  const [selectedCand, setSelectedCand] = useState(0) // tahtada oku gosterilen aday (0 = en iyi)
  const [cubeBusy, setCubeBusy] = useState(false)
  const [match, setMatch] = useState<MatchSet>(loadMatch)
  // Kup DEGERI ve SKOR tahtadan OKUNAMIYOR (model yok) -> analiz varsayimla yapilir. Kullanici bunlari
  // acikca secene kadar ekranda "okunamadi, kontrol et" uyarisi gosterilir (kararlari dogrudan etkiler).
  const [cubeChosen, setCubeChosen] = useState(false) // bu sonuc icin kup elle secildi mi
  const [matchChosen, setMatchChosen] = useState(() => {
    try {
      return localStorage.getItem(MATCH_KEY) !== null
    } catch {
      return false
    }
  })
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
  // Drop alani / onizleme tiklamasi: APP'te kamera acar, WEB'de dosya secici (kullanici direktifi:
  // web'de kamera yok). Galeri/dosya butonu her iki ortamda da ayrica durur.
  const pickArea = () => (IS_NATIVE_APP ? openCamera() : fileRef.current?.click())

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

  // Ayarlari (kup + mac) sunucuya gonder -> ayni konum yeniden analiz. Kup modu: ortada (deger 1) /
  // sende / rakipte (deger >= 2) / sen cektin / sana cekildi (teklif edilen deger >= 2).
  function settingsFor(r: PhotoAnalysisResult, m: MatchSet, cubeOver?: { mode?: CubeMode; value?: number }, diceOver?: number[]) {
    const cur = cubeModeOf(r.position)
    const mode = cubeOver?.mode ?? cur.mode
    let v = cubeOver?.value ?? cur.value
    if (mode === 'center') v = 1
    else if (v < 2) v = 2
    if (mode === 'center' && cubeOver?.value && cubeOver.value > 1) {
      // ortadaki kupe deger secildi -> sahibi tanimadan (yoksa cekene) gelsin
      return settingsFor(r, m, { mode: r.debug?.cube?.owner === 'black' ? 'opp' : 'mine', value: cubeOver.value })
    }
    const n = normMatch(m)
    return {
      cube_value: v,
      cube_owner: mode === 'mine' ? ('white' as const) : mode === 'opp' ? ('black' as const) : null,
      cube_offer: mode === 'offer_me' ? ('white' as const) : mode === 'offer_opp' ? ('black' as const) : null,
      match_length: n.ml,
      score_me: n.me,
      score_opp: n.opp,
      crawford: n.crawford,
      ...(diceOver ? { dice: diceOver } : {}),
    }
  }

  async function applySettings(m: MatchSet, cubeOver?: { mode?: CubeMode; value?: number }, diceOver?: number[]) {
    if (!result || cubeBusy) return
    const fromCube = cubeOver !== undefined
    const fromDice = diceOver !== undefined
    const n = normMatch(m)
    setMatch(n)
    if (!fromCube && !fromDice) {
      try {
        localStorage.setItem(MATCH_KEY, JSON.stringify(n))
      } catch {
        /* gizli mod */
      }
    }
    setCubeBusy(true)
    try {
      setResult(await setPhotoAnalysisSettings(result.id, settingsFor(result, n, cubeOver, diceOver)))
      if (fromCube) setCubeChosen(true)
      else if (!fromDice) setMatchChosen(true)
    } catch (e) {
      notify.error((e as { message?: string })?.message || t('photo.failed'))
    } finally {
      setCubeBusy(false)
    }
  }

  function changeCube(over: { mode?: CubeMode; value?: number }) {
    void applySettings(match, over)
  }

  // Kullanici okunan zari duzeltir: tek haneyi degistir -> yeni [d1,d2] ile yeniden analiz.
  function changeDie(idx: 0 | 1, val: number) {
    const cur = (result!.position?.dice ?? []).filter((d) => d >= 1 && d <= 6)
    const next = [cur[0] ?? val, cur[1] ?? val] as number[]
    next[idx] = val
    void applySettings(match, undefined, next.filter((d) => d >= 1 && d <= 6))
  }

  // "Hatali tarama bildir": kaydi admin incelemesine isaretler. Admin resme bakip dogru konumu elle
  // girer -> tanima modeli bu etiketli verilerle gelecekte yeniden egitilir (kendini gelistiren dongu).
  async function reportWrong() {
    if (!result || reported) return
    setReported(true) // iyimser: tesekkur metni hemen gorunsun
    try {
      await reportPhotoAnalysis(result.id)
    } catch {
      setReported(false)
      notify.error(t('photo.reportFail'))
    }
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
    setReported(false)
    setCubeChosen(false)
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
  // Yeni sonuç/yeniden-analiz -> seçili adayı en iyiye (0) sıfırla.
  useEffect(() => setSelectedCand(0), [result])
  const sel = Math.min(selectedCand, Math.max(0, cands.length - 1))
  // Zar YOK (zar atilmadan once) -> gnubg hamle degil KUP KARARI doner. Eskiden bu "basarisiz"
  // gorunuyordu (yalniz hamle listesi bekleniyordu).
  const cube = cands.length === 0 ? result?.hint?.cube : undefined
  const evalv = result?.hint?.evaluate
  // Kup RAKIPTEYKEN sira sende + zar yok -> katlayamazsin: gnubg karar vermez (proper null), yalniz
  // kazanma olasiliklari doner -> bu da gecerli sonuc.
  const cantDouble = !!cube && !cube.proper && !!evalv && evalv.length >= 5
  const offer = result?.position?.cube_offer ?? null
  // gnubg olasiliklari SIRASI GELENIN (cekilmis kupte cekenin) bakisindan -> fotografi cekene cevir
  const myView = result?.position?.turn === 'black' && evalv && evalv.length >= 5
  const myWin = evalv && evalv.length >= 5 ? (myView ? 1 - evalv[0] : evalv[0]) : null
  const myGammon = evalv && evalv.length >= 5 ? (myView ? evalv[3] : evalv[1]) : null
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
          <img src={preview} className="photo-preview" alt="" onClick={pickArea} />
        ) : (
          <button className="photo-drop" onClick={pickArea} type="button">
            <Icon name="camera" size={40} />
            <div className="photo-drop-title">{IS_NATIVE_APP ? t('photo.pick') : t('photo.gallery')}</div>
            <div className="photo-drop-hint">{t('photo.pickHint')}</div>
          </button>
        )}

        <div className="photo-pick-row">
          {/* Kamera YALNIZ kurulu app'te (kullanici direktifi): web'de "Kamera Aç" gizli, dosya seçici kalir. */}
          {IS_NATIVE_APP && (
            <Button variant="outline" onClick={openCamera} type="button">
              <Icon name="camera" size={16} /> {preview ? t('photo.retake') : t('photo.camOpen')}
            </Button>
          )}
          <Button variant="outline" onClick={() => fileRef.current?.click()} type="button">
            {preview && !IS_NATIVE_APP ? t('photo.retake') : t('photo.gallery')}
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
              <div className="photo-main">
                <div className="photo-main-board">
              {result!.position?.points &&
                (() => {
                  // Pip'ler tahtanin KENDI taraflarinda: rakip ustte, fotografi ceken altta (+ tas rengi)
                  const [pm, po] = pips(result!.position!.points, result!.position!.bar)
                  const d = pm - po
                  const hasMove = cands.length > 0
                  // Standart temalı tahta fotoğrafı çekeni HER ZAMAN beyaz (alt) çizer -> pip nokta
                  // renkleri de ona göre (sen=beyaz, rakip=koyu). Kup kararında da aynı tahta kullanılır.
                  const youDark = false
                  const tag = (who: string, n: number, dark: boolean) => (
                    <div className="photo-pip-tag">
                      <span className={`photo-pip-dot${dark ? ' dark' : ''}`} />
                      {who}: <b>{n}</b> {t('photo.pipUnit')}
                    </div>
                  )
                  const turn: Player = result!.position!.turn === 'black' ? 'black' : 'white'
                  const bstate: GameState = {
                    points: result!.position!.points,
                    bar: { white: result!.position!.bar?.white || 0, black: result!.position!.bar?.black || 0 },
                    off: { white: 0, black: 0 },
                    turn,
                    dice: (result!.position!.dice ?? []).filter((x) => x >= 1 && x <= 6),
                    diceUsed: [],
                  }
                  const steps = hasMove ? (cands[sel]?.steps ?? moveToSteps(turn, cands[sel]?.move)) : []
                  const rawOwner = result!.position!.cube?.owner
                  const bcube = {
                    value: result!.position!.cube?.value ?? 1,
                    owner: (rawOwner === 'white' || rawOwner === 'black' ? rawOwner : null) as Player | null,
                  }
                  // Okunan zarlari board ustunde goster (sira gelenin tarafinda; PositionAnalyzer deseni).
                  const boardDice =
                    bstate.dice.length >= 1 ? (
                      <div className="board-dice">
                        {bstate.dice.slice(0, 2).map((v, i) => (
                          <Die key={i} value={v} owner={turn} used={false} />
                        ))}
                      </div>
                    ) : null
                  const diceOnRight = turn === 'white'
                  return (
                    <>
                      {tag(t('photo.opp'), po, !youDark)}
                      <div className="photo-board-wrap">
                        <PinchZoom className="photo-board-stage">
                          <Board
                            state={bstate}
                            selectableFroms={EMPTY_FROMS}
                            targets={EMPTY_TARGETS}
                            selectedFrom={null}
                            onSelectFrom={noop}
                            onSelectTarget={noop}
                            onDragFrom={noop}
                            pipTop={pipCount(bstate, 'black')}
                            pipBottom={pipCount(bstate, 'white')}
                            cube={bcube}
                            mirror={homeLeft}
                            numberFrom="white"
                            centerLeft={diceOnRight ? undefined : boardDice}
                            centerRight={diceOnRight ? boardDice : undefined}
                            showPip={false}
                          />
                          {steps.length > 0 && (
                            <MoveArrows
                              steps={steps}
                              dep={`${sel}:${homeLeft ? 'L' : 'R'}:${steps.map((s) => `${s.from}>${s.to}`).join(',')}`}
                              mover={turn}
                            />
                          )}
                        </PinchZoom>
                      </div>
                      {tag(t('photo.you'), pm, youDark)}
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
                </div>
                <div className="photo-main-moves">
              {/* Sag panel (web'de board'un saginda): kup karari VEYA hamle analizi stili equity listesi. */}
              {cube ? (
                <div className="photo-cube">
                  <div className="photo-best">
                    {offer && cube.proper ? (
                      (() => {
                        const v = offerVerdict(cube.proper)
                        const head =
                          offer.by === 'white'
                            ? v.take === false
                              ? t('photo.offerOppPass')
                              : t('photo.offerOppTake')
                            : v.take === false
                              ? t('photo.offerMePass')
                              : t('photo.offerMeTake')
                        const sub =
                          v.dbl === 'ok'
                            ? t(offer.by === 'white' ? 'photo.dblMineOk' : 'photo.dblOppOk')
                            : v.dbl === 'early'
                              ? t(offer.by === 'white' ? 'photo.dblMineEarly' : 'photo.dblOppEarly')
                              : v.dbl === 'toogood'
                                ? t(offer.by === 'white' ? 'photo.dblMineTooGood' : 'photo.dblOppTooGood')
                                : ''
                        return (
                          <>
                            <b>{head}</b>
                            {sub && <div className="photo-offer-sub">{sub}</div>}
                          </>
                        )
                      })()
                    ) : cube.proper ? (
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
                      {t('photo.winPct')}: <b>{((myWin ?? 0) * 100).toFixed(1)}%</b>
                      {' · '}
                      {t('photo.gammonPct')}: <b>{((myGammon ?? 0) * 100).toFixed(1)}%</b>
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
                  {!offer && <div className="photo-cube-hint">{t('photo.cubeHint')}</div>}
                </div>
              ) : (
                <div className="photo-moves">
                  <div className="photo-moves-title">{t('photo.best')}</div>
                  <div className="photo-moves-head">
                    <span className="pm-no">#</span>
                    <span className="pm-move">{t('mrv.move')}</span>
                    <span className="pm-eq">{t('mrv.equity')}</span>
                    <span className="pm-loss">{t('mrv.loss')}</span>
                  </div>
                  {cands.map((c, i) => {
                    const eq = typeof c.equity === 'number' ? c.equity : null
                    const best = typeof cands[0]?.equity === 'number' ? (cands[0].equity as number) : null
                    const diff = eq !== null && best !== null ? eq - best : null
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`photo-move${i === sel ? ' sel' : ''}`}
                        onClick={() => setSelectedCand(i)}
                        aria-pressed={i === sel}
                      >
                        <span className="pm-no">{i + 1}</span>
                        <span className="pm-move">{c.move}</span>
                        <span className="pm-eq">{eq !== null ? `${eq >= 0 ? '+' : ''}${eq.toFixed(3)}` : '—'}</span>
                        <span className="pm-loss">{i === 0 ? '—' : diff !== null ? `−${(-diff).toFixed(3)}` : ''}</span>
                      </button>
                    )
                  })}
                </div>
              )}
                </div>
              </div>
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
                  {cubeState(result!.position, result!.debug?.cube ?? null, t)}
                </div>
                {/* Kullanici istegi: cok buton yerine DROPDOWN'lar — Kup [deger] [yer/durum]. */}
                <div className="photo-cubectl-row">
                  <span className="photo-cubectl-label">{t('photo.cube')}</span>
                  <select
                    disabled={cubeBusy}
                    value={cubeModeOf(result!.position).value}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      changeCube(v === 1 ? { mode: 'center' } : { value: v })
                    }}
                  >
                    {[1, 2, 4, 8, 16, 32, 64].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    disabled={cubeBusy}
                    value={cubeModeOf(result!.position).mode}
                    onChange={(e) => changeCube({ mode: e.target.value as CubeMode })}
                  >
                    {(
                      [
                        ['center', t('photo.cubeCenter')],
                        ['mine', t('photo.cubeMine')],
                        ['opp', t('photo.cubeOpp')],
                        ['offer_me', t('photo.cubeOfferMe')],
                        ['offer_opp', t('photo.cubeOfferOpp')],
                      ] as const
                    ).map(([mode, label]) => (
                      <option key={mode} value={mode}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={`photo-dice${cubeBusy ? ' busy' : ''}`}>
                {t('photo.dice')}:{' '}
                {offer ? (
                  // Cekilmis kup: zar yok (kup karari) -> okunan degeri degistirmek anlamsiz
                  <b>—</b>
                ) : (
                  (() => {
                    const cur = (result!.position?.dice ?? []).filter((d) => d >= 1 && d <= 6)
                    return ([0, 1] as const).map((idx) => (
                      <select
                        key={idx}
                        className="photo-dice-sel"
                        value={cur[idx] ?? 0}
                        disabled={cubeBusy}
                        onChange={(e) => changeDie(idx, Number(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5, 6].map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ))
                  })()
                )}
                {' · '}
                {/* tanima kurali: zar bar'in saginda -> fotografi ceken, solunda -> rakip */}
                <b>
                  {offer
                    ? offer.by === 'white'
                      ? t('photo.decideOpp')
                      : t('photo.decideMe')
                    : result!.position?.turn === 'black'
                      ? t('photo.turnOpp')
                      : t('photo.turnMe')}
                </b>
              </div>
              {/* ANALIZ NEYE GORE YAPILDI: kup degeri + skor okunamiyor -> varsayim acikca gosterilir */}
              {(() => {
                const ml = result!.position?.matchLength ?? 0
                const sc = result!.position?.score
                const cubeTxt = cubeState(result!.position, null, t)
                const matchTxt = !ml
                  ? t('photo.money')
                  : `${ml} ${t('photo.points')} · ${t('photo.you')} ${sc?.white ?? 0} – ${t('photo.opp')} ${sc?.black ?? 0}${result!.position?.crawford ? ' · Crawford' : ''}`
                const src = result!.debug?.cube?.value_src
                const cubeBadge = cubeChosen
                  ? ['ok', t('photo.asChosen')]
                  : src === 'model'
                    ? ['ok', t('photo.asCubeRead')]
                    : src === 'model_ge8'
                      ? ['warn', t('photo.asCubeGe8')]
                      : result!.debug?.cube
                        ? ['warn', t('photo.asCubeFoundNoValue')]
                        : ['warn', t('photo.asCubeNotFound')]
                const matchBadge = matchChosen ? ['ok', t('photo.asChosen')] : ['warn', t('photo.asMatchUnread')]
                return (
                  <div className="photo-assume">
                    <div className="photo-assume-title">{t('photo.asTitle')}</div>
                    <div className="photo-assume-row">
                      <span>
                        {t('photo.cube')}: <b>{cubeTxt}</b>
                      </span>
                      <span className={`photo-assume-badge ${cubeBadge[0]}`}>{cubeBadge[1]}</span>
                    </div>
                    <div className="photo-assume-row">
                      <span>
                        {t('photo.match')}: <b>{matchTxt}</b>
                      </span>
                      <span className={`photo-assume-badge ${matchBadge[0]}`}>{matchBadge[1]}</span>
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="photo-invalid">{t(result!.status === 'invalid' ? 'photo.invalid' : 'photo.failed')}</div>
          )}
          {/* Hatali tarama bildir: kullanici yardimiyla tanima zamanla gelisir (admin elle duzeltir). */}
          <div className="photo-report">
            {reported ? (
              <div className="photo-report-thanks">✓ {t('photo.reportThanks')}</div>
            ) : (
              <>
                <p className="photo-report-hint">{t('photo.reportHint')}</p>
                <Button variant="outline" onClick={reportWrong} type="button" className="photo-report-btn">
                  <Icon name="flag" size={15} /> {t('photo.reportBtn')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
