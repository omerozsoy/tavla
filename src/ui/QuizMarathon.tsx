import { useEffect, useRef, useState, type ReactNode } from 'react'
import './quizMarathon.css'
import { LessonView } from './TrainingView'
import Loading from './Loading'
import { MARATHON_POOL, CUBE_POOL, questionId, questionPoints, openingToQuestion, type Question } from './trainingCurriculum'
import { quizLeaderboard, submitQuizScore, getOpeningCounts, getOpeningPage, type QuizLeaderRow } from '../api'
import { DIFF_BANDS, DIFF_BAND_TR, type DiffBand } from './difficultyPositions'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'

// Seri bonusu: her 3. doğru cevap (3, 6, 9…) 2 KAT puan; diğerleri normal.
// nextCorrect = bu doğru cevaptan SONRAKİ toplam doğru sayısı (ilk yanlış oyunu bitirdiği için = seri).
export function streakMultiplier(nextCorrect: number): number {
  return nextCorrect > 0 && nextCorrect % 3 === 0 ? 2 : 1
}

// Havuzdan seen'de OLMAYAN rastgele soru. Tur içi tekrar yok; havuz tükenince null (tur tamam).
export function pickNext(pool: Question[], seen: Set<string>): Question | null {
  const avail = pool.filter((q) => !seen.has(questionId(q)))
  if (!avail.length) return null
  return avail[Math.floor(Math.random() * avail.length)]
}

// Maraton modu: Karışık/Açılış-band = PUL (hamle) yarışması; 'cube' = KÜP yarışması (ayrı).
type Mode = 'mixed' | 'cube' | DiffBand
const isOpeningMode = (m: Mode | null): m is DiffBand => m != null && m !== 'mixed' && m !== 'cube'
// Açılış band -> puan: zorluk tier'ıyla birebir (questionPoints [10,20,25,50,100]).
const BAND_POINTS: Record<DiffBand, number> = { cok_kolay: 10, kolay: 20, orta: 25, zor: 50, cok_zor: 100 }
const CUBE_POINTS = 25 // küp kararı başına puan
const OPENING_BATCH = 50 // band maratonunda DB'den çekilen rastgele sayfa boyu (84k'yı yüklemeden)

/**
 * Soru Maratonu: sınırsız streak-quiz. Her doğru cevap zorluğa göre puan (10/20/25/50/100); her 3.
 * doğru cevap 2 KAT. Üstte anlık skor, İLK YANLIŞTA biter. Game-over: anonim tabela + baştan başla.
 * LessonView'i (fixed tek-soru + onAnswered) per-soru remount (key=step) ile sürer.
 */
