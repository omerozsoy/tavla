import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { GameState, Player } from '../engine/types'
import { TavlaTvLogo } from './TavlaTvLogo'
import { useT } from '../i18n'

// Ucgen index dizilimleri (index = ucgen numarasi - 1)
// normal = beyazin bakisi (kendi evi sag-alt). flipped = siyahin bakisi (180 cevrilmis).
const LAYOUT = {
  normal: {
    TL: [12, 13, 14, 15, 16, 17],
    TR: [18, 19, 20, 21, 22, 23],
    BL: [11, 10, 9, 8, 7, 6],
    BR: [5, 4, 3, 2, 1, 0],
    topNums: [
      [13, 14, 15, 16, 17, 18],
      [19, 20, 21, 22, 23, 24],
    ],
    botNums: [
      [12, 11, 10, 9, 8, 7],
      [6, 5, 4, 3, 2, 1],
    ],
  },
  flipped: {
    TL: [11, 10, 9, 8, 7, 6],
    TR: [5, 4, 3, 2, 1, 0],
    BL: [12, 13, 14, 15, 16, 17],
    BR: [18, 19, 20, 21, 22, 23],
    topNums: [
      [12, 11, 10, 9, 8, 7],
      [6, 5, 4, 3, 2, 1],
    ],
    botNums: [
      [13, 14, 15, 16, 17, 18],
      [19, 20, 21, 22, 23, 24],
    ],
  },
} as const

// YATAY AYNA (oyun yonu = "sola topla"): sag/sol yarilar yer degistirir ve her ceyregin
// sirasi ters cevrilir -> ev tahtasi SOLA gecer (bear-off tepsisi de solda).
type Layout = {
  TL: readonly number[]
  TR: readonly number[]
  BL: readonly number[]
  BR: readonly number[]
  topNums: readonly (readonly number[])[]
  botNums: readonly (readonly number[])[]
}
const mirrorOf = (L: Layout): Layout => ({
  TL: [...L.TR].reverse(),
  TR: [...L.TL].reverse(),
  BL: [...L.BR].reverse(),
  BR: [...L.BL].reverse(),
  topNums: [[...L.topNums[1]].reverse(), [...L.topNums[0]].reverse()],
  botNums: [[...L.botNums[1]].reverse(), [...L.botNums[0]].reverse()],
})
const MIRROR = { normal: mirrorOf(LAYOUT.normal), flipped: mirrorOf(LAYOUT.flipped) }

type DropKey = number | 'off'
type FromKey = number | 'bar'

// Surukleme callback'i: hedefe birakildi. srcRect = birakilan anki tasin (proxy) ekran
// dikdortgeni -> hedef tas bu konumdan yerine "akar" (flyChecker), boylece tas parmaktan
// kopmadan yerine oturur.
type DragDrop = (to: DropKey, srcRect: DOMRect) => void

interface BoardProps {
  state: GameState
  selectableFroms: Set<number | 'bar'>
  targets: Set<number | 'off'>
  selectedFrom: number | 'bar' | null
  onSelectFrom: (from: number | 'bar') => void
  onSelectTarget: (to: number | 'off') => void
  onDragFrom: (from: number | 'bar') => void
  // Pointer-tabanli surukle-birak YALNIZCA bu prop verilirse etkin olur (ana oyun).
  // PositionAnalyzer gibi kendi surukleme sistemi olan tuketiciler bunu vermez -> pullar
  // etkilesimsiz kalir, catisma olmaz.
  onDragDrop?: DragDrop
  pipTop: number
  pipBottom: number
  cube: { value: number; owner: Player | null }
  crawford?: boolean // Crawford oyunu: kup KULLANILAMAZ -> kupun icine "Crawford" yazilir
  centerLeft?: ReactNode
  centerRight?: ReactNode
  centerMain?: ReactNode
  flip?: boolean // true: siyah oyuncunun bakisi (tahta 180 cevrilir)
  mirror?: boolean // true: oyun yonu "sola topla" (tahta yatay aynalanir, tepsi solda)
  showPip?: boolean // pip sayilari gorunur mu
  watermark?: string // kulup temalarinda board ortasindaki cok soluk takim adi
}

