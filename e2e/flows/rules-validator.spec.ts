import { expect, test, type APIRequestContext } from '@playwright/test'

// KONTROLLÜ KURAL SENARYOLARI — gerçek (çalışan) validator servisine sabit tahta + sabit zar
// gönderilir. Backend /move her hamleyi BU servise doğrulatır; dolayısıyla burada reddedilen
// hamle sunucuda da reddedilir. Üretime hiçbir test kancası eklenmez (validator zaten durumu
// istekten alır). Konvansiyon: beyaz +, siyah -, beyaz 23->0 yönünde, siyah 0->23.
const V = process.env.VALIDATOR_URL || 'http://127.0.0.1:8091'
const SECRET = process.env.VALIDATOR_SECRET || 'e2esecret'

type S = { from: number | 'bar'; to: number | 'off'; die: number }
function st(points: Record<number, number>, dice: number[], extra: Partial<{ bar: { white: number; black: number }; off: { white: number; black: number }; turn: 'white' | 'black' }> = {}) {
  const p = Array(24).fill(0)
  for (const [k, v] of Object.entries(points)) p[Number(k)] = v
  return { points: p, bar: extra.bar ?? { white: 0, black: 0 }, off: extra.off ?? { white: 0, black: 0 }, turn: extra.turn ?? 'white', dice, diceUsed: dice.map(() => false) }
}
async function validate(request: APIRequestContext, state: unknown, steps: S[]) {
  const r = await request.post(`${V}/validate`, { headers: { 'x-validator-secret': SECRET }, data: { state, steps } })
  expect(r.status()).toBe(200)
  return (await r.json()) as { valid: boolean; reason?: string; state?: { points: number[]; bar: Record<string, number>; off: Record<string, number>; turn: string } }
}
// Tahtayı 15 taşa tamamlamak için "park" taşları (oyunu etkilemeyen uzak haneler).
const parkW = (n: number) => ({ 0: n }) // beyaz 1. hanede (evde)

test.describe('kural: zar kullanımı', () => {
  test('iki zar da oynanabiliyorsa tek zarla bitirilemez', async ({ request }) => {
    const s = st({ 12: 2, 0: 13, 6: -15 }, [3, 5])
    expect((await validate(request, s, [{ from: 12, to: 9, die: 3 }])).reason).toBe('turn-incomplete')
    expect((await validate(request, s, [{ from: 12, to: 9, die: 3 }, { from: 12, to: 7, die: 5 }])).valid).toBe(true)
  })

  test('yalnız bir zar oynanabiliyorsa BÜYÜK zar oynanmalı', async ({ request }) => {
    // Beyaz tek taş 20'de; zar 2-6. 6 ile 14'e gidebilir, 2 ile 18'e gidebilir; ama ikisi BİRLİKTE
    // oynanamasın: 14-2=12 ve 18-6=12 siyahla kapalı. Kural: büyük zar (6).
    const s = st({ 20: 1, 0: 14, 12: -2, 23: -13 }, [2, 6])
    const small = await validate(request, s, [{ from: 20, to: 18, die: 2 }])
    const big = await validate(request, s, [{ from: 20, to: 14, die: 6 }])
    expect(small.valid, `küçük zar kabul edilmemeli (${small.reason})`).toBe(false)
    expect(big.valid, `büyük zar kabul edilmeli (${big.reason})`).toBe(true)
  })

  test('çift zar: dört hamle', async ({ request }) => {
    const s = st({ 23: 2, 0: 13, 5: -15 }, [3, 3, 3, 3])
    const steps: S[] = [{ from: 23, to: 20, die: 3 }, { from: 23, to: 20, die: 3 }, { from: 20, to: 17, die: 3 }, { from: 20, to: 17, die: 3 }]
    expect((await validate(request, s, steps)).valid).toBe(true)
    expect((await validate(request, s, steps.slice(0, 3))).reason).toBe('turn-incomplete')
  })

  test('hamle varken pas geçilemez; hamle yoksa pas geçerli', async ({ request }) => {
    expect((await validate(request, st({ 12: 1, 0: 14, 6: -15 }, [1, 2]), [])).reason).toBe('moves-available')
    // Beyaz bardan girecek ama siyahın evi (beyazın giriş haneleri 18..23) tamamen kapalı.
    const closed = st({ 18: -2, 19: -2, 20: -2, 21: -2, 22: -2, 23: -2, 0: 14, 5: -3 }, [4, 6], { bar: { white: 1, black: 0 } })
    expect((await validate(request, closed, [])).valid).toBe(true)
  })
})

