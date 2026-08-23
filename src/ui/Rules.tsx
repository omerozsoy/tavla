import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'

interface Props {
  onClose: () => void
}

interface Section {
  h: string
  p: string[]
}

// Kural rehberi icerigi dile gore (i18n sozlugunu sismemek icin burada tutulur).
// TR + EN; diger diller EN'e duser.
const CONTENT: Record<'tr' | 'en', { title: string; intro: string; sections: Section[] }> = {
  tr: {
    title: 'Tavla Nasıl Oynanır?',
    intro:
      'Tavla, iki oyuncunun 15’er taşla oynadığı, hem şans hem stratejinin belirleyici olduğu klasik bir masa oyunudur. Amaç tüm taşlarını kendi evine getirip tahtadan ilk toplayan oyuncu olmaktır.',
    sections: [
      {
        h: 'Amaç',
        p: [
          'Tahtada 24 üçgen (hane) vardır. Her oyuncu taşlarını saat yönünde/tersine kendi ev bölgesine (son çeyrek) taşır.',
          'Tüm 15 taşını kendi evine getiren oyuncu taşları tahtadan “toplamaya” (bear off) başlar. Tüm taşlarını ilk toplayan oyunu kazanır.',
        ],
      },
      {
        h: 'Kurulum',
        p: [
          'Başlangıç dizilişi standarttır: her oyuncunun 6-noktasında 5, 8-noktasında 3, 13-noktasında 5 ve 24-noktasında 2 taşı bulunur.',
          'TavlaTv’de tahta otomatik kurulur; sadece oynamaya odaklan.',
        ],
      },
      {
        h: 'Zar ve Hareket',
        p: [
          'Sıra sende iki zar atarsın. Her zar bir taşın kaç hane ilerleyeceğini gösterir.',
          'İki farklı taşı ayrı ayrı oynayabilir ya da tek taşı iki zar toplamı kadar (ara nokta uygunsa) ilerletebilirsin.',
          'Çift (aynı zar) atarsan o değeri dört kez oynarsın.',
          'Rakibin iki veya daha fazla taşının olduğu haneye giremezsin (kapalı hane).',
        ],
      },
      {
        h: 'Vurma ve Girme',
        p: [
          'Rakibin tek taşı olan haneye gelirsen o taşı “vurursun”; taş bara gider.',
          'Barda taşın varken başka hamle yapamazsın; önce rakibin ev bölgesinden tahtaya girmen gerekir.',
          'Giriş için attığın zarın gösterdiği hane açık (rakibin 2+ taşı yok) olmalıdır.',
        ],
      },
      {
        h: 'Toplama (Bear Off)',
        p: [
          '15 taşının tamamı kendi ev bölgendeyse taş toplamaya başlarsın.',
          'Attığın zar değerine karşılık gelen haneden taş toplarsın. O hanede taş yoksa daha ileri haneden oynayabilir/toplayabilirsin.',
          'Toplama sırasında vurulursan taşın bara gider ve tekrar girmen gerekir.',
        ],
      },
      {
        h: 'Kazanma: Tekli, Mars (Gammon), Backgammon',
        p: [
          'Rakip en az bir taş topladıysa: normal (1 puan) galibiyet.',
          'Rakip hiç taş toplayamadıysa: Mars/Gammon (2 puan).',
          'Rakip hiç toplayamadığı gibi barda veya senin evinde taşı kaldıysa: Backgammon (3 puan).',
        ],
      },
      {
        h: 'Küp (Doubling Cube)',
        p: [
          'Küp, oyunun puan değerini yükseltmek için kullanılır. Sıran gelince ve zar atmadan önce rakibe küp teklif edebilirsin (2 kat).',
          'Rakip kabul ederse (take) oyun iki katına çıkar ve küp ona geçer; reddederse (drop) mevcut puanı sana verip el biter.',
          'Crawford kuralı: biri maçı kazanmaya 1 puan kala, sonraki tek elde küp kullanılamaz.',
          'TavlaTv’de oyun içi “Küp danışmanı”, kazanma yüzdene göre katla/kabul et/kaç önerisi verir.',
        ],
      },
      {
        h: 'PR ve Puan (TavlaTv)',
        p: [
          'PR (Performans Reytingi): hamlelerinin en iyi oynanışa ne kadar yakın olduğunu ölçer; düşük PR daha iyidir.',
          'Rating (Elo): maç sonuçlarına göre değişen beceri puanın. Kayıtta başlangıç seviyeni sen seçersin.',
          'Maç sonunda “Analiz” ile en kötü hamlelerini ve küp kararlarını görebilirsin.',
        ],
      },
    ],
  },
  en: {
    title: 'How to Play Backgammon',
    intro:
      'Backgammon is a classic two-player board game combining luck and strategy. Each player has 15 checkers and the goal is to be the first to bring all of them home and bear them off the board.',
    sections: [
      {
        h: 'Objective',
        p: [
          'The board has 24 triangles (points). Each player moves their checkers toward their own home board (the final quadrant).',
          'Once all 15 checkers are home, you start bearing them off. The first to bear off all checkers wins.',
        ],
      },
      {
        h: 'Setup',
        p: [
          'Standard starting position: 5 checkers on your 6-point, 3 on the 8-point, 5 on the 13-point and 2 on the 24-point.',
          'On TavlaTv the board is set up automatically — just focus on playing.',
        ],
      },
      {
        h: 'Dice and Movement',
        p: [
          'On your turn you roll two dice. Each die shows how many points one checker may advance.',
          'You may move two different checkers, or a single checker by the sum of both dice if the intermediate point is open.',
          'Rolling doubles lets you play that value four times.',
          'You cannot land on a point held by two or more enemy checkers (a made point).',
        ],
      },
      {
        h: 'Hitting and Entering',
        p: [
          'Landing on a point with a single enemy checker “hits” it; that checker goes to the bar.',
          'While you have a checker on the bar you cannot make other moves — you must first re-enter in the opponent’s home board.',
          'To enter, the die value must correspond to an open point (not blocked by 2+ enemy checkers).',
        ],
      },
      {
        h: 'Bearing Off',
        p: [
          'Once all 15 checkers are in your home board you may start bearing off.',
          'You bear off a checker from the point matching your die. If that point is empty you may play/bear off from a higher point.',
          'If you get hit while bearing off, that checker returns to the bar and must re-enter.',
        ],
      },
      {
        h: 'Winning: Single, Gammon, Backgammon',
        p: [
          'If the opponent has borne off at least one checker: a normal win (1 point).',
          'If the opponent has borne off none: a Gammon (2 points).',
          'If the opponent has borne off none and still has a checker on the bar or in your home: a Backgammon (3 points).',
        ],
      },
      {
        h: 'The Doubling Cube',
        p: [
          'The cube raises the stakes. On your turn, before rolling, you may offer the cube (doubling the value).',
          'If the opponent takes, the game value doubles and the cube passes to them; if they drop, they concede the current value.',
          'Crawford rule: when a player is 1 point from winning the match, the cube is disabled for the very next game.',
          'TavlaTv’s in-game “cube advisor” suggests double/take/drop based on your winning chances.',
        ],
      },
      {
        h: 'PR and Rating (TavlaTv)',
        p: [
          'PR (Performance Rating): how close your moves are to optimal play — lower is better.',
          'Rating (Elo): your skill score that changes with match results. You pick your starting level at sign-up.',
          'After a match, use “Analysis” to review your worst moves and cube decisions.',
        ],
      },
    ],
  },
}

export default function Rules({ onClose }: Props) {
  const { lang } = useT()
  useEscape(onClose)
  const c = lang === 'tr' ? CONTENT.tr : CONTENT.en

  return (
    <div className="register-overlay modal page" onClick={onClose}>
      <div className="register-card rules-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="book" size={20} /> {c.title}
        </h2>
        <p className="rules-intro">{c.intro}</p>
        {c.sections.map((s, i) => (
          <section key={i} className="rules-section">
            <h3>{s.h}</h3>
            {s.p.map((para, j) => (
              <p key={j}>{para}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
