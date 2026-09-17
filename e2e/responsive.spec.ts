import { test, expect, devices } from '@playwright/test'

/**
 * Responsive regresyon güvencesi: kritik route'ların mobil/tablet/masaüstü
 * genişliklerinde YATAY TAŞMA (horizontal overflow) üretmediğini doğrular.
 *
 * Çalıştırma:
 *   - Varsayılan: playwright.config.ts baseURL'ini (5199 dev) kullanır.
 *   - Üretim paritesi (önerilir): bir preview sunucusuna işaret et:
 *       AUDIT_BASE=http://localhost:4183 npx playwright test e2e/responsive.spec.ts
 *     (Not: Vite DEV + React.StrictMode derin-link overlay'leri açmaz; bu yüzden
 *      gerçek sayfa içeriğini denetlemek için üretim `vite preview` bundle'ı hedefle.)
 *
 * NOT: Taşma iddiası HANGİ sayfanın render olduğundan bağımsız geçerlidir —
 * derin-link lobiye düşse bile "yatay taşma yok" güvencesi anlamlıdır.
 */

const BASE = process.env.AUDIT_BASE || ''
const TOKEN = process.env.AUDIT_TOKEN || ''

// pages.ts slug'larından public/kritik alt küme.
const ROUTES = [
  '', // lobi
  'lider-tablosu',
  'online-turnuvalar',
  'turnuva-takvimi',
  'kulupler',
  'haberler',
  'sans-carki',
  'zar-slotu',
  'bahane-makinesi',
  'pozisyon-analizi',
  'mat-analiz',
  'uyelik',
  'magaza',
  'sepet',
  'bilgi/rutbeler',
  'bilgi/adil-zar',
  'yeni-oyun',
  'yz-ile-oyna',
]

const VIEWPORTS = [
  { w: 320, h: 640, label: '320' },
  { w: 390, h: 844, label: '390' },
  { w: 768, h: 1024, label: '768' },
  { w: 1440, h: 900, label: '1440' },
]

function url(slug: string) {
  return (BASE ? BASE.replace(/\/$/, '') : '') + '/' + slug
}

test.describe('responsive: yatay taşma yok', () => {
  for (const vp of VIEWPORTS) {
    for (const slug of ROUTES) {
      test(`@${vp.label} /${slug || '(lobi)'}`, async ({ browser }) => {
        const ctx = await browser.newContext({
          viewport: { width: vp.w, height: vp.h },
          isMobile: vp.w < 820,
          hasTouch: vp.w < 1024,
        })
        if (TOKEN) {
          await ctx.addInitScript((t) => {
            try {
              localStorage.setItem('tavla.token', t as string)
            } catch {
              /* yoksay */
            }
          }, TOKEN)
        }
        const page = await ctx.newPage()
        await page.goto(url(slug), { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1500)
        const { overflow, offender } = await page.evaluate(() => {
          const docW = document.documentElement.scrollWidth
          const winW = window.innerWidth
          let offender = ''
          if (docW - winW > 1) {
            for (const el of document.querySelectorAll('body *')) {
              const r = el.getBoundingClientRect()
              if (!r.width || !r.height) continue
              if (r.right <= winW + 1 && r.left >= -1) continue
              let childOver = false
              for (const c of el.children) {
                const cr = c.getBoundingClientRect()
                if (cr.right > winW + 1 || cr.left < -1) {
                  childOver = true
                  break
                }
              }
              if (childOver) continue
              const cls = typeof el.className === 'string' ? el.className : ''
              offender = `${el.tagName.toLowerCase()}.${cls.slice(0, 60)} [right=${Math.round(r.right)} > ${winW}]`
              break
            }
          }
          return { overflow: docW - winW, offender }
        })
        expect(overflow, `Yatay taşma +${overflow}px — suçlu: ${offender}`).toBeLessThanOrEqual(1)
        await ctx.close()
      })
    }
  }
})

// Dokunma-hedefi güvencesi (mobil): ay-gezinme okları ve hata-bildir FAB'ı ~40px+ olmalı.
test.describe('touch-target min (mobil)', () => {
  test('@390 lobi kontrol boyutları', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['Pixel 7'] })
    const page = await ctx.newPage()
    await page.goto(url(''), { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const sizes = await page.evaluate(() => {
      const pick = (sel: string) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height) }
      }
      return { calNav: pick('.cal-nav button'), bugFab: pick('.bug-fab') }
    })
    if (sizes.calNav) {
      expect(sizes.calNav.w, 'cal-nav genişlik').toBeGreaterThanOrEqual(38)
      expect(sizes.calNav.h, 'cal-nav yükseklik').toBeGreaterThanOrEqual(38)
    }
    if (sizes.bugFab) {
      expect(sizes.bugFab.h, 'bug-fab yükseklik').toBeGreaterThanOrEqual(42)
    }
    await ctx.close()
  })
})