export function QuizMarathon({
  onClose,
  nickname,
  tab = 'play',
  onTab,
}: {
  onClose: () => void
  nickname?: string | null
  tab?: Tab
  onTab?: (t: Tab) => void
}) {
  const [phase, setPhase] = useState<'playing' | 'over'>('playing')
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [bestMult, setBestMult] = useState(1)
  const [step, setStep] = useState(0)
  // Tur sayacı: LessonView key'i step+round → ilk soruda elenip "Tekrar Dene" deyince step zaten 0
  // olduğundan key değişmiyor, LessonView remount olmuyor ve eski pozisyonda takılı kalıyordu.
  const [round, setRound] = useState(0)
  const seenRef = useRef<Set<string>>(new Set())
  // mode=null -> mod seçim ekranı (Karışık / Açılış-band). Seçilince havuz yüklenir, oyun başlar.
  const [mode, setMode] = useState<Mode | null>(null)
  const [loading, setLoading] = useState(false)
  const openingPoolRef = useRef<Question[]>([]) // açılış modunda büyüyen lazy havuz
  const countsRef = useRef<Record<string, number> | null>(null) // band -> toplam (bir kez çekilir)
  const [current, setCurrent] = useState<Question | null>(null)
  const [answered, setAnswered] = useState<null | 'correct' | 'wrong'>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [gain, setGain] = useState(0) // son cevabın puanı (her cevaptan sonra skor pop-up'ında)
  const [lastMult, setLastMult] = useState(1) // son cevabın seri çarpanı (2 = bu cevap 2 kat)

  const activePool = () => (mode === 'cube' ? CUBE_POOL : isOpeningMode(mode) ? openingPoolRef.current : MARATHON_POOL)

  // Açılış band'inden DB'den rastgele bir sayfa çek, havuza (dedup) ekle. 84k'yı yüklemez.
  const loadOpeningBatch = async (band: DiffBand) => {
    if (!countsRef.current) countsRef.current = await getOpeningCounts().catch(() => ({}))
    const total = countsRef.current?.[band] ?? 0
    if (!total) return
    const pages = Math.max(1, Math.ceil(total / OPENING_BATCH))
    const page = 1 + Math.floor(Math.random() * pages)
    const res = await getOpeningPage(band, page, OPENING_BATCH).catch(() => ({ items: [] }))
    const have = new Set(openingPoolRef.current.map((q) => questionId(q)))
    for (const it of res.items) {
      const q = openingToQuestion(it)
      if (q && !have.has(questionId(q))) {
        openingPoolRef.current.push(q)
        have.add(questionId(q))
      }
    }
  }

  // reset = mod SEÇİM ekranına dön ("Baştan Başla" / "Tekrar Dene"): kullanıcı modu yeniden seçer.
  const reset = () => {
    seenRef.current = new Set()
    openingPoolRef.current = []
    setMode(null)
    setScore(0)
    setCorrectCount(0)
    setBestMult(1)
    setLastMult(1)
    setStep(0)
    setRound((r) => r + 1)
    setCurrent(null)
    setAnswered(null)
    setModalOpen(false)
    setPhase('playing')
  }

  // Mod seç -> havuzu kur, ilk soruyu çek, oyunu başlat.
  const startMode = async (m: Mode) => {
    seenRef.current = new Set()
    openingPoolRef.current = []
    setScore(0)
    setCorrectCount(0)
    setBestMult(1)
    setLastMult(1)
    setStep(0)
    setRound((r) => r + 1)
    setAnswered(null)
    setModalOpen(false)
    setPhase('playing')
    if (m === 'mixed') {
      setMode('mixed')
      setCurrent(pickNext(MARATHON_POOL, new Set()))
      return
    }
    if (m === 'cube') {
      setMode('cube')
      setCurrent(pickNext(CUBE_POOL, new Set()))
      return
    }
    setLoading(true)
    await loadOpeningBatch(m)
    setLoading(false)
    setMode(m)
    setCurrent(pickNext(openingPoolRef.current, new Set()))
  }

  const handleAnswered = (correct: boolean, q: Question, scoreable: boolean) => {
    if (correct) {
      const nextCorrect = correctCount + 1
      // İpucu (veya tekrar) kullanıldıysa puan YOK; ama doğru olduğu için oyun devam eder.
      const mult = scoreable ? streakMultiplier(nextCorrect) : 1 // her 3. doğruda 2 kat
      // Puan: küp=sabit, açılış=band, karışık=board-zorluğu (questionPoints).
      const base = mode === 'cube' ? CUBE_POINTS : isOpeningMode(mode) ? BAND_POINTS[mode] : questionPoints(q)
      const pts = scoreable ? base * mult : 0
      setScore((s) => s + pts)
      setCorrectCount(nextCorrect)
      setBestMult((m) => Math.max(m, mult))
      setGain(pts)
      setLastMult(mult)
      setAnswered('correct')
    } else {
      setGain(0)
      setAnswered('wrong')
      setPhase('over') // ilk yanlış = yarışma biter; tahtada doğru hamle görünür, skor "Skorunu Gör" ile modalda
    }
  }

  const next = async () => {
    if (!current) return
    seenRef.current.add(questionId(current))
    // Açılış modunda havuz azaldıysa DB'den bir batch daha çek (seri uzarsa tükenmesin).
    if (isOpeningMode(mode)) {
      const unseen = openingPoolRef.current.filter((q) => !seenRef.current.has(questionId(q)))
      if (unseen.length < 5) await loadOpeningBatch(mode)
    }
    const n = pickNext(activePool(), seenRef.current)
    if (!n) {
      setPhase('over') // havuz bitti: tur tamamlandı
      setModalOpen(true)
      return
    }
    setCurrent(n)
    setStep((s) => s + 1)
    setAnswered(null)
  }

  const tabs = <QmTabs tab={tab} onTab={(t) => onTab?.(t)} />

  return (
    <>
    {tab === 'records' && <RecordsPage tabs={tabs} onClose={onClose} />}
    {tab === 'rules' && <RulesPage tabs={tabs} onClose={onClose} />}
    {/* Oyun diğer sekmelerdeyken de mount kalır (gizli) → "Oyna"ya dönünce aynı sorudan devam. */}
    <div className="qm-wrap" hidden={tab !== 'play'}>
      {mode === null && !loading && <QmModeSelect tabs={tabs} counts={countsRef.current} onPick={(m) => void startMode(m)} onClose={onClose} />}
      {loading && (
        <div className="qm-loading" role="status">
          <Loading size={44} />
          <span>Açılış havuzu hazırlanıyor…</span>
        </div>
      )}
      {mode !== null && current && (
        <LessonView
          key={`${round}-${step}`}
          lessonId={`maraton-${round}-${step}`}
          fixed={{ title: 'Soru Maratonu', questions: [current] }}
          onBack={onClose}
          onAnswered={handleAnswered}
          sideTabs={tabs}
          chip={
            <span className="qm-chip" title={`${correctCount} doğru`}>
              Skor <b><CountUp value={score} /></b>
              {score > 0 && <span key={score} className="qm-chip-flash" aria-hidden="true" />}
            </span>
          }
          centerInfo={
            answered && (
              <div key={`${round}-${step}-${answered}`} className={`qm-pop ${answered}`} role="status">
                <span className="qm-pop-gain">{answered === 'correct' ? (gain > 0 ? `+${gain}` : 'Doğru') : 'Yanlış'}</span>
                {answered === 'correct' && gain === 0 && <span className="qm-pop-tag muted">İpucu — puan yok</span>}
                {answered === 'correct' && lastMult === 2 && <span className="qm-pop-tag">🔥 2 KAT!</span>}
                <span className="qm-pop-total">Skor <CountUp value={score} from={score - gain} /></span>
              </div>
            )
          }
          centerAction={
            phase === 'over'
              ? score > 0
                ? { label: 'Skorunu Gör', onClick: () => setModalOpen(true) }
                : { label: 'Tekrar Dene', onClick: reset } // 0 puan: gösterecek skor yok, direkt yeni tur
              : answered === 'correct'
                ? { label: 'Sonraki Soru →', onClick: () => void next() }
                : null
          }
        />
      )}
      {/* Modal kapansa da GameOver mount kalır (gönderilen sıra/durum kaybolmaz → çift gönderim yok). */}
      {phase === 'over' && (
        <GameOver
          open={modalOpen}
          score={score}
          correctCount={correctCount}
          bestMult={bestMult}
          accountNick={nickname}
          quizMode={mode === 'cube' ? 'cube' : 'checker'}
          onRestart={reset}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
    </>
  )
}

type Tab = 'play' | 'records' | 'rules'

/** Mod seçim ekranı: Karışık Maraton (tüm müfredat) ya da Açılış Maratonu (zorluk bandı seç, 84k DB). */
function QmModeSelect({
  tabs,
  counts,
  onPick,
  onClose,
}: {
  tabs: ReactNode
  counts: Record<string, number> | null
  onPick: (m: Mode) => void
  onClose: () => void
}) {
  const [cnt, setCnt] = useState<Record<string, number> | null>(counts)
  useEffect(() => {
    if (!cnt) getOpeningCounts().then(setCnt).catch(() => setCnt({}))
  }, [cnt])
  return (
    <div className="register-card qm-mode">
      <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
        <Icon name="x" size={16} />
      </Button>
      <h2><Icon name="target" size={20} /> Soru Maratonu</h2>
      {tabs}
      <div className="qm-mode-opts">
        <div className="qm-mode-sep">🎯 Pul (Hamle) Maratonu</div>
        <button className="qm-mode-btn" onClick={() => onPick('mixed')}>
          <span className="qm-mode-title">Karışık Maraton</span>
          <span className="qm-mode-sub">Tüm konulardan karışık — ilk yanlışta biter</span>
        </button>
        <div className="qm-mode-sep qm-mode-sep-sub">Açılış bandı seç (zorluk)</div>
        {DIFF_BANDS.map((b) => (
          <button key={b} className="qm-mode-btn" onClick={() => onPick(b)}>
            <span className="qm-mode-title">{DIFF_BAND_TR[b]}</span>
            <span className="qm-mode-sub">{cnt ? `${(cnt[b] ?? 0).toLocaleString('tr')} pozisyon · ${BAND_POINTS[b]} puan` : `${BAND_POINTS[b]} puan`}</span>
          </button>
        ))}
        <div className="qm-mode-sep">🎲 Küp Maratonu</div>
        <button className="qm-mode-btn" onClick={() => onPick('cube')}>
          <span className="qm-mode-title">Küp Kararları</span>
          <span className="qm-mode-sub">Katla / Al-Bırak — gnubg doğrulamalı · {CUBE_POINTS} puan</span>
        </button>
      </div>
    </div>
  )
}

/** Sayı önceki değerden yeniye ease-out ile sayar (skor animasyonu). Reduced-motion'da anında. */
function CountUp({ value, duration = 600, from: start = 0 }: { value: number; duration?: number; from?: number }) {
  const [shown, setShown] = useState(start)
  const fromRef = useRef(start)
  useEffect(() => {
    const from = fromRef.current
    fromRef.current = value
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || from === value) {
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(from + (value - from) * e))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{shown}</>
}

// Tek tip, üstte, tam genişlik segmented sekme çubuğu (Oyna / Rekorlar / Puanlama Sistemi).
function QmTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon?: 'trophy' | 'target' }[] = [
    { id: 'play', label: 'Oyna' },
    { id: 'records', label: 'Rekorlar', icon: 'trophy' },
    { id: 'rules', label: 'Puanlama Sistemi', icon: 'target' },
  ]
  return (
    <div className="qm-tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={tab === it.id}
          className={`qm-tab${tab === it.id ? ' on' : ''}`}
          onClick={() => onTab(it.id)}
        >
          {it.icon && <Icon name={it.icon} size={15} />} {it.label}
        </button>
      ))}
    </div>
  )
}

