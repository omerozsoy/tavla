/**
 * PrInfo — Bilgi › "Tavlada PR Nedir?" bilgilendirici infografik (/bilgi/pr-nedir).
 *
 * Tavla oynayan ama PR kavramını tanımayan birine PR'nin neyi ölçtüğünü, nasıl
 * yorumlandığını ve maç sonucundan neden farklı olduğunu anlatır. Dikey, mobil-öncelikli
 * düzen; ana vurgu rengi #A83A2B (--pr). İçerik iki dilli (tr + en) bu dosyada tutulur —
 * dev i18n.tsx'i şişirmemek için; diğer diller İngilizce'ye düşer (useT fallback).
 *
 * Doğruluk: PR'yi yüzdeye çevirmez, kaynaksız seviye sınırı uydurmaz, "şanstan tamamen
 * bağımsız" demez (karar kalitesini ölçer, zarı puanlamaz). Değerler yalnız karşılaştırma örneği.
 */

import { Icon } from './Icon'
import { useT } from '../i18n'
import './prInfo.css'

interface PrExample {
  pr: number
  note: string
  best?: boolean
}

interface Content {
  heroTitle: string
  heroSub: string
  s2Title: string
  s2P: string[]
  s2Emph: string
  s3Title: string
  s3Lead: string
  s3Steps: string[]
  s3Flow: string
  s3Note: string
  s4Title: string
  s4P: string[]
  s4Emph: string
  s5Title: string
  s5Lead: string
  s5Examples: PrExample[]
  s5LegendBetter: string
  s5LegendWorse: string
  s5Caveat: string
  s6Title: string
  s6A: string
  s6ALabel: string
  s6B: string
  s6BLabel: string
  s6Desc: string
  s6Emph: string
  lost: string
  won: string
  s7Title: string
  s7Items: string[]
  s7Box: string
  s8Title: string
  s8P: string[]
  s8Emph: string
  s9Title: string
  s9P: string
  s9Note: string
  s10Title: string
  s10Items: string[]
  bigTop: string
  bigBottom: string
  footnote: string
}

