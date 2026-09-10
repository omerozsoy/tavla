import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import Board from './Board'
import Sidebar from './Sidebar'
import ClockStack from './ClockStack'
import DiceRow from './Dice'
import { showRoom, watchRoom, type RoomView, type ServerMatch, type RoomViewer, type ChatMsg } from '../api'
import { pipCount } from '../engine/evaluate'
import { cloneState } from '../engine/board'
import { applyStep } from '../engine/moves'
import type { GameState, Player, Step } from '../engine/types'

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
    const id = window.setInterval(poll, 2000)
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

  const score: Record<Player, number> = sm?.score ??
    legacy?.match?.score ?? { white: 0, black: 0 }
  const target = eff?.target ?? sm?.target ?? legacy?.match?.target ?? 1
  const cubeVal = sm?.cube.value ?? legacy?.match?.cube?.value ?? 1
  const cubeOwner: Player | null = sm?.cube.owner ?? legacy?.match?.cube?.owner ?? null
  const crawford = sm?.crawford ?? legacy?.match?.isCrawford ?? false

  // Konvansiyon: p1 = beyaz (altta), p2 = siyah (üstte); izleyici beyaz bakışıyla oturur.
  const p1Name = eff?.p1_name || t('player.white')
  const p2Name = eff?.p2_name || t('player.black')

  const mkInfo = (color: Player): Parameters<typeof Sidebar>[0]['top'] => {
    const isP1 = color === 'white'
    const name = isP1 ? p1Name : p2Name
    return {
      name,
      avatar: (name || '?').slice(0, 1).toUpperCase(),
      sub: '',
      off: board?.off[color] ?? 0,
      active: board?.turn === color,
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
    const d = board?.dice ?? []
    if (d.length === 0) return []
    if (d.length === 4) {
      const faded = Math.floor(legacyPlayed.length / 2) // çift: her zar 2 hamle
      return [{ value: d[0], used: faded >= 1 }, { value: d[0], used: faded >= 2 }]
    }
    const used = [false, false]
    for (const st of legacyPlayed) {
      for (let i = 0; i < d.length; i++) {
        if (!used[i] && d[i] === st.die) { used[i] = true; break }
      }
    }
    return d.slice(0, 2).map((v, i) => ({ value: v, used: used[i] ?? false }))
  })()
  // Aktif oyuncu ALTTA mı? (beyaz=alt, flip=false). Zarlar gerçek oyundaki gibi onun TARAFINDA:
  // alt oyuncu -> sağ (centerRight), üst oyuncu -> sol (centerLeft). centerMain (orta) DEĞİL.
  const activeBottom = board?.turn === 'white'
  const diceRow = board && diceFaces.length > 0 ? <DiceRow faces={diceFaces} owner={board.turn} /> : null
  const messages: ChatMsg[] = rv?.messages ?? []

  return (
    <div className="app game-view spectate-view" style={{ position: 'fixed', inset: 0, zIndex: 5000 }}>
      {/* İzleme rozeti (sol üst) */}
      <div className="spectate-badge">
        <span className="live-dot" /> <Icon name="eye" size={14} /> {t('live.watching')}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label={t('common.close')}
        title={t('common.close')}
        style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 120 }}
      >
        <Icon name="x" size={16} />
      </Button>

      <main className="main game-scene">
        <div className="game-area">
          {board ? (
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
                state={board}
                selectableFroms={new Set()}
                targets={new Set()}
                selectedFrom={null}
                onSelectFrom={() => {}}
                onSelectTarget={() => {}}
                onDragFrom={() => {}}
                pipTop={pipCount(board, 'black')}
                pipBottom={pipCount(board, 'white')}
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

      {/* Sol alt: izleyenler (sayı + isimler) + maç sohbeti (salt-okunur) */}
      <div className="spectate-side">
        <div className="sp-viewers">
          <div className="sp-viewers-head">
            <Icon name="eye" size={14} /> {t('live.watchCount', { n: viewerCount })}
          </div>
          {viewers.length > 0 && (
            <div className="sp-viewers-list">
              {viewers.map((v, i) => (
                <span key={i} className="sp-viewer" title={v.name}>
                  {v.avatar ? (
                    <img className="sp-viewer-av" src={v.avatar} alt="" />
                  ) : (
                    <span className="sp-viewer-av sp-viewer-init">{(v.name || '?').slice(0, 1).toUpperCase()}</span>
                  )}
                  <span className="sp-viewer-name">{v.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="sp-chat">
          <div className="sp-chat-head">
            <Icon name="chat" size={14} /> {t('chat.title')}
          </div>
          <div className="sp-chat-list">
            {messages.length === 0 ? (
              <div className="chat-empty">{t('chat.empty')}</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="chat-msg theirs">
                  <span className="chat-name">{m.name}</span>
                  <span className="chat-text">{m.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
