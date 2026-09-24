import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import Board from './Board'
import Sidebar from './Sidebar'
import ViewersBadge from './ViewersBadge'
import ClockStack from './ClockStack'
import DiceRow from './Dice'
import { showRoom, watchRoom, type RoomView, type ServerMatch, type RoomViewer } from '../api'
import { Sound, isMuted, setMuted, getVolume, setVolume } from '../sound'
import { pipCount } from '../engine/evaluate'
import { cloneState } from '../engine/board'
import { applyStep } from '../engine/moves'
import { liveMoveDelta } from '../online/liveMoves'
import { boardSig, validLivePrefix } from '../online/spectateAnim'
import { sourceRect, destEl, flyChecker, type MoveStyle } from './moveAnim'
import type { GameState, Player, Step } from '../engine/types'

// İzleyicinin taş/animasyon tercihi (oyuncununkiyle aynı localStorage anahtarları).
const specMoveStyle = (): MoveStyle => {
  try {
    const v = localStorage.getItem('tavla.move')
    return v === 'off' || v === 'slide' || v === 'arc' || v === 'lift' ? v : 'slide'
  } catch {
    return 'slide'
  }
}
const specAnimOn = (): boolean => {
  try {
    return localStorage.getItem('tavla.animoff') !== '1'
  } catch {
    return true
  }
}

// Legacy (istemci-state) oda snapshot'i: PUT edilen state nesnesi.
interface LegacySnap {
  turnStart?: GameState
  played?: Step[] // bu turda oynanan adımlar (turnStart'a uygulanır -> GÜNCEL tahta)
  match?: {
    target?: number
    score?: Record<Player, number>
    cube?: { value: number; owner: Player | null }
    isCrawford?: boolean
  }
}

// turnStart + oynanan adımlar -> GÜNCEL tahta (gerçek oyuncu ne görüyorsa o). App.applyPlayed ile aynı.
function applyPlayed(base: GameState, played: Step[]): GameState {
  const s = cloneState(base)
  for (const step of played) applyStep(s, step, base.turn)
  return s
}