test.describe('kural: bar ve kırma', () => {
  test('bardaki taş girmeden başka taş oynanamaz', async ({ request }) => {
    const s = st({ 12: 1, 0: 13, 5: -15 }, [3, 5], { bar: { white: 1, black: 0 } })
    expect((await validate(request, s, [{ from: 12, to: 9, die: 3 }, { from: 12, to: 7, die: 5 }])).valid).toBe(false)
    const ok = await validate(request, s, [{ from: 'bar', to: 21, die: 3 }, { from: 21, to: 16, die: 5 }])
    expect(ok.valid, ok.reason).toBe(true)
  })

  test('tek siyah taşa (açık) gelmek onu bara gönderir', async ({ request }) => {
    const s = st({ 12: 1, 0: 14, 9: -1, 3: -14 }, [3, 1])
    const r = await validate(request, s, [{ from: 12, to: 9, die: 3 }, { from: 9, to: 8, die: 1 }])
    expect(r.valid, r.reason).toBe(true)
    expect(r.state?.bar.black).toBe(1)
    expect(r.state?.points[9]).toBe(0)
  })

  test('kapalı haneye (2+ rakip taş) gidilemez; rakip taşı ve ters yön oynatılamaz', async ({ request }) => {
    const s = st({ 12: 1, 0: 14, 9: -2, 3: -13 }, [3, 1])
    expect((await validate(request, s, [{ from: 12, to: 9, die: 3 }, { from: 9, to: 8, die: 1 }])).valid).toBe(false)
    expect((await validate(request, s, [{ from: 3, to: 6, die: 3 }, { from: 12, to: 11, die: 1 }])).valid).toBe(false) // siyah taşı
    expect((await validate(request, s, [{ from: 12, to: 15, die: 3 }, { from: 15, to: 16, die: 1 }])).valid).toBe(false) // ters yön
  })
})

test.describe('kural: toplama (bear-off)', () => {
  test('tüm taşlar evde değilken toplanamaz', async ({ request }) => {
    const s = st({ 7: 1, 2: 14, 18: -15 }, [6, 3])
    expect((await validate(request, s, [{ from: 2, to: 'off', die: 3 }, { from: 7, to: 1, die: 6 }])).valid).toBe(false)
  })

  test('tam zarla toplama; daha büyük zarla yalnız en yüksek haneden toplama', async ({ request }) => {
    // Beyaz ev: 14 taş 1. hanede (idx0), 1 taş 4. hanede (idx3). Zar 6-5: en yüksek hane 4 -> 6 ile 4'ten topla.
    const s = st({ ...parkW(14), 3: 1, 18: -15 }, [6, 5])
    const ok = await validate(request, s, [{ from: 3, to: 'off', die: 6 }, { from: 0, to: 'off', die: 5 }])
    expect(ok.valid, ok.reason).toBe(true)
    expect(ok.state?.off.white).toBe(2)
    // Daha yüksek hanede taş varken büyük zar alttan toplayamaz: idx3 doluyken 6 ile idx0'dan toplama YOK.
    expect((await validate(request, s, [{ from: 0, to: 'off', die: 6 }, { from: 3, to: 'off', die: 5 }])).valid).toBe(false)
  })

  test('son taş toplanınca tahtada beyaz kalmaz (oyun biter)', async ({ request }) => {
    const s = st({ 0: 1, 1: 1, 18: -15 }, [1, 2], { off: { white: 13, black: 0 } })
    const r = await validate(request, s, [{ from: 0, to: 'off', die: 1 }, { from: 1, to: 'off', die: 2 }])
    expect(r.valid, r.reason).toBe(true)
    expect(r.state?.off.white).toBe(15)
  })
})

test('siyah yön ve giriş: bar -> zar-1 hanesi', async ({ request }) => {
  const s = st({ 23: 15, 10: -14 }, [2, 4], { bar: { white: 0, black: 1 }, turn: 'black' })
  const r = await validate(request, s, [{ from: 'bar', to: 1, die: 2 }, { from: 1, to: 5, die: 4 }])
  expect(r.valid, r.reason).toBe(true)
  expect((await validate(request, s, [{ from: 'bar', to: 22, die: 2 }, { from: 10, to: 6, die: 4 }])).valid).toBe(false)
})