/** Rekorlar SAYFASI (/gunun-pozisyonu/rekorlar): tüm zamanların en yüksek maraton skorları. */
function RecordsPage({ tabs, onClose }: { tabs: ReactNode; onClose: () => void }) {
  const [recMode, setRecMode] = useState<'checker' | 'cube'>('checker')
  const [board, setBoard] = useState<QuizLeaderRow[] | null>(null)
  useEffect(() => {
    setBoard(null)
    quizLeaderboard(100, recMode)
      .then(setBoard)
      .catch(() => setBoard([]))
  }, [recMode])
  const medal = (n: number) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : n)
  return (
    <div className="register-card qm-mode qm-records-page">
      <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
        <Icon name="x" size={16} />
      </Button>
      <h2><Icon name="target" size={20} /> Soru Maratonu</h2>
      {tabs}
      <div className="qm-rec-modes">
        <button type="button" className={`qm-rec-mode${recMode === 'checker' ? ' on' : ''}`} onClick={() => setRecMode('checker')}>🎯 Pul</button>
        <button type="button" className={`qm-rec-mode${recMode === 'cube' ? ' on' : ''}`} onClick={() => setRecMode('cube')}>🎲 Küp</button>
      </div>
      {board == null ? (
        <div className="qm-board-empty">Yükleniyor…</div>
      ) : board.length === 0 ? (
        <div className="qm-board-empty">Henüz rekor yok — ilk sen ol!</div>
      ) : (
        <div className="qm-rec-list">
          <div className="qm-rec-row qm-rec-head">
            <span>#</span>
            <span>Oyuncu</span>
            <span>Doğru</span>
            <span>Skor</span>
          </div>
          {board.map((r) => (
            <div
              key={r.rank}
              className={`qm-rec-row${r.rank <= 3 ? ` top top${r.rank}` : ''}`}
              style={{ animationDelay: `${Math.min(r.rank, 25) * 35}ms` }}
            >
              <span className="qm-rec-rank">{medal(r.rank)}</span>
              <span className="qm-rec-nick">{r.nickname}</span>
              <span className="qm-rec-cnt">{r.correct_count}</span>
              <span className="qm-rec-score"><CountUp value={r.score} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Puanlama Sistemi SAYFASI (/soru-maratonu/kurallar): puan tablosu + seri bonusu + kurallar. */
function RulesPage({ tabs, onClose }: { tabs: ReactNode; onClose: () => void }) {
  const rows: { name: string; pts: number }[] = [
    { name: 'Çok Kolay', pts: 10 },
    { name: 'Kolay', pts: 20 },
    { name: 'Orta', pts: 25 },
    { name: 'Zor', pts: 50 },
    { name: 'Çok Zor', pts: 100 },
  ]
  return (
    <div className="register-card qm-mode qm-rules-page">
      <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
        <Icon name="x" size={16} />
      </Button>
      <h2><Icon name="target" size={20} /> Soru Maratonu</h2>
      {tabs}

      <p className="qm-rules-intro">Her doğru cevap, sorunun zorluğuna göre puan kazandırır:</p>
      <div className="qm-rules-table">
        {rows.map((r) => (
          <div key={r.name} className="qm-rules-row">
            <span className="qm-rules-name">{r.name}</span>
            <span className="qm-rules-dots" aria-hidden="true" />
            <span className="qm-rules-pts">{r.pts}<small>puan</small></span>
          </div>
        ))}
      </div>

      <div className="qm-rules-bonus">
        <div className="qm-rules-bonus-badge">🔥 2 KAT</div>
        <div className="qm-rules-bonus-text">
          <b>Seri bonusu:</b> Arka arkaya her <b>3. doğru cevabında</b> o sorunun puanı <b>2 katına</b> çıkar!
        </div>
      </div>

      <ul className="qm-rules-list">
        <li>Zar atılır, en iyi hamleyi oynarsan soruyu <b>bilirsin</b>.</li>
        <li><b>İlk yanlışta</b> maraton biter — ne kadar uzarsa skorun o kadar yükselir.</li>
        <li><b>İpucu kullanırsan</b> o sorudan <b>puan alamazsın</b> (ama doğruysa oyun devam eder).</li>
        <li>Skorun oyun bitince <b>otomatik</b> olarak Rekorlar tabelasına yazılır.</li>
        <li>Her oyuncu tabelada yalnız <b>en yüksek</b> skoruyla yer alır.</li>
      </ul>
    </div>
  )
}

function GameOver({
  open,
  score,
  correctCount,
  bestMult,
  accountNick,
  quizMode,
  onRestart,
  onClose,
}: {
  open: boolean
  score: number
  correctCount: number
  bestMult: number
  accountNick?: string | null // giriş yapmışsa hesabın takma adı: sorulmaz (sunucu da hesaptakini yazar)
  quizMode: 'checker' | 'cube' // pul / küp yarışması (ayrı tabela)
  onRestart: () => void
  onClose: () => void
}) {
  const [rank, setRank] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [board, setBoard] = useState<QuizLeaderRow[] | null>(null)

  useEffect(() => {
    quizLeaderboard(20, quizMode)
      .then(setBoard)
      .catch(() => setBoard([]))
  }, [quizMode])

  // Oyun bitince skor SORMADAN otomatik tabelaya yazılır (giriş yapmışsa hesap adı, misafir "Oyuncu").
  // GameOver tur başına bir kez mount olur (Baştan Başla → phase playing → unmount) → tek gönderim.
  const sentRef = useRef(false)
  useEffect(() => {
    if (sentRef.current || score <= 0) return
    sentRef.current = true
    void submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (submitting || rank != null) return
    setSubmitting(true)
    try {
      const res = await submitQuizScore((accountNick || '').trim(), score, correctCount, quizMode)
      setRank(res.rank)
      quizLeaderboard(20, quizMode)
        .then(setBoard)
        .catch(() => {})
    } catch {
      /* best-effort: tabela yazılamadı */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="qm-over" role="dialog" aria-modal="true" hidden={!open} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="qm-over-card">
        <button className="qm-exit" onClick={onClose} aria-label="Kapat" title="Tahtaya dön">✕</button>
        <div className="qm-over-score"><CountUp value={score} duration={1200} /></div>
        <div className="qm-over-sub">
          {correctCount} doğru · en iyi çarpan ×{bestMult}
        </div>

        {rank != null ? (
          <div className="qm-rank">Rekor tabelasındaki sıran: <b>#{rank}</b></div>
        ) : submitting ? (
          <div className="qm-rank">Kaydediliyor…</div>
        ) : null}

        <div className="qm-board">
          <div className="qm-board-title">🏆 {quizMode === 'cube' ? 'Küp' : 'Pul'} Skor Tabelası</div>
          {board == null ? (
            <div className="qm-board-empty">Yükleniyor…</div>
          ) : board.length === 0 ? (
            <div className="qm-board-empty">Henüz skor yok — ilk sen ol!</div>
          ) : (
            <ol className="qm-board-list">
              {board.map((r) => (
                <li key={r.rank} className={rank === r.rank ? 'qm-me' : ''}>
                  <span className="qm-br-rank">{r.rank}</span>
                  <span className="qm-br-nick">{r.nickname}</span>
                  <span className="qm-br-score">{r.score}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <button className="bgx-btn green qm-restart" onClick={onRestart}>Baştan Başla</button>
      </div>
    </div>
  )
}
