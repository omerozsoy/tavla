import { describe, it, expect, beforeEach } from 'vitest'
import { turnStarted, noteBlur, consumeBlur } from './secondScreen'

// İkinci-ekran bayrağı: zar(turnStarted) sıfırlar, blur işaretler, hamle(consume) okur+sıfırlar.
describe('secondScreen', () => {
  beforeEach(() => {
    consumeBlur() // durumu sıfırla
  })

  it('tur başında blur yoksa false', () => {
    turnStarted()
    expect(consumeBlur()).toBe(false)
  })

  it('blur işaretlenince true, consume sonrası tekrar false', () => {
    turnStarted()
    noteBlur()
    expect(consumeBlur()).toBe(true)
    expect(consumeBlur()).toBe(false)
  })

  it('turnStarted rakip-turu blurunu temizler', () => {
    noteBlur() // rakip turunda masum blur
    turnStarted() // benim turum başladı
    expect(consumeBlur()).toBe(false)
  })
})
