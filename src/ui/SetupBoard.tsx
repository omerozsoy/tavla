import { Icon } from './Icon'
import { NAUTICAL_FLAGS_TOP, NAUTICAL_FLAGS_BOTTOM } from '../nauticalFlags'
import iznikTile from '../assets/iznik-pano-x3.webp' // İznik board: çini pano deseni (dolu hane)
import sakuraTile from '../assets/sakura.webp' // Sakura board: kiraz dalı + kızıl güneş deseni
import xmasFirTop from '../assets/yilbasi-fir-top.webp' // Yılbaşı: asılı çam (apex-aşağı)
import xmasFirBot from '../assets/yilbasi-fir-bot.webp' // Yılbaşı: ayakta çam (apex-yukarı)
import xmasSnowTop from '../assets/yilbasi-snow-top.webp' // Yılbaşı: asılı kar konisi
import xmasSnowBot from '../assets/yilbasi-snow-bot.webp' // Yılbaşı: ayakta kar konisi

// Kurulum ekranlarindaki tahta onizlemesi: secilen temaya gore renklenir,
// baslangic dizilisinde istiflenmis pullar + iki zar. Ortada istege bagli
// "Tahtayi Degistir" butonu (tema seciciyi acar).

interface Props {
  panel: string
  a: string
  b: string
  checker: string
  cream?: string
  pointStyle?: 'sharp' | 'rounded' // hane sekli (yuvarlak damla = TavlaTV Özel)
  surface?: 'plain' | 'gradient' | 'felt' | 'wood' // agac damari vb.
  themeId?: string // ozel cok-renkli desenli boardlar icin (or. 'citrus-wood')
  onChangeBoard?: () => void
  changeLabel?: string
}

// Citrus Wood: hane renkleri kolon konumuna gore 6'li doner (gercek boarddaki nth-child deseniyle
// ayni his). Onizleme kucuk oldugundan cift-ton yerine per-kolon TEK renk yeter (yesil/lime/sari/
// altin/turuncu cok-renkliligi acikca okunur).
const CITRUS_POINTS = ['#4e9b45', '#f6c62f', '#91c75b', '#e8b51e', '#b6d75b', '#f39a0a']

// Hane yolu: TABAN = TAM YARIM DAİRE (yaricap r), govde = daralan sivri uc (referans ahsap board).
// baseY = tabanin oldugu kenar (rail), tipY = sivri uc (merkeze dogru). En genis cizgi (cember capi)
// rail'den r iceride; cap oradan rail'e dogru yarim daire yapar, kenarlar oradan uca daralir.
function bulletPath(cx: number, baseY: number, tipY: number, r: number): string {
  const dir = tipY > baseY ? 1 : -1
  const yW = baseY + dir * r // en genis cizgi (yarim dairenin capi = cember merkezi)
  const sweep = dir > 0 ? 1 : 0 // cap rail'e dogru KONVEKS bombelensin (ters sweep = ice oyuk lale)
  return `M ${cx - r} ${yW} A ${r} ${r} 0 0 ${sweep} ${cx + r} ${yW} L ${cx} ${tipY} Z`
}

// Standart baslangic dizilisi: {yari, satir, kolon(0-5), adet, beyaz?}
type Stack = { half: 'L' | 'R'; row: 'top' | 'bot'; col: number; n: number; w: boolean }
const START: Stack[] = [
  { half: 'L', row: 'top', col: 0, n: 5, w: true },
  { half: 'L', row: 'top', col: 4, n: 3, w: false },
  { half: 'R', row: 'top', col: 0, n: 5, w: false },
  { half: 'R', row: 'top', col: 5, n: 2, w: true },
  { half: 'L', row: 'bot', col: 0, n: 5, w: false },
  { half: 'L', row: 'bot', col: 4, n: 3, w: true },
  { half: 'R', row: 'bot', col: 0, n: 5, w: true },
  { half: 'R', row: 'bot', col: 5, n: 2, w: false },
]

// Zar yuzu pip konumlari (3x3 grid, 0..1)
const PIPS: Record<number, [number, number][]> = {
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
}

