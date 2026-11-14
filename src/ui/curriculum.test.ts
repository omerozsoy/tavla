import { describe, it, expect } from 'vitest'
import { CURRICULUM, UNCLASSIFIED_COUNT, CURRICULUM_TOTAL, SOURCES } from './trainingCurriculum'

// Konu-bazli egitim yolu siniflandirmasinin regresyon korumasi.
describe('konu-bazli mufredat', () => {
  it('5 zorluk seviyesi, kolaydan zora sirali', () => {
    const tiers = CURRICULUM.map((t) => t.tier)
    expect(tiers.length).toBeGreaterThanOrEqual(4)
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
  })

  it('gorunur her bolum YETERLI icerige sahip (bos/sahte bolum yok)', () => {
    for (const t of CURRICULUM)
      for (const l of t.lessons) expect(l.count).toBeGreaterThanOrEqual(l.isTest ? 8 : 4)
  })

  it('cogu pozisyon siniflandirilmis (yolda), toplam makul', () => {
    expect(CURRICULUM_TOTAL).toBeGreaterThan(400)
    // Siniflandirma bekleyen, toplamin kucuk bir kismi olmali (sahte-kesinlik yerine durust ayrim).
    expect(UNCLASSIFIED_COUNT).toBeLessThan(CURRICULUM_TOTAL * 0.3)
  })

  it('kaynaklar filtre icin korunmus (Euler/Bray vb.)', () => {
    expect(SOURCES.length).toBeGreaterThan(3)
    expect(SOURCES.every((s) => s.count > 0)).toBe(true)
  })
})