const TR: Content = {
  heroTitle: 'TAVLADA PR NEDİR?',
  heroSub: 'Sonuç tabelası kimin kazandığını, PR ise ne kadar iyi oynadığını gösterir.',
  s2Title: 'PR Ne Anlama Gelir?',
  s2P: [
    'PR, İngilizce “Performance Rating” (Performans Değeri) ifadesinin kısaltmasıdır.',
    'Verdiğin kararların, analiz motorunun en iyi bulduğu kararlardan ortalama ne kadar uzaklaştığını gösterir.',
  ],
  s2Emph: 'PR ne kadar düşükse, oyun kaliten o kadar yüksektir.',
  s3Title: 'Nasıl Hesaplanır?',
  s3Lead: 'Analiz motoru maçtaki kararlarını tek tek inceler:',
  s3Steps: [
    'Pulları nasıl oynadın?',
    'Küpü ne zaman teklif ettin ya da etmedin?',
    'Gelen küpü kabul mü ettin, reddettin mi?',
  ],
  s3Flow: 'Kararların incelenir → Hataların maliyeti hesaplanır → Ortalama hata PR’ye dönüşür.',
  s3Note: 'Küp kullanılmayan oyunlarda küp kararları değerlendirilmez.',
  s4Title: 'Yalnızca Hata Sayısı Değildir',
  s4P: [
    'Her hata aynı büyüklükte değildir.',
    'Küçük bir hata az kayba, büyük bir hata çok daha fazla kayba yol açar. Bu yüzden yalnızca “Kaç hata yaptım?” sorusu yeterli değildir.',
  ],
  s4Emph: 'PR’de hataların sayısı kadar büyüklüğü ve değerlendirilen karar sayısı da önemlidir.',
  s5Title: 'Düşük PR = Daha İyi Kararlar',
  s5Lead: 'Aşağıdaki değerler yalnızca karşılaştırma örneğidir — resmî bir seviye ya da unvan değildir.',
  s5Examples: [
    { pr: 3, note: '7 ve 12 PR’ye göre karar başına daha az hata kaybı.', best: true },
    { pr: 7, note: '3 PR’den fazla, 12 PR’den az hata kaybı.' },
    { pr: 12, note: 'Bu üç örnek içinde karar başına en fazla hata kaybı.' },
  ],
  s5LegendBetter: 'daha iyi',
  s5LegendWorse: 'daha fazla hata',
  s5Caveat: 'Kısa çubuk = karar başına daha az hata kaybı = daha iyi oyun.',
  s6Title: 'İyi Oynayıp Kaybedebilirsin',
  s6A: '3 PR',
  s6ALabel: 'Oyuncu A',
  s6B: '9 PR',
  s6BLabel: 'Oyuncu B',
  s6Desc: 'Bu maçta A, analiz motoruna göre daha iyi kararlar vermiştir. Ancak zarların da etkisiyle maçı B kazanmış olabilir.',
  s6Emph: 'Bir maçı kazanmak, mutlaka daha iyi oynadığın anlamına gelmez.',
  lost: 'Maçı kaybetti',
  won: 'Maçı kazandı',
  s7Title: 'PR Ne Değildir?',
  s7Items: [
    'Kazanma yüzdesi değildir.',
    'Şans puanı değildir.',
    'Yaptığın hataların doğrudan sayısı değildir.',
    'Galibiyet ve mağlubiyetle değişen sıralama puanıyla aynı şey değildir.',
  ],
  s7Box: '5 PR, %5 hata yaptığın ya da %95 doğru oynadığın anlamına gelmez.',
  s8Title: 'Tek Maç Seni Tanımlamaz',
  s8P: [
    'Bir maçın PR’si, yalnızca o maçtaki performansını gösterir.',
    'Maçın uzunluğu, karşılaştığın pozisyonlar ve kararların zorluğu nedeniyle PR değerin maçtan maça değişir. Genel seviyeni anlamak için çok sayıda maçtaki performansına bakmalısın.',
  ],
  s8Emph: 'Tek maçlık rekora değil, uzun vadeli gelişimine odaklan.',
  s9Title: '0 PR Ne Demektir?',
  s9P: '0 PR, analizde hesaba katılan kararlarda motorun en iyi bulduğu seçeneklere göre hata kaybı tespit edilmediği anlamına gelir.',
  s9Note: 'Bu, oyuncunun her zaman kusursuz oynadığı ya da sonraki maçı mutlaka kazanacağı anlamına gelmez.',
  s10Title: 'PR’ni Nasıl Düşürebilirsin?',
  s10Items: [
    'Maçlarını analiz et.',
    'Önce en büyük kayba yol açan hatalarını incele.',
    'Aynı pozisyonda daha iyi hamlenin neden daha iyi olduğunu öğren.',
    'Tekrarladığın hata türlerini belirle.',
    'Sonucu bildikten sonra değil, karar anındaki bilgilerle düşün.',
  ],
  bigTop: 'Her maçı kazanamazsın. Ama daha iyi kararlar vermeyi öğrenebilirsin.',
  bigBottom: 'Daha düşük PR, daha kaliteli oyun.',
  footnote: 'Not: Farklı analiz motorları ve farklı analiz ayarları PR sonucunu bir miktar etkileyebilir.',
}