export default function SetupBoard({
  panel,
  a,
  b,
  checker,
  cream = '#f4efe6',
  pointStyle = 'sharp',
  surface = 'plain',
  themeId,
  onChangeBoard,
  changeLabel,
}: Props) {
  const W = 400
  const H = 264
  const PAD = 9 // dis cerceve (rail) kalinligi -> INCE kibar cerceve
  const GAP = 18 // orta bar
  const halfW = (W - 2 * PAD - GAP) / 2
  const colW = halfW / 6
  const r = colW * 0.36 // pullar arasi/etrafinda daha ferah bosluk
  const triH = (H - 2 * PAD) * 0.34
  const halfX = (half: 'L' | 'R') => (half === 'L' ? PAD : PAD + halfW + GAP)
  const colCx = (half: 'L' | 'R', col: number) => halfX(half) + colW * (col + 0.5)

  const rounded = pointStyle === 'rounded'
  const wood = surface === 'wood'
  const bw = colW / 2 - 1 // yarim taban genisligi
  const trTriH = rounded ? triH * 1.28 : triH // yuvarlak haneler biraz daha uzun (referans gibi)
  // Bir hane sekli: yuvarlak -> yarim-daire tabanli bullet path; klasik -> sivri ucgen polygon.
  const shape = (key: string, cx: number, baseY: number, tipY: number, fill: string) =>
    rounded ? (
      <path key={key} d={bulletPath(cx, baseY, tipY, bw)} fill={fill} opacity="0.97" />
    ) : (
      <polygon
        key={key}
        points={`${cx - colW / 2 + 1},${baseY} ${cx + colW / 2 - 1},${baseY} ${cx},${tipY}`}
        fill={fill}
        opacity="0.95"
      />
    )
  const citrus = themeId === 'citrus-wood'
  // Denizci: tek-sayılı haneler BOŞ ahşap, çift-sayılı haneler 12 sinyal flaması (her biri 1 kez).
  // Önizlemede ritim: her yarıda tek kolonlar (1,3,5) bayraklı -> 3×2yarı×2satır = 12 flama.
  const nautical = themeId === 'nautical'
  // İznik: hane çifti dönüşümlü — desenli çini (shade-a) + karanfil kırmızısı (shade-b, prop 'b').
  const iznik = themeId === 'iznik'
  // Sakura: desenli kiraz hane (shade-a) + düz kızıl hane (shade-b, prop 'b').
  const sakura = themeId === 'sakura'
  // Yılbaşı: köknar (a) + kar (b) dönüşümlü renkli haneler.
  const yilbasi = themeId === 'yilbasi'
  let nautIdx = 0
  const flagTri = (key: string, cx: number, baseY: number, tipY: number, uri: string, par = 'xMidYMid slice') => {
    const pts = `${cx - colW / 2 + 1},${baseY} ${cx + colW / 2 - 1},${baseY} ${cx},${tipY}`
    const y = Math.min(baseY, tipY)
    return [
      <clipPath key={`${key}-c`} id={`nf-${key}`}>
        <polygon points={pts} />
      </clipPath>,
      <image
        key={key}
        href={uri}
        x={cx - colW / 2}
        y={y}
        width={colW}
        height={Math.abs(tipY - baseY)}
        preserveAspectRatio={par}
        clipPath={`url(#nf-${key})`}
      />,
    ]
  }
  const tris = []
  for (const half of ['L', 'R'] as const) {
    for (let col = 0; col < 6; col++) {
      const cx = colCx(half, col)
      if (nautical) {
        // KOYU AHŞAP üçgen (çift kolon) + BAYRAKLI flama (tek kolon). a = koyu ceviz (tri-a).
        if (col % 2 === 1) {
          tris.push(...flagTri(`${half}${col}t`, cx, PAD, PAD + trTriH, NAUTICAL_FLAGS_TOP[nautIdx++ % 12]))
          tris.push(...flagTri(`${half}${col}b`, cx, H - PAD, H - PAD - trTriH, NAUTICAL_FLAGS_BOTTOM[nautIdx++ % 12]))
        } else {
          tris.push(shape(`t-${half}-${col}`, cx, PAD, PAD + trTriH, a))
          tris.push(shape(`btm-${half}-${col}`, cx, H - PAD, H - PAD - trTriH, a))
        }
        continue
      }
      if (iznik) {
        // Desenli hane (çift kolon üst / tek kolon alt) + DÜZ turkuaz komşu hane (prop 'b').
        // flagTri = üçgene klipli görsel (üst yarısı 'slice'/cover -> dik, ezilmez).
        if (col % 2 === 0) tris.push(...flagTri(`iz-${half}${col}t`, cx, PAD, PAD + trTriH, iznikTile))
        else tris.push(shape(`t-${half}-${col}`, cx, PAD, PAD + trTriH, b))
        if (col % 2 === 1) tris.push(...flagTri(`iz-${half}${col}b`, cx, H - PAD, H - PAD - trTriH, iznikTile))
        else tris.push(shape(`btm-${half}-${col}`, cx, H - PAD, H - PAD - trTriH, b))
        continue
      }
      if (sakura) {
        // Desenli kiraz hane (üst çift / alt tek kolon) + düz kızıl komşu hane (prop 'b').
        if (col % 2 === 0) tris.push(...flagTri(`sk-${half}${col}t`, cx, PAD, PAD + trTriH, sakuraTile))
        else tris.push(shape(`t-${half}-${col}`, cx, PAD, PAD + trTriH, b))
        if (col % 2 === 1) tris.push(...flagTri(`sk-${half}${col}b`, cx, H - PAD, H - PAD - trTriH, sakuraTile))
        else tris.push(shape(`btm-${half}-${col}`, cx, H - PAD, H - PAD - trTriH, b))
        continue
      }
      if (yilbasi) {
        // Çam (a) + kar konisi (b) dönüşümlü; üst = apex-aşağı (asılı) asset, alt = apex-yukarı.
        // par='none' -> CSS'teki 100% 100% (ağaç tabanı geniş kenara, tepe sivri uca hizalı).
        const topFir = col % 2 === 0
        tris.push(...flagTri(`yb-${half}${col}t`, cx, PAD, PAD + trTriH, topFir ? xmasFirTop : xmasSnowTop, 'none'))
        tris.push(...flagTri(`yb-${half}${col}b`, cx, H - PAD, H - PAD - trTriH, topFir ? xmasSnowBot : xmasFirBot, 'none'))
        continue
      }
      const light = col % 2 === 0
      // Citrus: kolon konumuna gore cok-renkli (yesil/lime/sari/altin/turuncu); ust/alt farkli ton.
      // Digerleri: ust ve alt hane ters renk (gercek tahta gibi).
      const topFill = citrus ? CITRUS_POINTS[col] : light ? a : b
      const botFill = citrus ? CITRUS_POINTS[(col + 3) % 6] : light ? b : a
      tris.push(shape(`t-${half}-${col}`, cx, PAD, PAD + trTriH, topFill))
      tris.push(shape(`btm-${half}-${col}`, cx, H - PAD, H - PAD - trTriH, botFill))
      // Agac damari: hane uzerine ince dikey damar (aynı teardrop/ucgen sekle klipli degil,
      // path'i pattern ile ikinci kez cizerek) — yalniz wood board.
      if (wood && rounded) {
        tris.push(
          <path key={`tg-${half}-${col}`} d={bulletPath(cx, PAD, PAD + trTriH, bw)} fill="url(#sb-wood)" opacity="0.5" />,
          <path key={`bg-${half}-${col}`} d={bulletPath(cx, H - PAD, H - PAD - trTriH, bw)} fill="url(#sb-wood)" opacity="0.5" />,
        )
      }
    }
  }

  // Dikey istif adimi: en yuksek yigin (5) yariya (PAD..H/2) sigmali; aksi halde
  // ust ve alt yiginlar merkezde ust uste biner. r*2+1 tercih, sigmiyorsa daraltilir.
  const maxStack = 5
  const step = Math.min(r * 2 + 1, (H / 2 - PAD - 2 * r - 4) / (maxStack - 1))
  const discs = []
  for (const s of START) {
    const cx = colCx(s.half, s.col)
    for (let k = 0; k < s.n; k++) {
      const cy = s.row === 'top' ? PAD + r + 1 + k * step : H - PAD - r - 1 - k * step
      discs.push(
        <circle
          key={`d-${s.half}-${s.row}-${s.col}-${k}`}
          cx={cx}
          cy={cy}
          r={r}
          fill={s.w ? cream : checker}
          stroke={citrus ? '#e5d6bc' : 'rgba(0,0,0,0.28)'}
          strokeWidth={citrus ? 2 : 1}
        />,
      )
    }
  }

  const die = (x: number, y: number, face: number, pip: string) => {
    const size = 34
    return (
      <g key={`die-${x}`}>
        <rect
          x={x - size / 2}
          y={y - size / 2}
          width={size}
          height={size}
          rx="7"
          fill={cream}
          stroke="rgba(0,0,0,0.25)"
        />
        {PIPS[face].map(([px, py], i) => (
          <circle
            key={i}
            cx={x - size / 2 + px * size}
            cy={y - size / 2 + py * size}
            r={3.1}
            fill={pip}
          />
        ))}
      </g>
    )
  }

  return (
    <div className="setup-board">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="setup-board-svg">
        <defs>
          {/* Agac damari deseni (wood): ince dikey damar cizgileri. Zemin + haneler bunu kullanir. */}
          {wood && (
            <pattern id="sb-wood" width="6" height="8" patternUnits="userSpaceOnUse">
              <rect width="1" height="8" fill="rgba(0,0,0,0.22)" />
              <rect x="3" width="0.7" height="8" fill="rgba(255,255,255,0.06)" />
            </pattern>
          )}
          {/* Ic oyun alani KOSELERI YUVARLAK: haneler/bar bu yuvarlak dikdortgene klipli.
              Aksi halde sivri hane tabanlari dis (yuvarlak) cerceve koselerine tasip
              "kotu kose" veriyordu -> klip ile alan koseleri cerceveyle uyumlu yuvarlanir. */}
          <clipPath id="sb-field">
            <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} rx="9" />
          </clipPath>
        </defs>
        {/* Dis cerceve (rail) - INCE */}
        <rect x="0" y="0" width={W} height={H} rx="14" fill={panel} />
        {/* Zemin agac damari (kullanicinin okla gosterdigi: haneler ARASI koyu zemin dokulu) */}
        {wood && <rect x="0" y="0" width={W} height={H} rx="14" fill="url(#sb-wood)" />}
        {/* Ic alan icerigi yuvarlak-kose alana klipli */}
        <g clipPath="url(#sb-field)">
          {/* Ic oyun alani: cerceveden AYRISIN diye hafif koyulastir (tema-bagimsiz overlay;
              acik+koyu tum boardlarda "cukur alan" hissi -> kenar/kose net). */}
          <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="rgba(0,0,0,0.06)" />
          {/* orta bar */}
          <rect x={PAD + halfW} y={PAD} width={GAP} height={H - 2 * PAD} rx="3" fill={checker} opacity="0.55" />
          {tris}
        </g>
        {/* Ic alan cercevesi: yuvarlak-kose ince cizgi -> alan/cerceve gecisi temiz */}
        <rect
          x={PAD}
          y={PAD}
          width={W - 2 * PAD}
          height={H - 2 * PAD}
          rx="9"
          fill="none"
          stroke="rgba(0,0,0,0.16)"
          strokeWidth="1"
        />
        {/* Dis cerceve kenar cizgisi (0.5px iceri -> kirpilmaz), INCE kibar */}
        <rect x="0.75" y="0.75" width={W - 1.5} height={H - 1.5} rx="13.5" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1.25" />
        {discs}
        {/* İki zar da AYNI: gövde=cream, pip=checker. (Eskiden sağ zarın pip'i üçgen rengi
            'a' idi -> Siyah pul takasında koyu zar üstünde kırmızı pip okunmuyordu/uyumsuzdu.
            checker ile cream daima zıt iki pul rengi -> pip her durumda okunur.) */}
        {die(W * 0.28, H / 2, 5, checker)}
        {die(W * 0.72, H / 2, 3, checker)}
      </svg>
      {onChangeBoard && (
        <button type="button" className="setup-board-change" onClick={onChangeBoard}>
          <Icon name="refresh" size={17} /> {changeLabel}
        </button>
      )}
    </div>
  )
}
