import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'

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
  es: {
    title: 'Cómo jugar al Backgammon',
    sections: [
      {
        q: 'Objetivo',
        a: [
          'El backgammon es un juego de carrera para dos. Tu objetivo es reunir tus 15 fichas en tu jan interior y retirarlas del tablero (bear off).',
          'El primero en retirar todas sus fichas gana.',
        ],
      },
      {
        q: 'Preparación',
        a: [
          'Cada jugador tiene 15 fichas. Posición inicial: 2 en el punto 24, 5 en el 13, 3 en el 8 y 5 en el 6 (según tu dirección).',
          'Las fichas siempre avanzan desde el lado del rival hacia tu jan interior, es decir, hacia los puntos de numeración menor.',
        ],
      },
      {
        q: 'Dados y movimiento',
        a: [
          'En tu turno lanzas dos dados y mueves una ficha por cada dado (p. ej. 3-5: una ficha 3 y otra 5, o la misma ficha 3 y luego 5).',
          'Si sacas dobles (p. ej. 4-4), juegas ese número cuatro veces.',
          'Solo puedes caer en un punto si está vacío, tiene fichas tuyas o tiene una sola ficha rival.',
        ],
      },
      {
        q: 'Golpear y la barra',
        a: [
          'Caer en un punto con una ficha rival sola (un blot) la golpea; esa ficha va a la barra en el centro.',
          'Si tienes una ficha en la barra, debes reentrarla en el jan interior del rival antes de hacer cualquier otro movimiento.',
        ],
      },
      {
        q: 'Retirar fichas (Bear Off)',
        a: [
          'Cuando tus 15 fichas están en tu jan interior (puntos 1–6), puedes empezar a retirarlas.',
          'Un dado retira una ficha del punto correspondiente. El primero en retirarlas todas gana.',
        ],
      },
      {
        q: 'El cubo de doblar',
        a: [
          'El cubo duplica la apuesta. Cuando creas que vas por delante, puedes ofrecer el cubo.',
          'Si el rival acepta, la partida vale el doble y él posee el cubo; si rechaza, pierde el valor actual.',
          'Un gammon (el rival no retiró ninguna) cuenta doble; un backgammon (además tiene una ficha en la barra o en tu jan) cuenta triple.',
        ],
      },
      {
        q: 'Estrategia básica',
        a: [
          'Haz puntos (2+ fichas) en tu jan interior para dificultar la reentrada del rival.',
          'Evita dejar blots; ser golpeado te retrasa.',
          'Cuando vas por delante, pasa a una carrera; cuando vas por detrás, mantén puntos atrás para contener al rival (back game).',
          'Usa el panel de Análisis y el Analizador de Posiciones para aprender las mejores jugadas.',
        ],
      },
    ],
  },
  de: {
    title: 'Backgammon spielen',
    sections: [
      {
        q: 'Ziel',
        a: [
          'Backgammon ist ein Wettlaufspiel für zwei. Dein Ziel ist es, alle 15 Steine in dein Heimfeld zu bringen und vom Brett abzutragen (Bear Off).',
          'Wer zuerst alle Steine abträgt, gewinnt.',
        ],
      },
      {
        q: 'Aufbau',
        a: [
          'Jeder Spieler hat 15 Steine. Startaufstellung: 2 auf dem 24-Punkt, 5 auf dem 13-Punkt, 3 auf dem 8-Punkt, 5 auf dem 6-Punkt (aus deiner Richtung).',
          'Steine ziehen immer von der Seite des Gegners in Richtung deines Heimfelds – zu den niedriger nummerierten Punkten.',
        ],
      },
      {
        q: 'Würfel und Zug',
        a: [
          'In deinem Zug wirfst du zwei Würfel und ziehst je Würfel einen Stein (z. B. 3-5: ein Stein 3 und ein anderer 5, oder derselbe Stein 3 dann 5).',
          'Bei einem Pasch (z. B. 4-4) spielst du diese Zahl viermal.',
          'Du darfst nur auf einen Punkt ziehen, der leer ist, eigene Steine oder einen einzelnen gegnerischen Stein hat.',
        ],
      },
      {
        q: 'Schlagen und die Bar',
        a: [
          'Ziehst du auf einen Punkt mit einem einzelnen gegnerischen Stein (Blot), schlägst du ihn; dieser Stein kommt auf die Bar in der Mitte.',
          'Hast du einen Stein auf der Bar, musst du ihn im Heimfeld des Gegners wieder einwürfeln, bevor du andere Züge machst.',
        ],
      },
      {
        q: 'Abtragen (Bear Off)',
        a: [
          'Sind alle 15 Steine in deinem Heimfeld (Punkte 1–6), kannst du mit dem Abtragen beginnen.',
          'Ein Würfel trägt einen Stein vom passenden Punkt ab. Wer zuerst alle abträgt, gewinnt.',
        ],
      },
      {
        q: 'Der Dopplerwürfel',
        a: [
          'Der Dopplerwürfel verdoppelt den Einsatz. Wenn du glaubst, vorn zu liegen, kannst du das Doppel anbieten.',
          'Nimmt der Gegner an, zählt das Spiel doppelt und er besitzt den Würfel; lehnt er ab, verliert er den aktuellen Wert.',
          'Ein Gammon (Gegner hat keinen abgetragen) zählt doppelt; ein Backgammon (zudem ein Stein auf der Bar oder in deinem Heimfeld) zählt dreifach.',
        ],
      },
      {
        q: 'Grundstrategie',
        a: [
          'Mache Punkte (2+ Steine) in deinem Heimfeld, um dem Gegner die Rückkehr zu erschweren.',
          'Vermeide Blots; geschlagen zu werden wirft dich zurück.',
          'Liegst du vorn, wechsle in einen Wettlauf; liegst du zurück, halte hintere Punkte, um den Gegner zu binden (Back Game).',
          'Nutze das Analyse-Panel und den Positions-Analysator, um die besten Züge zu lernen.',
        ],
      },
    ],
  },
  fr: {
    title: 'Comment jouer au Backgammon',
    sections: [
      {
        q: 'But du jeu',
        a: [
          'Le backgammon est un jeu de course à deux. Ton but est de rassembler tes 15 pions dans ton jan intérieur puis de les sortir du plateau (bear off).',
          'Le premier à sortir tous ses pions gagne.',
        ],
      },
      {
        q: 'Mise en place',
        a: [
          'Chaque joueur a 15 pions. Position de départ : 2 sur la flèche 24, 5 sur la 13, 3 sur la 8 et 5 sur la 6 (selon ta direction).',
          'Les pions avancent toujours du côté de l’adversaire vers ton jan intérieur, c’est-à-dire vers les flèches de numéro inférieur.',
        ],
      },
      {
        q: 'Dés et déplacement',
        a: [
          'À ton tour tu lances deux dés et déplaces un pion par dé (ex. 3-5 : un pion de 3 et un autre de 5, ou le même pion 3 puis 5).',
          'Un double (ex. 4-4) te permet de jouer ce nombre quatre fois.',
          'Tu ne peux atterrir sur une flèche que si elle est vide, contient tes pions ou un seul pion adverse.',
        ],
      },
      {
        q: 'Frapper et la barre',
        a: [
          'Atterrir sur une flèche avec un pion adverse isolé (un blot) le frappe ; ce pion va sur la barre au centre.',
          'Si tu as un pion sur la barre, tu dois le faire rentrer dans le jan intérieur adverse avant tout autre coup.',
        ],
      },
      {
        q: 'Sortir les pions (Bear Off)',
        a: [
          'Une fois tes 15 pions dans ton jan intérieur (flèches 1–6), tu peux commencer à les sortir.',
          'Un dé sort un pion de la flèche correspondante. Le premier à tous les sortir gagne.',
        ],
      },
      {
        q: 'Le videau (doubling cube)',
        a: [
          'Le videau double l’enjeu. Quand tu penses mener, tu peux proposer le videau.',
          'Si l’adversaire accepte, la partie vaut le double et il possède le videau ; s’il refuse, il perd la valeur actuelle.',
          'Un gammon (l’adversaire n’a rien sorti) compte double ; un backgammon (il a en plus un pion sur la barre ou dans ton jan) compte triple.',
        ],
      },
      {
        q: 'Stratégie de base',
        a: [
          'Fais des flèches (2 pions ou plus) dans ton jan intérieur pour compliquer la rentrée de l’adversaire.',
          'Évite de laisser des blots ; être frappé te renvoie en arrière.',
          'Quand tu mènes, passe à une course ; quand tu es derrière, garde des flèches arrière pour contenir l’adversaire (back game).',
          'Utilise le panneau d’Analyse et l’Analyseur de Position pour apprendre les meilleurs coups.',
        ],
      },
    ],
  },
}

export default function Lessons({ onClose }: Props) {
  const { lang, t } = useT()
  useEscape(onClose)
  const c = CONTENT[lang] ?? CONTENT.en
  const [open, setOpen] = useState(0)

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card lessons-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2><Icon name="book" size={20} /> {c.title}</h2>
        <div className="lessons-list">
          {c.sections.map((s, i) => (
            <div key={i} className={`lesson-item ${open === i ? 'open' : ''}`}>
              <Button
                variant="ghost"
                className="lesson-q w-full justify-between"
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <span>{s.q}</span>
                <span className="lesson-caret">{open === i ? '−' : '+'}</span>
              </Button>
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