function checkersOf(state: GameState, index: number): { player: Player; count: number } | null {
  const v = state.points[index]
  if (v === 0) return null
  return { player: v > 0 ? 'white' : 'black', count: Math.abs(v) }
}

// Tek tas. Native HTML5 drag KULLANILMAZ (ghost/opacity/kutu/cursor sorunlari onun yuzundendi).
// Surukleme pointer event'leri ile ust bilesende yonetilir; burada yalniz onPointerDown tetikler.
function Checker({
  player,
  draggable,
  onPointerDown,
  label,
  lifted,
}: {
  player: Player
  draggable?: boolean
  onPointerDown?: (e: ReactPointerEvent) => void
  label?: number // 5'ten fazla tasta ustteki tasa toplam sayi yazilir
  lifted?: boolean // surukleme sirasinda kaynaktaki ust tas gizlenir (tek tas hissi)
}) {
  return (
    <div
      className={`checker ${player} ${draggable ? 'draggable' : ''} ${lifted ? 'lifted' : ''}`}
      draggable={false}
      onPointerDown={onPointerDown}
    >
      {label != null && <span className="checker-count">{label}</span>}
    </div>
  )
}

function Point({
  index,
  top,
  state,
  selectable,
  isTarget,
  selected,
  lift,
  onSelectFrom,
  onSelectTarget,
  onCheckerDown,
}: {
  index: number
  top: boolean
  state: GameState
  selectable: boolean
  isTarget: boolean
  selected: boolean
  lift: boolean // bu noktadan tas suruklenirken ust tas gizlensin
  onSelectFrom: (from: number) => void
  onSelectTarget: (to: number) => void
  onCheckerDown?: (e: ReactPointerEvent, from: number, player: Player, label?: number) => void
}) {
  const stack = checkersOf(state, index)
  const shade = index % 2 === 0 ? 'a' : 'b'
  const classes = [
    'point',
    top ? 'top' : 'bottom',
    `shade-${shade}`,
    selectable ? 'selectable' : '',
    isTarget ? 'target' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleClick = () => {
    if (isTarget) onSelectTarget(index)
    else if (selectable) onSelectFrom(index)
  }

  const visible = stack ? Math.min(stack.count, 5) : 0
  return (
    <div className={classes} data-point={index} onClick={handleClick}>
      <div className="checkers">
        {Array.from({ length: visible }).map((_, i) => {
          const isTop = i === visible - 1 // sourceRect() ile ayni: ust/secilebilir tas = son cocuk
          const label = stack!.count > 5 && isTop ? stack!.count : undefined
          return (
            <Checker
              key={i}
              player={stack!.player}
              draggable={selectable}
              lifted={lift && isTop}
              onPointerDown={
                selectable && onCheckerDown && isTop
                  ? (e) => onCheckerDown(e, index, stack!.player, label)
                  : undefined
              }
              label={label}
            />
          )
        })}
      </div>
    </div>
  )
}

function Board({
  state,
  selectableFroms,
  targets,
  selectedFrom,
  onSelectFrom,
  onSelectTarget,
  onDragFrom,
  onDragDrop,
  pipTop,
  pipBottom,
  cube,
  crawford = false,
  centerLeft,
  centerRight,
  centerMain,
  flip = false,
  mirror = false,
  showPip = true,
  watermark,
}: BoardProps) {
  const { t } = useT()
  const L: Layout = mirror
    ? flip
      ? MIRROR.flipped
      : MIRROR.normal
    : flip
      ? LAYOUT.flipped
      : LAYOUT.normal

  // ---------------------------------------------------------------------------
  // Pointer-tabanli surukle-birak (native HTML5 DnD DEGIL).
  // - draggable/dragstart/drop yok -> ghost image, opacity solmasi, not-allowed/copy
  //   cursorlari, secim kutusu olusmaz.
  // - Tas parmagi/fareyi birebir (setPointerCapture + pointermove) takip eder.
  // - Hareket transform:translate3d ile (layout reflow yok); rAF'te tek yazim -> 60fps.
  // - Proxy document.body'ye portal edilir; tema (data-board/checker) <html>'de oldugundan
  //   tasin rengi/dokusu aynen korunur. z-index yuksek + pointer-events:none.
  // - Desktop mouse ve mobil touch ayni kod yolunu kullanir.
  // ---------------------------------------------------------------------------
  const dragEnabled = !!onDragDrop

  type DragInfo = {
    from: FromKey
    player: Player
    label?: number
    pointerId: number
    startX: number
    startY: number
    offsetX: number // pointer'in tas icindeki yakalama noktasi -> surukleme boyunca korunur
    offsetY: number
    w: number
    h: number
    el: HTMLElement
    active: boolean // esik asildi -> gercek surukleme basladi
  }

  const [drag, setDrag] = useState<{ from: FromKey; player: Player; label?: number; w: number; h: number } | null>(
    null,
  )
  const boardElRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragInfo | null>(null)
  const proxyRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const hoverElRef = useRef<HTMLElement | null>(null)

  // En guncel prop/callback'leri ref'te tut: window listener'lari stabil (useCallback []) kalsin,
  // bayat closure olusmasin.
  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const cbRef = useRef({ onDragFrom, onSelectTarget, onDragDrop })
  cbRef.current = { onDragFrom, onSelectTarget, onDragDrop }

  const DRAG_THRESHOLD = 5 // px: altinda -> tik (tap-to-move), ustunde -> surukleme

  const clearHover = useCallback(() => {
    hoverElRef.current?.classList.remove('drop-hover')
    hoverElRef.current = null
  }, [])

  // Hangi gecerli hedef pointer'in altinda? Comert hitbox: once elementFromPoint ile
  // nokta/tepsinin TUM kolonu; olmazsa gecerli hedeflerin genisletilmis dikdortgenlerinden
  // en yakin merkez. Boylece pikselini tutturmak gerekmez.
  const resolveTarget = useCallback((x: number, y: number): DropKey | null => {
    const valid = targetsRef.current
    if (valid.size === 0) return null
    const board = boardElRef.current
    const hostEl = document.elementFromPoint(x, y) as HTMLElement | null
    const host = hostEl?.closest('[data-point],[data-slot="off"]') as HTMLElement | null
    if (host) {
      if (host.dataset.point != null) {
        const idx = Number(host.dataset.point)
        if (valid.has(idx)) return idx
      } else if (host.dataset.slot === 'off' && valid.has('off')) {
        return 'off'
      }
    }
    if (!board) return null
    // Fallback: genisletilmis dikdortgen icinde en yakin merkez
    let best: DropKey | null = null
    let bestDist = Infinity
    valid.forEach((tg) => {
      const tEl =
        tg === 'off'
          ? board.querySelector<HTMLElement>('.bearoff')
          : board.querySelector<HTMLElement>(`.point[data-point="${tg}"]`)
      if (!tEl) return
      const r = tEl.getBoundingClientRect()
      const mx = r.width * 0.5 // yatay comertlik: yarim kolon
      const my = r.height * 0.2
      if (x >= r.left - mx && x <= r.right + mx && y >= r.top - my && y <= r.bottom + my) {
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const d = Math.hypot(x - cx, y - cy)
        if (d < bestDist) {
          bestDist = d
          best = tg
        }
      }
    })
    return best
  }, [])

  const updateHover = useCallback(
    (x: number, y: number) => {
      const board = boardElRef.current
      const to = resolveTarget(x, y)
      let el: HTMLElement | null = null
      if (to != null && board) {
        el =
          to === 'off'
            ? board.querySelector<HTMLElement>('.bearoff')
            : board.querySelector<HTMLElement>(`.point[data-point="${to}"]`)
      }
      if (el !== hoverElRef.current) {
        hoverElRef.current?.classList.remove('drop-hover')
        el?.classList.add('drop-hover')
        hoverElRef.current = el
      }
    },
    [resolveTarget],
  )

  // rAF'te tek transform yazimi -> her pikselde React render YOK, reflow YOK.
  const flushMove = useCallback(() => {
    rafRef.current = null
    const d = dragRef.current
    const p = proxyRef.current
    if (!d || !d.active || !p) return
    const x = posRef.current.x - d.offsetX
    const y = posRef.current.y - d.offsetY
    p.style.transform = `translate3d(${x}px, ${y}px, 0)`
    updateHover(posRef.current.x, posRef.current.y)
  }, [updateHover])

  const removeWinListeners = useCallback(() => {
    window.removeEventListener('pointermove', onWinMove)
    window.removeEventListener('pointerup', onWinUp)
    window.removeEventListener('pointercancel', onWinCancel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const endCommon = useCallback(() => {
    removeWinListeners()
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    clearHover()
    document.body.classList.remove('checker-dragging')
  }, [removeWinListeners, clearHover])

  // Gecersiz birakma: proxy kaynaga akici geri doner, sonra kaynak geri acilir.
  const snapBack = useCallback((d: DragInfo) => {
    const proxy = proxyRef.current
    const finish = () => {
      dragRef.current = null
      setDrag(null) // proxy kalkar + kaynak ust tas geri gorunur (AYNI frame)
    }
    if (!proxy) {
      finish()
      return
    }
    const sr = d.el.getBoundingClientRect() // kaynak tas (gizli ama DOM'da, rect gecerli)
    const curX = posRef.current.x - d.offsetX
    const curY = posRef.current.y - d.offsetY
    const anim = proxy.animate(
      [
        { transform: `translate3d(${curX}px, ${curY}px, 0)` },
        { transform: `translate3d(${sr.left}px, ${sr.top}px, 0)` },
      ],
      { duration: 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    )
    anim.onfinish = finish
    anim.oncancel = finish
  }, [])

  const finishDrag = useCallback(
    (to: DropKey | null) => {
      const d = dragRef.current
      if (!d) return
      if (to != null && targetsRef.current.has(to)) {
        // Gecerli: hedef tas, BIRAKILAN konumdan yerine aksin (flyChecker icin srcRect=proxy).
        const pr = proxyRef.current?.getBoundingClientRect() ?? null
        dragRef.current = null
        setDrag(null) // proxy kalkar; hamle render'i ayni frame'de kaynak/hedefi gunceller
        const drop = cbRef.current.onDragDrop
        if (drop && pr) drop(to, pr)
        else cbRef.current.onSelectTarget(to)
      } else {
        snapBack(d)
      }
    },
    [snapBack],
  )

  const onWinMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      posRef.current = { x: e.clientX, y: e.clientY }
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return
        // Esik asildi -> gercek surukleme basliyor
        d.active = true
        try {
          d.el.setPointerCapture(d.pointerId)
        } catch {
          /* yoksay */
        }
        document.body.classList.add('checker-dragging')
        cbRef.current.onDragFrom(d.from) // yesil hedefleri goster (selectedFrom set)
        setDrag({ from: d.from, player: d.player, label: d.label, w: d.w, h: d.h }) // proxy + lift
      }
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushMove)
    },
    [flushMove],
  )

  const onWinUp = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      endCommon()
      if (!d.active) {
        // Tik (surukleme degil): native click -> Point.onClick kaynagi secsin (tap-to-move).
        dragRef.current = null
        return
      }
      const to = resolveTarget(e.clientX, e.clientY)
      finishDrag(to)
      // Surukleme sonrasi olusan sentetik click'i yut (cift secim/kaynak degisimi olmasin).
      const swallow = (ev: Event) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 350)
    },
    [endCommon, resolveTarget, finishDrag],
  )

  const onWinCancel = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      endCommon()
      if (d.active) snapBack(d)
      else dragRef.current = null
    },
    [endCommon, snapBack],
  )

  const startDrag = useCallback(
    (e: ReactPointerEvent, from: FromKey, player: Player, label?: number) => {
      if (!dragEnabled) return
      if (e.pointerType === 'mouse' && e.button !== 0) return // yalniz sol tus
      const el = e.currentTarget as HTMLElement
      const rect = el.getBoundingClientRect()
      dragRef.current = {
        from,
        player,
        label,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        w: rect.width,
        h: rect.height,
        el,
        active: false,
      }
      posRef.current = { x: e.clientX, y: e.clientY }
      window.addEventListener('pointermove', onWinMove)
      window.addEventListener('pointerup', onWinUp)
      window.addEventListener('pointercancel', onWinCancel)
    },
    [dragEnabled, onWinMove, onWinUp, onWinCancel],
  )

  // Proxy mount olunca hemen dogru konuma yerlestir (0,0'da flash olmasin).
  const setProxyNode = useCallback((node: HTMLDivElement | null) => {
    proxyRef.current = node
    if (node) {
      const d = dragRef.current
      if (d) {
        const x = posRef.current.x - d.offsetX
        const y = posRef.current.y - d.offsetY
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }
    }
  }, [])

  // Unmount temizligi: askida kalan listener/sinif/raf birakma.
  useEffect(() => {
    return () => {
      removeWinListeners()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      document.body.classList.remove('checker-dragging')
      hoverElRef.current?.classList.remove('drop-hover')
    }
  }, [removeWinListeners])

  const renderPoint = (index: number, top: boolean) => (
    <Point
      key={index}
      index={index}
      top={top}
      state={state}
      selectable={selectableFroms.has(index)}
      isTarget={targets.has(index)}
      selected={selectedFrom === index}
      lift={drag?.from === index}
      onSelectFrom={onSelectFrom}
      onSelectTarget={onSelectTarget}
      onCheckerDown={dragEnabled ? startDrag : undefined}
    />
  )

  const barSelectable = selectableFroms.has('bar')
  const offTarget = targets.has('off')

  // Cevrilince ust/alt taraflar yer degistirir (kendi taslarin hep altta)
  const topPip = flip ? pipBottom : pipTop
  const bottomPip = flip ? pipTop : pipBottom
  const topBarPlayer: Player = flip ? 'white' : 'black'
  const bottomBarPlayer: Player = flip ? 'black' : 'white'
  const topBarCount = flip ? state.bar.white : state.bar.black
  const bottomBarCount = flip ? state.bar.black : state.bar.white
  const topOffPlayer: Player = flip ? 'white' : 'black'
  const topOffCount = flip ? state.off.white : state.off.black
  const bottomOffPlayer: Player = flip ? 'black' : 'white'
  const bottomOffCount = flip ? state.off.black : state.off.white

  return (
    <div className={`board${mirror ? ' mirror' : ''}${drag ? ' dragging' : ''}`} ref={boardElRef}>
      {/* Ust ucgen numaralari */}
      <div className="pt-numbers top">
        {L.topNums[0].map((n) => (
          <span key={n}>{n}</span>
        ))}
        <span className="num-gap" />
        {L.topNums[1].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      <div className="board-inner">
        {/* TavlaTV watermark: her yarinin merkezinde, taslarin/zarin/kupun ALTINDA,
            pointlerin USTUNDE. Logo/arma DEGIL; sadece yazi. Kulup temasinda takim adi. */}
        <div className="board-watermark" aria-hidden="true">
          <div className="wm-cell">
            <TavlaTvLogo color="var(--wm-color)" size="calc(var(--col) * 0.62)" className="wm-logo" />
            {watermark && <span className="wm-team">{watermark}</span>}
          </div>
          <div className="wm-cell">
            <TavlaTvLogo color="var(--wm-color)" size="calc(var(--col) * 0.62)" className="wm-logo" />
            {watermark && <span className="wm-team">{watermark}</span>}
          </div>
        </div>

        {/* Sol yari */}
        <div className="half">
          <div className="quadrant top">{L.TL.map((i) => renderPoint(i, true))}</div>
          <div className="quadrant bottom">{L.BL.map((i) => renderPoint(i, false))}</div>
        </div>

        {/* Orta bar: pip sayilari + cube + bar taslari */}
        <div
          className={`bar ${barSelectable ? 'selectable' : ''} ${selectedFrom === 'bar' ? 'selected' : ''}`}
          data-slot="bar"
          onClick={() => barSelectable && onSelectFrom('bar')}
        >
          {showPip && <div className="pip pip-top">{topPip}</div>}
          <div className="bar-checkers top">
            {/* Kirik taslar YIGILMAZ: tek tas, ortasinda kirik adedi (>1 iken) */}
            {topBarCount > 0 && (
              <Checker
                player={topBarPlayer}
                draggable={barSelectable}
                lifted={drag?.from === 'bar'}
                onPointerDown={
                  barSelectable && dragEnabled
                    ? (e) => startDrag(e, 'bar', topBarPlayer, topBarCount > 1 ? topBarCount : undefined)
                    : undefined
                }
                label={topBarCount > 1 ? topBarCount : undefined}
              />
            )}
          </div>
          {/* Küp GÖRSEL tarafı flip'e göre: sahibi görsel üstteyse üstte, alttaysa altta
              (owner renk sabit değil; online'da tahta çevrilince sahip alta gelir). */}
          {/* Crawford oyununda kup kullanilamaz: sayi yerine "Crawford" yazilir ki iki
              oyuncu da durumu tahtadan gorsun (kup degeri zaten 1'de sabit kalir). */}
          <div
            className={`cube cube-${
              cube.owner == null ? 'center' : cube.owner === topBarPlayer ? 'top' : 'bottom'
            }${crawford ? ' cube-crawford' : ''}`}
            title={crawford ? t('board.crawfordHint') : t('board.cube')}
          >
            {crawford ? t('board.crawford') : cube.value === 1 ? 64 : cube.value}
          </div>
          <div className="bar-checkers bottom">
            {/* Kirik taslar YIGILMAZ: tek tas, ortasinda kirik adedi (>1 iken) */}
            {bottomBarCount > 0 && (
              <Checker
                player={bottomBarPlayer}
                draggable={barSelectable}
                lifted={drag?.from === 'bar'}
                onPointerDown={
                  barSelectable && dragEnabled
                    ? (e) =>
                        startDrag(e, 'bar', bottomBarPlayer, bottomBarCount > 1 ? bottomBarCount : undefined)
                    : undefined
                }
                label={bottomBarCount > 1 ? bottomBarCount : undefined}
              />
            )}
          </div>
          {showPip && <div className="pip pip-bottom">{bottomPip}</div>}
        </div>

        {/* Sag yari */}
        <div className="half">
          <div className="quadrant top">{L.TR.map((i) => renderPoint(i, true))}</div>
          <div className="quadrant bottom">{L.BR.map((i) => renderPoint(i, false))}</div>
        </div>

        {/* Merkez overlay (Double / Roll / zar / kup / oyun sonu) */}
        {centerMain ? (
          <div className="center-overlay main">{centerMain}</div>
        ) : (
          <>
            {centerLeft && <div className="center-overlay left">{centerLeft}</div>}
            {centerRight && <div className="center-overlay right">{centerRight}</div>}
          </>
        )}
      </div>

      {/* Alt ucgen numaralari */}
      <div className="pt-numbers bottom">
        {L.botNums[0].map((n) => (
          <span key={n}>{n}</span>
        ))}
        <span className="num-gap" />
        {L.botNums[1].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      {/* Bear-off tepsisi (off hedefi). Oyun yonu "sola topla" iken CSS ile sola gecer. */}
      <div
        className={`bearoff ${offTarget ? 'target' : ''}`}
        data-slot="off"
        onClick={() => offTarget && onSelectTarget('off')}
      >
        <div className="bearoff-slot top">
          {Array.from({ length: topOffCount }).map((_, i) => (
            <span key={i} className={`off-checker ${topOffPlayer}`} />
          ))}
          {/* Sayi ic (merkez) kenara: cubuklar ustten dizilir, "6" tepsinin ortasina yakin */}
          {topOffCount > 0 && (
            <span className={`bearoff-count ${topOffPlayer}`}>{topOffCount}</span>
          )}
        </div>
        <div className="bearoff-slot bottom">
          {/* Sayi ic (merkez) kenara: "4" tepsinin ortasina yakin, cubuklar alttan dizilir */}
          {bottomOffCount > 0 && (
            <span className={`bearoff-count ${bottomOffPlayer}`}>{bottomOffCount}</span>
          )}
          {Array.from({ length: bottomOffCount }).map((_, i) => (
            <span key={i} className={`off-checker ${bottomOffPlayer}`} />
          ))}
        </div>
      </div>

      {/* Surukleme proxy'si: document.body'ye portal (tema <html>'de -> gorunum korunur).
          position:fixed + translate3d ile parmagi birebir takip eder; pointer-events:none. */}
      {drag &&
        createPortal(
          <div className="drag-layer" aria-hidden="true">
            <div
              ref={setProxyNode}
              className={`checker ${drag.player} dragging`}
              draggable={false}
              style={{ width: drag.w, height: drag.h }}
            >
              {drag.label != null && <span className="checker-count">{drag.label}</span>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

// React.memo: ust bileşen ayni prop'larla yeniden render olursa Board atlanir.
// Tam fayda icin App.tsx handler'lari useCallback'e alinmali (App bolme faziyla).
export default memo(Board)