const EN: Content = {
  heroTitle: 'WHAT IS PR IN BACKGAMMON?',
  heroSub: 'The scoreboard shows who won; PR shows how well you played.',
  s2Title: 'What Does PR Mean?',
  s2P: [
    'PR stands for “Performance Rating”.',
    'It shows, on average, how far your decisions were from the choices the analysis engine considered best.',
  ],
  s2Emph: 'The lower your PR, the higher your play quality.',
  s3Title: 'How Is It Calculated?',
  s3Lead: 'The analysis engine reviews your decisions one by one:',
  s3Steps: [
    'How did you move your checkers?',
    'When did you offer the cube — or not?',
    'Did you take or drop the cube you were offered?',
  ],
  s3Flow: 'Your decisions are reviewed → the cost of each error is measured → the average error becomes your PR.',
  s3Note: 'In games where the cube is not used, cube decisions are not evaluated.',
  s4Title: 'It Is Not Just the Number of Errors',
  s4P: [
    'Not every error is the same size.',
    'A small error costs a little; a big error costs much more. So “How many errors did I make?” is not enough on its own.',
  ],
  s4Emph: 'In PR, the size of your errors — and how many decisions were evaluated — matters as much as their count.',
  s5Title: 'Lower PR = Better Decisions',
  s5Lead: 'The values below are only a comparison example — not an official level or title.',
  s5Examples: [
    { pr: 3, note: 'Less error loss per decision than 7 and 12 PR.', best: true },
    { pr: 7, note: 'More than 3 PR, less than 12 PR in error loss.' },
    { pr: 12, note: 'The most error loss per decision among these three.' },
  ],
  s5LegendBetter: 'better',
  s5LegendWorse: 'more error',
  s5Caveat: 'Shorter bar = less error loss per decision = better play.',
  s6Title: 'You Can Play Well and Still Lose',
  s6A: '3 PR',
  s6ALabel: 'Player A',
  s6B: '9 PR',
  s6BLabel: 'Player B',
  s6Desc: 'In this match, A made the better decisions according to the engine. Yet, with the dice also playing their part, B may have won the match.',
  s6Emph: 'Winning a match does not necessarily mean you played better.',
  lost: 'Lost the match',
  won: 'Won the match',
  s7Title: 'What PR Is Not',
  s7Items: [
    'It is not a win percentage.',
    'It is not a luck score.',
    'It is not the direct count of your errors.',
    'It is not the same as a ranking that moves up and down with wins and losses.',
  ],
  s7Box: '5 PR does not mean you made 5% errors or played 95% correctly.',
  s8Title: 'A Single Match Does Not Define You',
  s8P: [
    'A match PR shows only your performance in that match.',
    'Match length, the positions you faced and the difficulty of your decisions all make your PR vary from match to match. To understand your overall level, look at your performance across many matches.',
  ],
  s8Emph: 'Focus on long-term improvement, not a single-match record.',
  s9Title: 'What Does 0 PR Mean?',
  s9P: '0 PR means that, among the decisions included in the analysis, no error loss was found compared to the engine’s best choices.',
  s9Note: 'It does not mean the player always plays flawlessly or will certainly win the next match.',
  s10Title: 'How Can You Lower Your PR?',
  s10Items: [
    'Analyze your matches.',
    'Start with the errors that caused the biggest loss.',
    'Learn why the better move in that position is better.',
    'Identify the error types you keep repeating.',
    'Think with the information available at decision time — not after you know the result.',
  ],
  bigTop: 'You can’t win every match. But you can learn to make better decisions.',
  bigBottom: 'Lower PR, higher-quality play.',
  footnote: 'Note: Different analysis engines and settings can affect the PR result somewhat.',
}

// En yüksek örnek PR'yi ölçek tavanı al (çubuk genişliği oransal).
function barPct(pr: number, max: number) {
  return `${Math.max(8, (pr / max) * 100)}%`
}

