import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'

interface Props {
  onClose: () => void
}

interface Section {
  q: string
  a: string[]
}

// Ders icerigi dile gore (uzun metin i18n anahtari yerine burada). Diger diller EN'e duser.
const CONTENT: Record<string, { title: string; sections: Section[] }> = {
  tr: {
    title: 'Tavla Nasıl Oynanır?',
    sections: [
      {
        q: 'Amaç',
        a: [
          'Tavla iki kişilik bir yarış oyunudur. Amacın 15 taşını kendi ana bölgende toplayıp tahtadan dışarı (bear off) çıkarmak.',
          'Bütün taşlarını rakibinden önce toplayıp çıkaran oyunu kazanır.',
        ],
      },
      {
        q: 'Kurulum',
        a: [
          'Her oyuncunun 15 taşı vardır. Başlangıç dizilişi: 24. noktada 2, 13. noktada 5, 8. noktada 3, 6. noktada 5 taş (kendi yönünden).',
          'Taşlar her zaman rakibin bölgesinden kendi ana bölgene doğru, yani sayısı azalan yönde ilerler.',
        ],
      },
      {
        q: 'Zar ve Hareket',
        a: [
          'Sıran gelince iki zar atarsın. Her zarı ayrı bir taşı ilerletmek için kullanırsın (örn. 3-5: bir taş 3, bir taş 5 ya da aynı taş önce 3 sonra 5).',
          'Çift atarsan (örn. 4-4) o zarı dört kez oynarsın.',
          'Bir noktaya yalnızca boşsa, kendi taşın varsa ya da rakibin tek taşı varsa gidebilirsin.',
        ],
      },
      {
        q: 'Vurmak ve Kırık Taş',
        a: [
          'Rakibin tek taşı (blot) olan bir noktaya gelirsen o taşı vurursun; taş ortadaki bara gider.',
          'Barda taşın varsa başka hamle yapamazsın; önce rakibin ana bölgesinden zarla içeri girmen gerekir.',
        ],
      },
      {
        q: 'Toplama (Bear Off)',
        a: [
          '15 taşının tamamı kendi ana bölgende (1–6 noktaları) toplandığında taşları dışarı çıkarmaya başlayabilirsin.',
          'Attığın zar sayısına denk gelen noktadaki taşı çıkarırsın. Tüm taşlarını ilk çıkaran kazanır.',
        ],
      },
      {
        q: 'Küp (Doubling Cube)',
        a: [
          'Küp, oyunun değerini iki katına çıkarmak için kullanılır. Önde olduğunu düşündüğünde küpü teklif edersin.',
          'Rakip kabul ederse oyun 2 kat değerinde oynanır ve küp ona geçer; reddederse mevcut değeri kaybeder.',
          'Gammon (rakip hiç taş çıkaramadı) 2 kat, backgammon (üstelik barda/senin bölgende taşı var) 3 kat sayılır.',
        ],
      },
      {
        q: 'Temel Strateji',
        a: [
          'Kendi ana bölgende noktalar kur (2+ taş) — rakibin girişini zorlaştırır.',
          'Tek taş (blot) bırakmamaya çalış; vurulmak seni geriye atar.',
          'Öndeysen yarış (koşu) oyununa geç; geride kaldıysan rakibi tutmak için arka noktaları koru (back game).',
          'Analiz panelini ve Pozisyon Analizörünü kullanarak en iyi hamleleri öğren.',
        ],
      },
    ],
  },
  en: {
    title: 'How to Play Backgammon',
    sections: [
      {
        q: 'Goal',
        a: [
          'Backgammon is a two-player racing game. Your goal is to bring all 15 of your checkers into your home board and bear them off the board.',
          'The first player to bear off all their checkers wins.',
        ],
      },
      {
        q: 'Setup',
        a: [
          'Each player has 15 checkers. Standard setup: 2 on the 24-point, 5 on the 13-point, 3 on the 8-point, 5 on the 6-point (from your direction).',
          'Checkers always move from the opponent’s side toward your home board — toward lower-numbered points.',
        ],
      },
      {
        q: 'Dice and Movement',
        a: [
          'On your turn you roll two dice and move a checker for each die (e.g. 3-5: one checker 3 and another 5, or the same checker 3 then 5).',
          'Rolling doubles (e.g. 4-4) lets you play that number four times.',
          'You may land on a point only if it is empty, has your own checkers, or has a single opponent checker.',
        ],
      },
      {
        q: 'Hitting and the Bar',
        a: [
          'Landing on a point with a lone opponent checker (a blot) hits it; that checker goes to the bar in the middle.',
          'If you have a checker on the bar, you must re-enter it in the opponent’s home board before making any other move.',
        ],
      },
      {
        q: 'Bearing Off',
        a: [
          'Once all 15 of your checkers are in your home board (points 1–6), you can start bearing them off.',
          'A die removes a checker from the matching point. The first to bear off all checkers wins.',
        ],
      },
      {
        q: 'The Doubling Cube',
        a: [
          'The cube doubles the stake. When you think you are ahead, you may offer the cube.',
          'If your opponent takes, the game is worth double and they own the cube; if they drop, they lose the current value.',
          'A gammon (opponent bore off none) counts double; a backgammon (they also have a checker on the bar or in your home) counts triple.',
        ],
      },
      {
        q: 'Basic Strategy',
        a: [
          'Make points (2+ checkers) in your home board to make re-entry hard for your opponent.',
          'Avoid leaving blots; being hit sends you back.',
          'When ahead, switch to a running race; when behind, hold back points to contain your opponent (a back game).',
          'Use the Analysis panel and the Position Analyzer to learn the best moves.',
        ],
      },
    ],
  },
}

export default function Lessons({ onClose }: Props) {
  const { lang } = useT()
  useEscape(onClose)
  const c = CONTENT[lang] ?? CONTENT.en
  const [open, setOpen] = useState(0)

  return (
    <div className="register-overlay modal page">
      <div className="register-card lessons-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="book" size={20} /> {c.title}</h2>
        <div className="lessons-list">
          {c.sections.map((s, i) => (
            <div key={i} className={`lesson-item ${open === i ? 'open' : ''}`}>
              <button className="lesson-q" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{s.q}</span>
                <span className="lesson-caret">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && (
                <div className="lesson-a">
                  {s.a.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
