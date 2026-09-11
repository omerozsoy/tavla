/**
 * FairDiceInfo — Bilgi › Adil Zar sayfasinin yeniden tasarimi.
 *
 * Amac: adil zar sistemini 10 yasindaki bir cocugun bile anlayacagi sade, guven veren
 * bir dille anlatmak. Teknik kavramlar (CSPRNG, reddetme ornekleme) "Teknik Detaylar"
 * accordion'una saklanir. En altta ETKILESIMLI test alani: GERCEK oyun zar fonksiyonu
 * secureDie() ile binlerce atis yapip dagilimi + Ki-Kare (dagilim) testini gosterir.
 *
 * Tasarim: mevcut tasarim sistemi (token/kart/Outfit), dark-tema uyumlu, Phosphor ikon.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from './Icon'
import { useT } from '../i18n'
import { secureDie } from '../engine/game'
import { summarize, type DiceTestResult } from '../engine/diceStats'
import { FairDice, sha256Hex, verifyRoll } from '../engine/fairDice'

const PRESETS = [100, 1000, 10000, 100000]
const MAX_ROLLS = 1_000_000
const BATCH = 20000 // UI'yi bloklamamak icin parca buyuklugu
const GITHUB_URL = 'https://github.com/Backgammon-Galaxy/dice_roller'

// Lang -> Intl locale (sayi/yuzde bicimleme yerel olsun: %16,67 vs 16.67%).
const LOCALE: Record<string, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR',
  el: 'el-GR',
  ru: 'ru-RU',
  fa: 'fa-IR',
}

function dieIcon(v: number): IconName {
  const n = Math.min(6, Math.max(1, Math.round(v)))
  return ('die-' + n) as IconName
}

export default function FairDiceInfo() {
  const { t, lang } = useT()
  const loc = LOCALE[lang] ?? 'en-US'
  const nfInt = new Intl.NumberFormat(loc)
  const nfPct = new Intl.NumberFormat(loc, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const nf1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 2 })

  // ---- Test alani state ----
  const [count, setCount] = useState(1000)
  const [customMode, setCustomMode] = useState(false)
  const [customStr, setCustomStr] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<DiceTestResult | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showTech, setShowTech] = useState(false)
  const runIdRef = useRef(0)

  // ---- Tohumla dogrulama (provably-fair) state ----
  // Ornek bir mac: tarayicida serverSeed/clientSeed uretilir, commitment=SHA256(serverSeed).
  // Kullanici bir zar sirasini (nonce) dogrulayip taahhut<->tohum eslesmesini gorebilir;
  // degeri kurcalayinca eslesme bozulur (adilligin somut kaniti). Canli mac gerektirmez.
  const [seed, setSeed] = useState(() => {
    const fd = new FairDice()
    return { serverSeed: fd.serverSeed, clientSeed: fd.clientSeed, commitment: fd.commitment, rolls: 8 }
  })
  const [vServer, setVServer] = useState(seed.serverSeed)
  const [vClient, setVClient] = useState(seed.clientSeed)
  const [vNonce, setVNonce] = useState(0)
  const [vResult, setVResult] = useState<{ dice: number[]; match: boolean } | null>(null)

  function verifySeed() {
    const dice = verifyRoll(vServer.trim(), vClient.trim(), vNonce)
    const match = sha256Hex(vServer.trim()) === seed.commitment
    setVResult({ dice, match })
  }
  function regenSeed() {
    const fd = new FairDice()
    setSeed({ serverSeed: fd.serverSeed, clientSeed: fd.clientSeed, commitment: fd.commitment, rolls: 8 })
    setVServer(fd.serverSeed)
    setVClient(fd.clientSeed)
    setVNonce(0)
    setVResult(null)
  }

  // Unmount'ta bekleyen batch'i iptal et (setState-after-unmount onlenir).
  useEffect(() => () => void (runIdRef.current++), [])

  function effectiveCount(): number {
    if (customMode) {
      const n = Math.floor(Number(customStr))
      if (!Number.isFinite(n) || n <= 0) return 0
      return Math.min(MAX_ROLLS, n)
    }
    return count
  }

  function runTest() {
    const n = effectiveCount()
    if (n <= 0 || running) return
    const myId = ++runIdRef.current
    setRunning(true)
    setResult(null)
    setProgress(0)
    const counts = [0, 0, 0, 0, 0, 0]
    let done = 0
    const step = () => {
      if (runIdRef.current !== myId) return // iptal / yeniden baslatildi
      const chunk = Math.min(BATCH, n - done)
      for (let i = 0; i < chunk; i++) counts[secureDie() - 1]++ // GERCEK oyun zari
      done += chunk
      setProgress(Math.round((done / n) * 100))
      if (done < n) {
        setTimeout(step, 0)
      } else {
        setResult(summarize(counts))
        setRunning(false)
      }
    }
    setTimeout(step, 0)
  }

  const canRun = effectiveCount() > 0 && !running
  const expectedPctStr = nfPct.format(1 / 6)

  // Grafik olcegi: en yuksek yuzde veya beklenen, %15 tepe boslugu ile.
  const maxPct = result ? Math.max(...result.percentages, result.expectedPct) : result
  const scale = maxPct ? maxPct * 1.15 : 1
  const barH = (p: number) => `${scale ? (p / scale) * 100 : 0}%`
  const expBottom = result ? (result.expectedPct / scale) * 100 : 0

  return (
    <div className="fairp">
      {/* ==================== HERO ==================== */}
      <section className="fairp-hero">
        <h3 className="fairp-hero-title">
          <span aria-hidden="true">🎲</span> {t('fairp.hero.title')}
        </h3>
        <p className="fairp-hero-p">{t('fairp.hero.intro1')}</p>
        <p className="fairp-hero-p">{t('fairp.hero.intro2')}</p>
        <div className="fairp-quote">
          <Icon name="shield-check" size={22} aria-hidden="true" />
          <span>{t('fairp.hero.quote')}</span>
        </div>
      </section>

      {/* ==================== 1 · Zarlar Nasil Atiliyor ==================== */}
      <section className="fairp-card">
        <h4 className="fairp-card-title">
          <span aria-hidden="true">🔐</span> {t('fairp.s1.title')}
        </h4>
        <p>{t('fairp.s1.p1')}</p>
        <p>{t('fairp.s1.p2')}</p>
        <p>{t('fairp.s1.p3')}</p>
      </section>

      {/* ==================== 2 · Sonraki zari bilmek ==================== */}
      <section className="fairp-card">
        <h4 className="fairp-card-title">
          <span aria-hidden="true">🎯</span> {t('fairp.s2.title')}
        </h4>
        <p className="fairp-answer">{t('fairp.s2.no')}</p>
        <p>{t('fairp.s2.p1')}</p>
        <p>{t('fairp.s2.p2')}</p>
      </section>

      {/* ==================== 3 · Kayirma yok ==================== */}
      <section className="fairp-card">
        <h4 className="fairp-card-title">
          <span aria-hidden="true">⚖️</span> {t('fairp.s3.title')}
        </h4>
        <p className="fairp-answer">{t('fairp.s3.no')}</p>
        <p>{t('fairp.s3.lead')}</p>
        <ul className="fairp-list">
          {['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'].map((k) => (
            <li key={k}>
              <Icon name="x" size={14} aria-hidden="true" />
              {t(`fairp.s3.${k}`)}
            </li>
          ))}
        </ul>
        <div className="fairp-foot">
          <Icon name="check" size={16} aria-hidden="true" /> {t('fairp.s3.foot')}
        </div>
      </section>

      {/* ==================== 4 · Kendin kontrol et (GitHub) ==================== */}
      <section className="fairp-card">
        <h4 className="fairp-card-title">
          <span aria-hidden="true">👀</span> {t('fairp.s4.title')}
        </h4>
        <p>{t('fairp.s4.p1')}</p>
        <p>{t('fairp.s4.p2')}</p>
        <Button asChild variant="outline" className="fairp-gh">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Icon name="code" size={16} /> {t('fairp.s4.cta')}
          </a>
        </Button>
      </section>

      {/* ==================== 5 · Tohumlarla dogrulama (provably-fair deneme) ==================== */}
      <section className="fairp-card fairp-verify">
        <h4 className="fairp-card-title">
          <span aria-hidden="true">🔑</span> {t('fairp.verify.title')}
        </h4>
        <p className="fairp-test-sub">{t('fairp.verify.sub')}</p>

        <label className="fairp-vlabel">
          <span className="fairp-vlabel-head">
            <span>{t('fairp.verify.commitment')}</span>
            <span className="fairp-vtech">commitment</span>
          </span>
          <input value={seed.commitment} readOnly aria-readonly="true" />
        </label>
        <label className="fairp-vlabel">
          <span className="fairp-vlabel-head">
            <span>{t('fairp.verify.serverLabel')}</span>
            <span className="fairp-vtech">serverSeed</span>
          </span>
          <input value={vServer} onChange={(e) => setVServer(e.target.value)} />
        </label>
        <label className="fairp-vlabel">
          <span className="fairp-vlabel-head">
            <span>{t('fairp.verify.clientLabel')}</span>
            <span className="fairp-vtech">clientSeed</span>
          </span>
          <input value={vClient} onChange={(e) => setVClient(e.target.value)} />
        </label>
        <label className="fairp-vlabel">
          <span className="fairp-vlabel-head">
            <span>{t('fairp.verify.nonceLabel')}</span>
            <span className="fairp-vtech">nonce · 0…{Math.max(0, seed.rolls - 1)}</span>
          </span>
          <input
            type="number"
            min={0}
            value={vNonce}
            onChange={(e) => setVNonce(Math.max(0, Number(e.target.value)))}
          />
        </label>

        <div className="fairp-vactions">
          <Button variant="default" onClick={verifySeed}>
            <Icon name="shield-check" size={16} /> {t('fairp.verify.cta')}
          </Button>
          <Button variant="ghost" onClick={regenSeed}>
            <Icon name="refresh" size={16} /> {t('fairp.verify.regen')}
          </Button>
        </div>

        {vResult && (
          <div className={`fairp-dist ${vResult.match ? 'ok' : 'warn'}`}>
            <div className="fairp-dist-head">
              <Icon name={vResult.match ? 'shield-check' : 'warning-circle'} size={20} />
              <b>{vResult.match ? t('fairp.verify.okTitle') : t('fairp.verify.badTitle')}</b>
            </div>
            <p className="fairp-dist-desc">{vResult.match ? t('fairp.verify.okDesc') : t('fairp.verify.badDesc')}</p>
            <div className="fairp-vdice" aria-hidden="true">
              {vResult.dice.slice(0, vResult.dice.length === 4 ? 4 : 2).map((d, i) => (
                <Icon key={i} name={dieIcon(d)} size={34} />
              ))}
            </div>
          </div>
        )}

        <p className="fairp-note fairp-vnote">{t('fairp.verify.note')}</p>
      </section>

      {/* ==================== Teknik detaylar (accordion) ==================== */}
      <div className={`fairp-tech ${showTech ? 'open' : ''}`}>
        <button type="button" className="fairp-tech-toggle" onClick={() => setShowTech((v) => !v)} aria-expanded={showTech}>
          <Icon name="lock-key" size={16} />
          <span>{showTech ? t('fairp.tech.toggleHide') : t('fairp.tech.toggle')}</span>
          <Icon name="chevron" size={16} className="fairp-tech-chev" />
        </button>
        {showTech && <p className="fairp-tech-body">{t('fairp.tech.body')}</p>}
      </div>

      {/* ==================== TEST ALANI ==================== */}
      <section className="fairp-test">
        <h4 className="fairp-card-title">
          <span aria-hidden="true">🧪</span> {t('fairp.test.title')}
        </h4>
        <p className="fairp-test-sub">{t('fairp.test.sub')}</p>

        {/* Zar sayisi secimi */}
        <div className="fairp-test-controls">
          <span className="fairp-test-label">{t('fairp.test.countLabel')}</span>
          <div className="fairp-chips">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={!customMode && count === p ? 'fairp-chip active' : 'fairp-chip'}
                onClick={() => {
                  setCustomMode(false)
                  setCount(p)
                }}
                disabled={running}
              >
                {nfInt.format(p)}
              </button>
            ))}
            <button
              type="button"
              className={customMode ? 'fairp-chip active' : 'fairp-chip'}
              onClick={() => setCustomMode(true)}
              disabled={running}
            >
              {t('fairp.test.custom')}
            </button>
          </div>
          {customMode && (
            <input
              className="fairp-custom-input"
              type="number"
              min={1}
              max={MAX_ROLLS}
              value={customStr}
              onChange={(e) => setCustomStr(e.target.value)}
              placeholder={nfInt.format(5000)}
              disabled={running}
              aria-label={t('fairp.test.custom')}
            />
          )}
        </div>

        <Button variant="default" className="fairp-run" onClick={runTest} disabled={!canRun}>
          <Icon name={running ? 'refresh' : 'play'} size={18} className={running ? 'fairp-spin' : undefined} />
          {running ? `${t('fairp.test.running')} ${progress}%` : t('fairp.test.start')}
        </Button>

        {result && (
          <div className="fairp-results">
            {/* Grafik: 6 bar + beklenen %16,67 cizgisi */}
            <div className="fairp-chart" role="img" aria-label={t('fairp.test.title')}>
              <div className="fairp-chart-plot">
                <div className="fairp-chart-exp" style={{ bottom: `${expBottom}%` }}>
                  <span className="fairp-chart-exp-lbl">{t('fairp.test.expectedLine')}</span>
                </div>
                {result.counts.map((_, i) => (
                  <div className="fairp-bar-col" key={i}>
                    <div className="fairp-bar-val">{nfPct.format(result.percentages[i] / 100)}</div>
                    <div className="fairp-bar-track">
                      <div className="fairp-bar" style={{ height: barH(result.percentages[i]) }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="fairp-chart-axis">
                {[1, 2, 3, 4, 5, 6].map((f) => (
                  <span key={f} className="fairp-axis-face">
                    <Icon name={dieIcon(f)} size={22} />
                  </span>
                ))}
              </div>
            </div>

            {/* Yuze gore sayim tablosu */}
            <div className="fairp-table">
              {result.counts.map((c, i) => (
                <div className="fairp-trow" key={i}>
                  <span className="fairp-tface">
                    <Icon name={dieIcon(i + 1)} size={20} /> {i + 1}
                  </span>
                  <span className="fairp-tcount">
                    {nfInt.format(c)} {t('fairp.test.times')}
                  </span>
                  <span className="fairp-tpct">{nfPct.format(result.percentages[i] / 100)}</span>
                </div>
              ))}
            </div>

            {/* Ozet istatistikler */}
            <div className="fairp-stats">
              <div className="fairp-stat">
                <span className="fairp-stat-k">{t('fairp.test.stat.total')}</span>
                <span className="fairp-stat-v">{nfInt.format(result.total)}</span>
              </div>
              <div className="fairp-stat">
                <span className="fairp-stat-k">{t('fairp.test.stat.most')}</span>
                <span className="fairp-stat-v">{result.mostFace}</span>
              </div>
              <div className="fairp-stat">
                <span className="fairp-stat-k">{t('fairp.test.stat.least')}</span>
                <span className="fairp-stat-v">{result.leastFace}</span>
              </div>
              <div className="fairp-stat">
                <span className="fairp-stat-k">{t('fairp.test.stat.avg')}</span>
                <span className="fairp-stat-v">{nf1.format(result.average)}</span>
              </div>
              <div className="fairp-stat">
                <span className="fairp-stat-k">{t('fairp.test.stat.expected')}</span>
                <span className="fairp-stat-v">{expectedPctStr}</span>
              </div>
            </div>

            <p className="fairp-summary">{t('fairp.test.summary')}</p>
            <p className="fairp-note">{t('fairp.test.note')}</p>

            {/* Dagilim (Ki-Kare) testi — teknik gosterim gizli */}
            <div className={`fairp-dist ${result.anomalous ? 'warn' : 'ok'}`}>
              <div className="fairp-dist-head">
                <Icon name={result.anomalous ? 'warning-circle' : 'shield-check'} size={20} />
                <b>
                  {result.anomalous ? t('fairp.test.dist.anomaly') : t('fairp.test.dist.ok')}
                </b>
              </div>
              <p className="fairp-dist-desc">{t('fairp.test.dist.note')}</p>
              <p className="fairp-dist-caveat">
                {result.anomalous ? t('fairp.test.dist.caveat') : t('fairp.test.dist.okDesc')}
              </p>
              <button type="button" className="fairp-dist-toggle" onClick={() => setShowDetail((v) => !v)} aria-expanded={showDetail}>
                <Icon name="chevron" size={14} className={showDetail ? 'fairp-tech-chev open' : 'fairp-tech-chev'} />
                {t('fairp.test.dist.detail')}
              </button>
              {showDetail && (
                <div className="fairp-dist-detail">
                  <span>
                    {t('fairp.test.dist.chi')}: <code>{nf1.format(result.chi2)}</code>
                  </span>
                  <span>
                    {t('fairp.test.dist.p')}: <code>{result.pValue < 0.0001 ? '< 0.0001' : result.pValue.toFixed(4)}</code>
                  </span>
                </div>
              )}
            </div>

            <Button variant="outline" className="fairp-again" onClick={runTest} disabled={running}>
              <Icon name="refresh" size={16} /> {t('fairp.test.again')}
            </Button>
          </div>
        )}

        {/* Bilgi kutusu */}
        <div className="fairp-infobox">
          <Icon name="info" size={18} aria-hidden="true" />
          <span>{t('fairp.test.infobox')}</span>
        </div>
      </section>
    </div>
  )
}