export default function PrInfo() {
  const { lang } = useT()
  const c = lang === 'en' ? EN : lang === 'tr' ? TR : EN
  const maxPr = Math.max(...c.s5Examples.map((e) => e.pr))

  return (
    <div className="prinfo">
      {/* ===== HERO ===== */}
      <section className="prinfo-hero">
        <div className="prinfo-hero-badge" aria-hidden="true">
          <Icon name="target" size={26} />
        </div>
        <h3 className="prinfo-hero-title">{c.heroTitle}</h3>
        <p className="prinfo-hero-sub">{c.heroSub}</p>
      </section>

      {/* ===== 2 · PR ne anlama gelir ===== */}
      <section className="prinfo-card">
        <h4 className="prinfo-card-title">
          <Icon name="info" size={20} /> {c.s2Title}
        </h4>
        {c.s2P.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="prinfo-emph">
          <Icon name="check" size={18} /> {c.s2Emph}
        </div>
      </section>

      {/* ===== 3 · Nasıl hesaplanır ===== */}
      <section className="prinfo-card">
        <h4 className="prinfo-card-title">
          <Icon name="chart-line" size={20} /> {c.s3Title}
        </h4>
        <p>{c.s3Lead}</p>
        <ul className="prinfo-check">
          {c.s3Steps.map((s, i) => (
            <li key={i}>
              <Icon name="dice" size={16} /> {s}
            </li>
          ))}
        </ul>
        <div className="prinfo-flow">
          {c.s3Flow.split('→').map((part, i, arr) => (
            <span key={i} className="prinfo-flow-step">
              {part.trim()}
              {i < arr.length - 1 && <span className="prinfo-flow-arrow" aria-hidden="true">→</span>}
            </span>
          ))}
        </div>
        <p className="prinfo-note">
          <Icon name="info" size={14} /> {c.s3Note}
        </p>
      </section>

      {/* ===== 4 · Yalnızca hata sayısı değil ===== */}
      <section className="prinfo-card">
        <h4 className="prinfo-card-title">
          <Icon name="alert" size={20} /> {c.s4Title}
        </h4>
        {c.s4P.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="prinfo-emph">
          <Icon name="check" size={18} /> {c.s4Emph}
        </div>
      </section>

      {/* ===== 5 · Düşük PR = daha iyi (karşılaştırma) ===== */}
      <section className="prinfo-card">
        <h4 className="prinfo-card-title">
          <Icon name="chart" size={20} /> {c.s5Title}
        </h4>
        <p>{c.s5Lead}</p>
        <div className="prinfo-legend" aria-hidden="true">
          <span className="prinfo-legend-good">← {c.s5LegendBetter}</span>
          <span className="prinfo-legend-bad">{c.s5LegendWorse} →</span>
        </div>
        <div className="prinfo-compare">
          {c.s5Examples.map((e) => (
            <div key={e.pr} className={e.best ? 'prinfo-row best' : 'prinfo-row'}>
              <span className="prinfo-row-pr">
                {e.pr} PR {e.best && <Icon name="trophy" size={15} />}
              </span>
              <span className="prinfo-row-track">
                <span className="prinfo-row-bar" style={{ width: barPct(e.pr, maxPr) }} />
              </span>
              <span className="prinfo-row-note">{e.note}</span>
            </div>
          ))}
        </div>
        <p className="prinfo-note">
          <Icon name="info" size={14} /> {c.s5Caveat}
        </p>
      </section>

      {/* ===== 6 · İyi oynayıp kaybedebilirsin ===== */}
      <section className="prinfo-card">
        <h4 className="prinfo-card-title">
          <Icon name="dice" size={20} /> {c.s6Title}
        </h4>
        <div className="prinfo-versus">
          <div className="prinfo-player win-better">
            <span className="prinfo-player-name">{c.s6ALabel}</span>
            <span className="prinfo-player-pr">{c.s6A}</span>
            <span className="prinfo-player-out lost">
              <Icon name="x" size={14} /> {c.lost}
            </span>
          </div>
          <span className="prinfo-vs" aria-hidden="true">VS</span>
          <div className="prinfo-player">
            <span className="prinfo-player-name">{c.s6BLabel}</span>
            <span className="prinfo-player-pr">{c.s6B}</span>
            <span className="prinfo-player-out won">
              <Icon name="trophy" size={14} /> {c.won}
            </span>
          </div>
        </div>
        <p>{c.s6Desc}</p>
        <div className="prinfo-emph">
          <Icon name="warning-circle" size={18} /> {c.s6Emph}
        </div>
      </section>

      {/* ===== 7 · PR ne değildir ===== */}
      <section className="prinfo-card">
        <h4 className="prinfo-card-title">
          <Icon name="x" size={20} /> {c.s7Title}
        </h4>
        <ul className="prinfo-nots">
          {c.s7Items.map((s, i) => (
            <li key={i}>
              <Icon name="x" size={14} /> {s}
            </li>
          ))}
        </ul>
        <div className="prinfo-box">
          <Icon name="info" size={18} />
          <span>{c.s7Box}</span>
        </div>
      </section>

      {/* ===== 8 · Tek maç seni tanımlamaz ===== */}
      <section className="prinfo-card">
        <h4 className="prinfo-card-title">
          <Icon name="chart-line" size={20} /> {c.s8Title}
        </h4>
        {c.s8P.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="prinfo-emph">
          <Icon name="arrow-up" size={18} /> {c.s8Emph}
        </div>
      </section>

      {/* ===== 9 · 0 PR ne demektir ===== */}
      <section className="prinfo-card prinfo-zero">
        <h4 className="prinfo-card-title">
          <span className="prinfo-zero-badge" aria-hidden="true">0</span> {c.s9Title}
        </h4>
        <p>{c.s9P}</p>
        <p className="prinfo-note">
          <Icon name="info" size={14} /> {c.s9Note}
        </p>
      </section>

      {/* ===== 10 · Nasıl düşürürsün ===== */}
      <section className="prinfo-card">
        <h4 className="prinfo-card-title">
          <Icon name="target" size={20} /> {c.s10Title}
        </h4>
        <ol className="prinfo-steps">
          {c.s10Items.map((s, i) => (
            <li key={i}>
              <span className="prinfo-step-n">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== BÜYÜK MESAJ ===== */}
      <section className="prinfo-big">
        <p className="prinfo-big-top">{c.bigTop}</p>
        <p className="prinfo-big-bottom">{c.bigBottom}</p>
      </section>

      <p className="prinfo-footnote">{c.footnote}</p>
    </div>
  )
}
