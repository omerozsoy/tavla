import { describe, it, expect } from 'vitest'
import { initialState, cloneState, opponent } from '../engine/board'
import { maximalTerminals, boardKey } from '../engine/moves'
import { moveNotation } from '../engine/notation'
import type { GameState, Player } from '../engine/types'
import { reconstructOppMove } from './oppMove'

// Rakibin tur-basi durumunu kur (zar atilmis, sira onda)
const turnOf = (base: GameState, player: Player, dice: number[]): GameState => ({
  ...cloneState(base),
  turn: player,
  dice,
  diceUsed: dice.map(() => false),
})

describe('reconstructOppMove — otoriter gecisten rakip hamlesi', () => {
  it('acilis hamlesini tahtadan geri uretir (notasyon birebir)', () => {
    const prev = turnOf(initialState(), 'black', [3, 1])
    // Rakip 8/5 6/5 oynadi: motorun ayni sonucu veren terminalini bul
    const want = maximalTerminals(prev).find(
      (t) => moveNotation({ steps: t.steps, resultKey: '' }, 'black') === '8/5 6/5',
    )
    expect(want, 'test kurulumu: 8/5 6/5 legal olmali').toBeTruthy()
    const next: GameState = { ...cloneState(want!.state), turn: 'white', dice: [], diceUsed: [] }

    const steps = reconstructOppMove(prev, next)
    expect(steps).not.toBeNull()
    expect(moveNotation({ steps: steps!, resultKey: '' }, 'black')).toBe('8/5 6/5')
  })

  it('tum acilis zarlari icin dogru tahtayi verir', () => {
    for (const dice of [[6, 5], [6, 4], [5, 3], [4, 2], [2, 1], [3, 3]]) {
      const d = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice
      const prev = turnOf(initialState(), 'black', d)
      for (const t of maximalTerminals(prev).slice(0, 6)) {
        const next: GameState = { ...cloneState(t.state), turn: 'white', dice: [], diceUsed: [] }
        const steps = reconstructOppMove(prev, next)
        expect(steps, `zar=${d}`).not.toBeNull()
        // Geri uretilen adimlar AYNI tahtaya goturmeli (adim sirasi farkli olabilir)
        const replay = cloneState(prev)
        for (const st of steps!) {
          if (st.from === 'bar') replay.bar.black -= 1
          else replay.points[st.from] -= -1
          if (st.to === 'off') replay.off.black += 1
          else replay.points[st.to] += -1
        }
        expect(boardKey(replay)).toBe(boardKey(t.state))
      }
    }
  })

  it('dance (oynanamayan tur) bos adim dizisi olarak cozulur', () => {
    // Siyah bar'da, beyaz siyahin tum giris noktalarini kapatmis -> giremez
    const s = initialState()
    const blocked = cloneState(s)
    blocked.points = new Array(24).fill(0)
    blocked.bar.black = 1
    // Siyah bar'dan BEYAZIN ev tahtasina girer (beyaz 1-6 = index 0..5) -> orasi kapali
    for (let i = 0; i <= 5; i++) blocked.points[i] = 2
    blocked.points[23] = -14 // kalan siyah taslar
    const prev = turnOf(blocked, 'black', [6, 6, 6, 6])
    expect(maximalTerminals(prev).every((t) => t.steps.length === 0)).toBe(true)
    const next: GameState = { ...cloneState(blocked), turn: 'white', dice: [], diceUsed: [] }
    expect(reconstructOppMove(prev, next)).toEqual([])
  })

  it('tur devretmemisse ya da zar yoksa null doner', () => {
    const prev = turnOf(initialState(), 'black', [3, 1])
    const same: GameState = { ...cloneState(prev), turn: 'black' }
    expect(reconstructOppMove(prev, same)).toBeNull() // tur hala rakipte
    expect(reconstructOppMove(null, same)).toBeNull()
    const noDice: GameState = { ...cloneState(initialState()), turn: 'black', dice: [], diceUsed: [] }
    expect(reconstructOppMove(noDice, { ...cloneState(initialState()), turn: 'white' })).toBeNull()
  })

  it('eslesmeyen tahta (yeni oyun / bozuk gecis) null doner -> uydurma kayit yok', () => {
    const prev = turnOf(initialState(), 'black', [3, 1])
    const other = cloneState(initialState())
    other.off.black = 7 // bu zarlarla ulasilamaz
    expect(reconstructOppMove(prev, { ...other, turn: 'white' as Player })).toBeNull()
  })

  it('otoriter mac boyunca: iki taraflı log kurulur (rakip sutunu dolar)', () => {
    // Basit simulasyon: her tur motor bir hamle secer, "sunucu" tahtayi doner,
    // istemci reconstructOppMove ile rakibin hamlesini geri urettir.
    let s: GameState = initialState()
    let mover: Player = 'white'
    let recovered = 0
    for (let i = 0; i < 12; i++) {
      const dice = [1 + (i % 6), 1 + ((i + 2) % 6)].sort((a, b) => b - a)
      const prev = turnOf(s, mover, dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice)
      const terms = maximalTerminals(prev)
      const pick = terms[i % terms.length]
      const next: GameState = { ...cloneState(pick.state), turn: opponent(mover), dice: [], diceUsed: [] }
      const steps = reconstructOppMove(prev, next)
      expect(steps, `tur ${i}`).not.toBeNull()
      recovered += 1
      s = { ...cloneState(pick.state), dice: [], diceUsed: [] }
      mover = opponent(mover)
    }
    expect(recovered).toBe(12) // hicbir tur kaybolmadi -> .mat'te sutun bosluk kalmaz
  })
})