// Canli mac izleme: oda durumunu periyodik yoklar, GERCEK OYUN TAHTASINI (tam boy, salt-okunur)
// oynuyormus gibi gosterir. Hem legacy (state.turnStart) hem otoriter (server_state) oda desteklenir.
export default function Spectate({
  code,
  viewerName,
  onClose,
}: {
  code: string
  p1?: string
  p2?: string
  viewerName?: string // izleyicinin adı (giriş yoksa misafir); presence heartbeat için
  onClose: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  const [rv, setRv] = useState<RoomView | null>(null)
  const [gone, setGone] = useState(false)
  const [viewers, setViewers] = useState<RoomViewer[]>([])
  const [viewerCount, setViewerCount] = useState(0)
  const verRef = useRef(-1)

  useEffect(() => {
    let alive = true
    let misses = 0
    const poll = async () => {
      try {
        const r = await showRoom(code, verRef.current >= 0 ? verRef.current : undefined)
        if (!alive) return
        if (r === null) return // degismedi
        verRef.current = r.version
        setRv(r)
        if (r.status === 'finished') {
          misses++
          if (misses > 2) setGone(true)
        } else {
          misses = 0
        }
      } catch {
        /* gecici ag hatasi -> sonraki poll dener */
      }
    }
    poll()
    // Oynarken gibi adım adım izleme için daha sık yokla (oyuncunun poll'üyle aynı tempo).
    const id = window.setInterval(poll, 1200)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [code])

  // İzleme presence heartbeat: ~5sn'de bir kendini izleyici olarak bildir + izleyen listesini al.
  useEffect(() => {
    let alive = true
    const beat = async () => {
      try {
        const r = await watchRoom(code, viewerName)
        if (!alive) return
        setViewers(r.viewers)
        setViewerCount(r.count)
      } catch {
        /* geçici */
      }
    }
    beat()
    const id = window.setInterval(beat, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
      watchRoom(code, viewerName, true).catch(() => {}) // ayrıl (best-effort)
    }
  }, [code, viewerName])

  // ---- Oda verisinden tahta + maç bilgisini çıkar (otoriter veya legacy) ----
  // DAYANIKLILIK: sunucu ara sıra state=null (geçici) döndürüyor -> ekranı KARARTMA. Son GEÇERLİ
  // oda anlık görüntüsünü koru (izleme donmasın/siyah ekran gelmesin). Yalnız ilk yüklemede boş.
  const rawAuthoritative = !!rv?.authoritative
  const rawLegacy = (rv?.state ?? null) as LegacySnap | null
  const rawBoard: GameState | null = rawAuthoritative
    ? (rv?.server_state ?? null)
    : rawLegacy?.turnStart
      ? applyPlayed(rawLegacy.turnStart, rawLegacy.played ?? [])
      : null
  const lastGoodRef = useRef<RoomView | null>(null)
  if (rawBoard && rv) lastGoodRef.current = rv
  const eff = rawBoard ? rv : lastGoodRef.current // etkin (son geçerli) oda görüntüsü

  const authoritative = !!eff?.authoritative
  const legacy = (eff?.state ?? null) as LegacySnap | null
  // GÜNCEL tahta = turnStart + bu turda oynanan adımlar (gerçek oyuncunun gördüğü).
  const legacyPlayed: Step[] = legacy?.played ?? []
  const board: GameState | null = authoritative
    ? (eff?.server_state ?? null)
    : legacy?.turnStart
      ? applyPlayed(legacy.turnStart, legacyPlayed)
      : null
  const sm: ServerMatch | null = authoritative ? (eff?.server_match ?? null) : null

  // ---- CANLI adım-adım izleme (oynarken gibi) ----
  // Otoriter tahta (board = server_state) TUR BAŞIdır; oynanan adımlar `rv.live`'da gelir
  // (version bump'sız; saat akarken poll döndürür). Adımları YASAL-önekle doğrulayıp adım adım
  // (flyChecker) oynatırız; tur bitince server_state zaten sonucu içerir -> pürüzsüz, ghost yok.
  const moveStyle = useRef(specMoveStyle()).current
  const canAnim = useRef(
    specAnimOn() && specMoveStyle() !== 'off' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current
  const [shown, setShown] = useState<Step[]>([])
  const shownRef = useRef<Step[]>([])
  const shownBaseRef = useRef('') // `shown` hangi baseKey'e ait (tur değişince stale'i atmak için)
  const flightRef = useRef<{ to: number | 'off'; srcRect: DOMRect } | null>(null)
  const timersRef = useRef<number[]>([])
  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }
  // Canlı adımlar: EN TAZE poll'den (rv.live — delta poll'de server_state null olsa da live dolu gelir),
  // renk sıradaki oyuncuyla eşleşmeli. GEÇERLİ önek: her adım o anki tahtada yasal (bayat live'ı ele).
  const liveRaw = (rv?.live ?? eff?.live) as { steps?: Step[]; turn?: Player | null } | null | undefined
  const liveSteps: Step[] =
    board && liveRaw && Array.isArray(liveRaw.steps) && (!liveRaw.turn || liveRaw.turn === board.turn)
      ? (liveRaw.steps as Step[])
      : []
  const baseKey = board ? boardSig(board) : ''
  const validLive = useMemo(
    () => (board ? validLivePrefix(board, liveSteps) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey, JSON.stringify(liveSteps)],
  )
  const liveKey = validLive.map((s) => `${s.from}>${s.to}`).join(',')

  // Yeni tur başı / zar (baseKey değişti) -> önizleme adımlarını RENDER SIRASINDA sıfırla.
  // NEDEN render'da (useEffect değil): useEffect boyamadan SONRA çalışır; o ana dek bir kare
  // için ESKİ turun adımları YENİ tahtaya uygulanıp (applyPlayed) yanlış taşları oynatır ->
  // hamle bitiminde "kırpışma". React'in "key değişince türetilmiş state'i sıfırla" kalıbı
  // ara kareyi boyamadan yeniden render eder (server_state zaten güncel pozisyonu içerir).
  if (shownBaseRef.current !== baseKey) {
    shownBaseRef.current = baseKey
    shownRef.current = []
    setShown([])
  }
  // Uçuştaki animasyon timer'larını tur değişince iptal et (state sıfırlama yukarıda render'da).
  useEffect(() => {
    clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey])

  // validLive büyüdükçe yeni adımları adım adım oynat (liveMoveDelta: geri-alma/farklı diziyi ele alır).
  useEffect(() => {
    if (!board) return
    const delta = liveMoveDelta(shownRef.current, validLive)
    if (delta.reset) {
      clearTimers()
      shownRef.current = validLive.slice()
      setShown(validLive.slice())
      return
    }
    if (delta.animate.length === 0) return
    if (!canAnim) {
      shownRef.current = validLive.slice()
      setShown(validLive.slice())
      return
    }
    const base = shownRef.current.slice()
    delta.animate.forEach((st, i) => {
      timersRef.current.push(
        window.setTimeout(() => {
          if (moveStyle !== 'off') {
            const r = sourceRect(st.from)
            if (r) flightRef.current = { to: st.to, srcRect: r }
          }
          // Ses: vuruş (rakip blot) mu normal hamle mi? (pre = bu adımdan önceki tahta)
          const pre = applyPlayed(board, base)
          const mySign = board.turn === 'white' ? 1 : -1
          const hit =
            typeof st.to === 'number' &&
            pre.points[st.to] !== 0 &&
            Math.sign(pre.points[st.to]) !== mySign &&
            Math.abs(pre.points[st.to]) === 1
          if (hit) Sound.hit()
          else Sound.move()
          base.push(st)
          shownRef.current = base.slice()
          setShown(base.slice())
        }, i * 500),
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey])

  // Adım eklendikten sonra hedef taşı kaynaktan uçur (oyuncu tarafındaki FLIP'in eşi).
  useLayoutEffect(() => {
    const f = flightRef.current
    if (!f || moveStyle === 'off') {
      flightRef.current = null
      return
    }
    flightRef.current = null
    const el = destEl(f.to)
    if (el) flyChecker(el, f.srcRect, moveStyle as Exclude<MoveStyle, 'off'>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimers(), [])

  // Ekranda gösterilen tahta = tur başı (board) + o ana dek oynatılan (shown) adımlar.
  const displayBoard: GameState | null = board ? applyPlayed(board, shown) : null
  // Zar grileşmesi için: otoriterde shown, legacy'de committed played.
  const usedSteps: Step[] = shown.length ? shown : legacyPlayed

  // Ses: yeni zar atışında dice sesi (baseKey değişince, board.dice yeni ve dolu ise).
  const prevDiceKeyRef = useRef('')
  const firstDiceRef = useRef(true)
  useEffect(() => {
    if (!board || !board.dice || board.dice.length === 0) {
      prevDiceKeyRef.current = ''
      return
    }
    const key = `${board.turn}|${board.dice.join(',')}`
    if (key !== prevDiceKeyRef.current) {
      prevDiceKeyRef.current = key
      if (firstDiceRef.current) firstDiceRef.current = false // izleme açılışında ilk zarı ÇALMA
      else Sound.dice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey])

  // İzleme ses kontrolü (hoparlör + kaydırıcı): oyuncununkiyle AYNI kalıcı ayar (sound.ts).
  // Varsayılan AÇIK; misafirler dahil herkes buradan kısıp kapatabilir.
  const [muted, setMutedUi] = useState(() => isMuted())
  const [vol, setVolUi] = useState(() => Math.round(getVolume() * 100))
  const toggleMute = () => {
    const m = !muted
    setMutedUi(m)
    setMuted(m)
    if (!m && vol === 0) {
      setVolume(0.7)
      setVolUi(70)
    }
  }
  const onVol = (v: number) => {
    const c = Math.min(100, Math.max(0, Math.round(v)))
    setVolUi(c)
    setVolume(c / 100)
    if (c > 0 && muted) {
      setMutedUi(false)
      setMuted(false)
    } else if (c === 0 && !muted) {
      setMutedUi(true)
      setMuted(true)
    }
  }

  const score: Record<Player, number> = sm?.score ??
    legacy?.match?.score ?? { white: 0, black: 0 }
  const target = eff?.target ?? sm?.target ?? legacy?.match?.target ?? 1
  const cubeVal = sm?.cube.value ?? legacy?.match?.cube?.value ?? 1
  const cubeOwner: Player | null = sm?.cube.owner ?? legacy?.match?.cube?.owner ?? null
  const crawford = sm?.crawford ?? legacy?.match?.isCrawford ?? false

  // Konvansiyon: p1 = beyaz (altta), p2 = siyah (üstte); izleyici beyaz bakışıyla oturur.
  const p1Name = eff?.p1_name || t('player.white')
  const p2Name = eff?.p2_name || t('player.black')

  // MAÇ BİTTİ mi? Oda 'finished' (kazananın client'ı final-push eder) VEYA >2 poll boyunca
  // finished (gone). Board frozen kalmasın; net sonuç göster. Kazanan: skor hedefe ulaşan;
  // skor belirsizse tahtayı bitiren (off===15). Böylece izleyici sonucu görür + kapatabilir.
  const matchDone = eff?.status === 'finished' || gone
  const winnerColor: Player | null = !matchDone
    ? null
    : score.white >= target
      ? 'white'
      : score.black >= target
        ? 'black'
        : board && board.off.white >= 15
          ? 'white'
          : board && board.off.black >= 15
            ? 'black'
            : null
  const winnerName = winnerColor === 'white' ? p1Name : winnerColor === 'black' ? p2Name : null

  // Maç bitince tek sefer kısa bitiş sesi (izleyici tarafsız).
  const endedRef = useRef(false)
  useEffect(() => {
    if (matchDone && !endedRef.current) {
      endedRef.current = true
      Sound.win()
    }
  }, [matchDone])

  const mkInfo = (color: Player): Parameters<typeof Sidebar>[0]['top'] => {
    const isP1 = color === 'white'
    const name = isP1 ? p1Name : p2Name
    return {
      name,
      avatar: (name || '?').slice(0, 1).toUpperCase(),
      sub: '',
      off: displayBoard?.off[color] ?? 0,
      active: displayBoard?.turn === color,
      color,
      score: score[color] ?? 0,
      target,
      rating: (isP1 ? eff?.p1_rating : eff?.p2_rating) ?? null,
      avatarUrl: (isP1 ? eff?.p1_avatar : eff?.p2_avatar) ?? null,
      frame: (isP1 ? eff?.p1_frame : eff?.p2_frame) ?? null,
      premium: (isP1 ? eff?.p1_premium : eff?.p2_premium) ?? false,
    }
  }

  const clock = eff?.clock
  // Zar yüzleri: GERÇEK oyunla AYNI mantık (çift zarda 2 göster; oynanan adımlara göre 'kullanıldı'
  // grileşir). Kaynak: turnStart.dice (=board.dice; applyStep dice'ı değiştirmez) + oynanan adımlar.
  const diceFaces: { value: number; used: boolean }[] = (() => {
    const d = displayBoard?.dice ?? []
    if (d.length === 0) return []
    if (d.length === 4) {
      const faded = Math.floor(usedSteps.length / 2) // çift: her zar 2 hamle
      return [{ value: d[0], used: faded >= 1 }, { value: d[0], used: faded >= 2 }]
    }
    const used = [false, false]
    for (const st of usedSteps) {
      for (let i = 0; i < d.length; i++) {
        if (!used[i] && d[i] === st.die) { used[i] = true; break }
      }
    }
    return d.slice(0, 2).map((v, i) => ({ value: v, used: used[i] ?? false }))
  })()
  // Aktif oyuncu ALTTA mı? (beyaz=alt, flip=false). Zarlar gerçek oyundaki gibi onun TARAFINDA:
  // alt oyuncu -> sağ (centerRight), üst oyuncu -> sol (centerLeft). centerMain (orta) DEĞİL.
  const activeBottom = displayBoard?.turn === 'white'
  const diceRow =
    displayBoard && diceFaces.length > 0 ? <DiceRow faces={diceFaces} owner={displayBoard.turn} /> : null

  // TAM EKRAN "normal sayfa": transform'lu bir ata altında render edildiğinde position:fixed
  // KIRPILIP modal gibi kutuya sıkışıyordu (bkz fixed-portal-transform tuzağı). document.body'ye
  // portal ederek gerçek viewport'u kaplar -> izleme normal tam-ekran sayfa gibi görünür.
  return createPortal(
    <div className="app game-view spectate-view" style={{ position: 'fixed', inset: 0, zIndex: 5000 }}>
      {/* İzleme rozeti (sol üst) */}
      <div className="spectate-badge">
        <span className="live-dot" /> <Icon name="eye" size={14} /> {t('live.watching')}
      </div>
      {/* Ses kontrolü (misafirler dahil herkes): hoparlör aç/kapat + seviye kaydırıcısı */}
      <div className="spectate-vol">
        <button
          type="button"
          className="spectate-vol-btn"
          onClick={toggleMute}
          aria-label={t('gm.sound')}
          title={t('gm.sound')}
        >
          <Icon name={muted ? 'mute' : 'volume'} size={18} />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={vol}
          onChange={(e) => onVol(Number(e.target.value))}
          className="spectate-vol-slider"
          aria-label={t('gm.sound')}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="spectate-close"
        onClick={onClose}
        aria-label={t('common.close')}
        title={t('common.close')}
        style={{ position: 'fixed', top: '14px', right: '14px', zIndex: 130 }}
      >
        <Icon name="x" size={18} />
      </Button>

      <main className="main game-scene">
        <div className="game-area">
          {displayBoard ? (
            <>
              {/* p1 = beyaz (altta): 1. oyuncunun gördüğü perspektif. flip=false. */}
              <Sidebar top={mkInfo('black')} bottom={mkInfo('white')} length={target} crawford={crawford} />
              {clock && (
                <ClockStack
                  active={clock.active}
                  delay={clock.delay}
                  white={clock.white}
                  black={clock.black}
                  final={30}
                  flip={false}
                  topScore={score.black}
                  bottomScore={score.white}
                />
              )}
              <Board
                state={displayBoard}
                selectableFroms={new Set()}
                targets={new Set()}
                selectedFrom={null}
                onSelectFrom={() => {}}
                onSelectTarget={() => {}}
                onDragFrom={() => {}}
                pipTop={pipCount(displayBoard, 'black')}
                pipBottom={pipCount(displayBoard, 'white')}
                cube={{ value: cubeVal, owner: cubeOwner }}
                crawford={crawford}
                flip={false}
                showPip
                centerLeft={activeBottom ? null : diceRow}
                centerRight={activeBottom ? diceRow : null}
              />
            </>
          ) : (
            <div className="spectate-status">{gone ? t('live.ended') : t('an.loading')}</div>
          )}
        </div>
      </main>

      {/* MAÇ SONU sonuç kartı: board frozen kalmasın, izleyici kazananı + skoru görsün + kapatsın. */}
      {matchDone && (
        <div className="spectate-result" role="dialog" aria-modal="true">
          <div className="spectate-result-card">
            <span className="sr-ic" aria-hidden="true">
              <Icon name="trophy" size={30} />
            </span>
            <h3>{t('live.matchEnded')}</h3>
            {winnerName ? (
              <div className="sr-winner">{t('live.winnerIs', { name: winnerName })}</div>
            ) : (
              <div className="sr-winner sr-muted">{t('live.ended')}</div>
            )}
            <div className="sr-score">
              <span className="sr-side">
                <b>{p1Name}</b> {score.white}
              </span>
              <span className="sr-dash">–</span>
              <span className="sr-side">
                {score.black} <b>{p2Name}</b>
              </span>
            </div>
            <Button variant="default" className="sr-close" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      )}

      {/* Sol alt: izleyenler (sayı + isimler) — oyuncularla AYNI rozet (bkz ViewersBadge) */}
      <div className="spectate-side">
        <ViewersBadge viewers={viewers} count={viewerCount} />
      </div>
    </div>,
    document.body,
  )
}
