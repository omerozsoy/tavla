import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'

interface Props {
  onClose: () => void
}

interface Section {
  h: string
  p: string[]
}

// Kural rehberi icerigi dile gore (i18n sozlugunu sismemek icin burada tutulur).
// 5 dil: tr, en, es, de, fr. Bilinmeyen dil -> en.
type RulesContent = { title: string; intro: string; sections: Section[] }
const CONTENT: Record<'tr' | 'en' | 'es' | 'de' | 'fr', RulesContent> = {
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
  es: {
    title: 'Cómo jugar al Backgammon',
    intro:
      'El backgammon es un clásico juego de mesa para dos jugadores que combina suerte y estrategia. Cada jugador tiene 15 fichas y el objetivo es ser el primero en llevarlas todas a casa y retirarlas del tablero.',
    sections: [
      {
        h: 'Objetivo',
        p: [
          'El tablero tiene 24 triángulos (puntos). Cada jugador mueve sus fichas hacia su propio cuadrante de casa (el último cuadrante).',
          'Cuando las 15 fichas están en casa, empiezas a retirarlas. El primero en retirar todas sus fichas gana.',
        ],
      },
      {
        h: 'Preparación',
        p: [
          'Posición inicial estándar: 5 fichas en tu punto 6, 3 en el punto 8, 5 en el punto 13 y 2 en el punto 24.',
          'En TavlaTv el tablero se coloca automáticamente: solo concéntrate en jugar.',
        ],
      },
      {
        h: 'Dados y movimiento',
        p: [
          'En tu turno lanzas dos dados. Cada dado indica cuántos puntos puede avanzar una ficha.',
          'Puedes mover dos fichas distintas, o una sola ficha por la suma de ambos dados si el punto intermedio está libre.',
          'Si sacas dobles, juegas ese valor cuatro veces.',
          'No puedes caer en un punto ocupado por dos o más fichas rivales (punto cerrado).',
        ],
      },
      {
        h: 'Golpear y entrar',
        p: [
          'Caer en un punto con una sola ficha rival la “golpea”; esa ficha va a la barra.',
          'Mientras tengas una ficha en la barra no puedes hacer otros movimientos: primero debes reentrar en el cuadrante de casa del rival.',
          'Para entrar, el valor del dado debe corresponder a un punto abierto (no bloqueado por 2+ fichas rivales).',
        ],
      },
      {
        h: 'Retirar fichas (Bear Off)',
        p: [
          'Cuando las 15 fichas están en tu cuadrante de casa, puedes empezar a retirarlas.',
          'Retiras una ficha del punto que coincide con tu dado. Si ese punto está vacío, puedes jugar/retirar desde un punto superior.',
          'Si te golpean mientras retiras, esa ficha vuelve a la barra y debe reentrar.',
        ],
      },
      {
        h: 'Ganar: sencilla, Gammon, Backgammon',
        p: [
          'Si el rival ha retirado al menos una ficha: victoria normal (1 punto).',
          'Si el rival no ha retirado ninguna: Gammon (2 puntos).',
          'Si el rival no ha retirado ninguna y aún tiene una ficha en la barra o en tu casa: Backgammon (3 puntos).',
        ],
      },
      {
        h: 'El cubo de doblar',
        p: [
          'El cubo sube la apuesta. En tu turno, antes de lanzar, puedes ofrecer el cubo (doblando el valor).',
          'Si el rival acepta, el valor se duplica y el cubo pasa a él; si rechaza, concede el valor actual.',
          'Regla de Crawford: cuando a un jugador le falta 1 punto para ganar el match, el cubo se desactiva en la siguiente partida.',
          'El “asesor del cubo” de TavlaTv sugiere doblar/aceptar/rechazar según tus probabilidades de ganar.',
        ],
      },
      {
        h: 'PR y Rating (TavlaTv)',
        p: [
          'PR (Rating de rendimiento): mide cuán cerca están tus jugadas del juego óptimo; cuanto más bajo, mejor.',
          'Rating (Elo): tu puntuación de habilidad que cambia con los resultados. Eliges tu nivel inicial al registrarte.',
          'Tras un match, usa “Análisis” para revisar tus peores jugadas y decisiones de cubo.',
        ],
      },
    ],
  },
  de: {
    title: 'Backgammon spielen',
    intro:
      'Backgammon ist ein klassisches Brettspiel für zwei Personen, das Glück und Strategie verbindet. Jeder Spieler hat 15 Steine; Ziel ist es, als Erster alle Steine ins eigene Heimfeld zu bringen und vom Brett abzutragen.',
    sections: [
      {
        h: 'Ziel',
        p: [
          'Das Brett hat 24 Dreiecke (Punkte). Jeder Spieler zieht seine Steine in Richtung des eigenen Heimfelds (letztes Viertel).',
          'Sind alle 15 Steine im Heimfeld, beginnst du abzutragen. Wer zuerst alle Steine abträgt, gewinnt.',
        ],
      },
      {
        h: 'Aufbau',
        p: [
          'Standard-Startaufstellung: 5 Steine auf deinem 6-Punkt, 3 auf dem 8-Punkt, 5 auf dem 13-Punkt und 2 auf dem 24-Punkt.',
          'Bei TavlaTv wird das Brett automatisch aufgebaut – konzentriere dich nur aufs Spielen.',
        ],
      },
      {
        h: 'Würfel und Zug',
        p: [
          'In deinem Zug wirfst du zwei Würfel. Jeder Würfel gibt an, wie viele Punkte ein Stein vorrücken darf.',
          'Du kannst zwei verschiedene Steine ziehen oder einen Stein um die Summe beider Würfel, wenn der Zwischenpunkt frei ist.',
          'Bei einem Pasch spielst du diesen Wert viermal.',
          'Du darfst nicht auf einen Punkt ziehen, der von zwei oder mehr gegnerischen Steinen besetzt ist (gemachter Punkt).',
        ],
      },
      {
        h: 'Schlagen und Einwürfeln',
        p: [
          'Ziehst du auf einen Punkt mit einem einzelnen gegnerischen Stein, „schlägst“ du ihn; dieser Stein kommt auf die Bar.',
          'Solange ein Stein auf der Bar ist, kannst du keine anderen Züge machen – du musst zuerst im Heimfeld des Gegners wieder eintreten.',
          'Zum Eintreten muss der Würfelwert einem offenen Punkt entsprechen (nicht durch 2+ gegnerische Steine blockiert).',
        ],
      },
      {
        h: 'Abtragen (Bear Off)',
        p: [
          'Sind alle 15 Steine in deinem Heimfeld, darfst du mit dem Abtragen beginnen.',
          'Du trägst einen Stein von dem Punkt ab, der deinem Würfel entspricht. Ist dieser Punkt leer, darfst du von einem höheren Punkt ziehen/abtragen.',
          'Wirst du beim Abtragen geschlagen, kommt der Stein auf die Bar und muss erneut eintreten.',
        ],
      },
      {
        h: 'Gewinn: Einfach, Gammon, Backgammon',
        p: [
          'Hat der Gegner mindestens einen Stein abgetragen: normaler Sieg (1 Punkt).',
          'Hat der Gegner keinen Stein abgetragen: Gammon (2 Punkte).',
          'Hat der Gegner keinen abgetragen und noch einen Stein auf der Bar oder in deinem Heimfeld: Backgammon (3 Punkte).',
        ],
      },
      {
        h: 'Der Dopplerwürfel',
        p: [
          'Der Dopplerwürfel erhöht den Einsatz. In deinem Zug, vor dem Würfeln, kannst du das Doppel anbieten (Wert verdoppeln).',
          'Nimmt der Gegner an, verdoppelt sich der Wert und der Würfel geht an ihn; lehnt er ab, gibt er den aktuellen Wert auf.',
          'Crawford-Regel: Fehlt einem Spieler 1 Punkt zum Matchgewinn, ist der Dopplerwürfel im nächsten Spiel deaktiviert.',
          'Der „Dopplerwürfel-Berater“ von TavlaTv empfiehlt Doppeln/Annehmen/Ablehnen je nach Gewinnchance.',
        ],
      },
      {
        h: 'PR und Rating (TavlaTv)',
        p: [
          'PR (Performance-Rating): misst, wie nah deine Züge am optimalen Spiel sind; niedriger ist besser.',
          'Rating (Elo): deine Spielstärke, die sich mit den Ergebnissen ändert. Dein Startniveau wählst du bei der Anmeldung.',
          'Nutze nach einem Match die „Analyse“, um deine schlechtesten Züge und Dopplerentscheidungen zu prüfen.',
        ],
      },
    ],
  },
  fr: {
    title: 'Comment jouer au Backgammon',
    intro:
      'Le backgammon est un jeu de société classique à deux joueurs mêlant chance et stratégie. Chaque joueur a 15 pions et le but est d’être le premier à tous les ramener dans son jan intérieur puis à les sortir du plateau.',
    sections: [
      {
        h: 'But du jeu',
        p: [
          'Le plateau compte 24 triangles (flèches). Chaque joueur déplace ses pions vers son propre jan intérieur (dernier quart).',
          'Une fois les 15 pions à la maison, tu commences à les sortir. Le premier à sortir tous ses pions gagne.',
        ],
      },
      {
        h: 'Mise en place',
        p: [
          'Position de départ standard : 5 pions sur ta flèche 6, 3 sur la flèche 8, 5 sur la flèche 13 et 2 sur la flèche 24.',
          'Sur TavlaTv le plateau est installé automatiquement — concentre-toi seulement sur le jeu.',
        ],
      },
      {
        h: 'Dés et déplacement',
        p: [
          'À ton tour tu lances deux dés. Chaque dé indique de combien de flèches un pion peut avancer.',
          'Tu peux déplacer deux pions différents, ou un seul pion de la somme des deux dés si la flèche intermédiaire est libre.',
          'Un double te permet de jouer cette valeur quatre fois.',
          'Tu ne peux pas atterrir sur une flèche occupée par deux pions adverses ou plus (flèche fermée).',
        ],
      },
      {
        h: 'Frapper et rentrer',
        p: [
          'Atterrir sur une flèche avec un seul pion adverse le « frappe » ; ce pion va sur la barre.',
          'Tant que tu as un pion sur la barre, tu ne peux faire aucun autre coup — tu dois d’abord rentrer dans le jan intérieur adverse.',
          'Pour rentrer, la valeur du dé doit correspondre à une flèche ouverte (non bloquée par 2 pions adverses ou plus).',
        ],
      },
      {
        h: 'Sortir les pions (Bear Off)',
        p: [
          'Une fois tes 15 pions dans ton jan intérieur, tu peux commencer à les sortir.',
          'Tu sors un pion de la flèche correspondant à ton dé. Si cette flèche est vide, tu peux jouer/sortir depuis une flèche supérieure.',
          'Si tu es frappé pendant la sortie, ce pion retourne sur la barre et doit rentrer à nouveau.',
        ],
      },
      {
        h: 'Gagner : simple, Gammon, Backgammon',
        p: [
          'Si l’adversaire a sorti au moins un pion : victoire normale (1 point).',
          'Si l’adversaire n’en a sorti aucun : Gammon (2 points).',
          'Si l’adversaire n’en a sorti aucun et a encore un pion sur la barre ou dans ton jan : Backgammon (3 points).',
        ],
      },
      {
        h: 'Le videau (doubling cube)',
        p: [
          'Le videau augmente l’enjeu. À ton tour, avant de lancer, tu peux proposer le videau (doubler la valeur).',
          'Si l’adversaire accepte, la valeur double et le videau lui passe ; s’il refuse, il concède la valeur actuelle.',
          'Règle de Crawford : quand un joueur est à 1 point de gagner le match, le videau est désactivé pour la partie suivante.',
          'Le « conseiller de videau » de TavlaTv suggère doubler/accepter/refuser selon tes chances de gain.',
        ],
      },
      {
        h: 'PR et Rating (TavlaTv)',
        p: [
          'PR (Performance Rating) : mesure à quel point tes coups sont proches du jeu optimal ; plus c’est bas, mieux c’est.',
          'Rating (Elo) : ton score de niveau qui évolue avec les résultats. Tu choisis ton niveau de départ à l’inscription.',
          'Après un match, utilise « Analyse » pour revoir tes pires coups et décisions de videau.',
        ],
      },
    ],
  },
}

export default function Rules({ onClose }: Props) {
  const { lang, t } = useT()
  useEscape(onClose)
  const c = CONTENT[lang] ?? CONTENT.en

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card rules-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
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
