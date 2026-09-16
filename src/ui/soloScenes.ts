// Tek Oyun seviye kartlarindaki mini-sahne gorselleri.
// Tasarim: "TavlaTV Seviye Kartlari v2" — her seviye kendi renk paleti + artan
// karmasiklik (pul yigini -> zar -> katlama kupu -> podyum). Statik sanat oldugundan
// (kullanici girdisi YOK) dangerouslySetInnerHTML ile birebir enjekte edilir.

// Kilit kaplamasi (satin alinabilir seviye): koyu perde + asma kilit.
function lockOverlay(light = '#F1EDE4', tint = 'rgba(28,24,32,'): string {
  return `<div style="position:absolute;inset:0;border-radius:10px;background:linear-gradient(180deg,${tint}.18),${tint}.58));z-index:4;display:flex;align-items:center;justify-content:center">
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">
      <div style="width:9px;height:5px;border:1.5px solid ${light};border-bottom:none;border-radius:5px 5px 0 0;box-sizing:border-box"></div>
      <div style="width:14px;height:10px;border-radius:2.5px;background:${light}"></div>
    </div>
  </div>`
}

// Bir seviyenin mini-sahnesi (gradient kutu + iceriği). locked=true ise kilit kaplamasi.
export function soloScene(level: number, locked: boolean): string {
  const box = (grad: string, gap: number, inner: string, lock?: string) =>
    `<div style="position:relative;height:82px;border-radius:10px;overflow:hidden;box-sizing:border-box;background:${grad};display:flex;align-items:flex-end;justify-content:center;gap:${gap}px;padding-bottom:13px">${locked ? lock ?? lockOverlay() : ''}${inner}</div>`

  // Ortak parcalar
  const baseline = (op: number, l = 8) =>
    `<div style="position:absolute;bottom:10px;left:${l}px;right:${l}px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,${op}),transparent)"></div>`
  const tri = (w: number, h: number, side: 'c' | 'l' | 'r', pos: number, op: number, bottom = 10) => {
    const place =
      side === 'c'
        ? `left:50%;transform:translateX(-50%)`
        : side === 'l'
        ? `left:${pos}px`
        : `right:${pos}px`
    return `<div style="position:absolute;bottom:${bottom}px;${place};width:${w}px;height:${h}px;clip-path:polygon(50% 0,100% 100%,0 100%);background:linear-gradient(180deg,rgba(255,255,255,${op}),rgba(255,255,255,0) 88%)"></div>`
  }
  // pul (chip): yassi elips; first=true -> margin yok
  const chip = (w: number, h: number, grad: string, sh: string, topInset: string, first: boolean) =>
    `<div style="width:${w}px;height:${h}px;${first ? '' : 'margin-top:-2px;'}border-radius:50%;background:${grad};box-shadow:inset 0 .5px 0 ${topInset},0 1px 2px ${sh}"></div>`
  const stack = (n: number, w: number, h: number, grads: string[], sh: string) => {
    let s = '<div style="display:flex;flex-direction:column;align-items:center">'
    for (let i = 0; i < n; i++) {
      const g = grads[i] ?? grads[grads.length - 1]
      const inset = g.includes('#FDFAF2') || g.includes('#F') ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.3)'
      s += chip(w, h, g, sh, inset, i === 0)
    }
    return s + '</div>'
  }
  const CREAM = 'linear-gradient(180deg,#FDFAF2,#EDE2CE 42%,#C2AC8D)'
  const DARK = 'linear-gradient(180deg,#4A4046,#302830 45%,#1A151B)'

  switch (level) {
    case 1:
      return box(
        'linear-gradient(155deg,#EDA694,#D8806C)',
        5,
        tri(16, 48, 'c', 0, 0.5) +
          baseline(0.45) +
          chip(30, 8, CREAM, 'rgba(90,50,40,.35)', 'rgba(255,255,255,.9)', true),
      )
    case 2:
      return box(
        'linear-gradient(155deg,#D2A96F,#B0854B)',
        5,
        tri(16, 52, 'c', 0, 0.5) + baseline(0.45) + stack(2, 30, 8, [CREAM], 'rgba(80,55,25,.35)'),
      )
    case 3:
      return box(
        'linear-gradient(155deg,#84C49B,#549A73)',
        5,
        tri(16, 56, 'c', 0, 0.5) +
          tri(10, 30, 'l', 14, 0.3) +
          tri(10, 30, 'r', 14, 0.3) +
          baseline(0.45) +
          stack(3, 30, 8, [CREAM], 'rgba(25,70,45,.35)'),
      )
    case 4:
      return box(
        'linear-gradient(155deg,#AE8FDA,#8563B4)',
        5,
        tri(18, 60, 'c', 0, 0.5) +
          tri(10, 34, 'l', 12, 0.3) +
          tri(10, 34, 'r', 12, 0.3) +
          baseline(0.45) +
          stack(5, 30, 8, [CREAM, DARK, CREAM, DARK, CREAM], 'rgba(45,25,75,.35)'),
      )
    case 5: {
      const dice = `<div style="width:19px;height:19px;border-radius:5px;background:linear-gradient(150deg,#FFFDF6,#E8DCC6 58%,#BFA987);box-shadow:inset 0 .5px 0 rgba(255,255,255,.9),0 2px 4px rgba(10,60,58,.4);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:3px;box-sizing:border-box">
        <div style="width:3px;height:3px;border-radius:50%;background:#2E7A7A"></div><div></div><div style="width:3px;height:3px;border-radius:50%;background:#2E7A7A;justify-self:end"></div>
        <div></div><div style="width:3px;height:3px;border-radius:50%;background:#2E7A7A;place-self:center"></div><div></div>
        <div style="width:3px;height:3px;border-radius:50%;background:#2E7A7A;align-self:end"></div><div></div><div style="width:3px;height:3px;border-radius:50%;background:#2E7A7A;justify-self:end;align-self:end"></div>
      </div>`
      const darkTeal = 'linear-gradient(180deg,#4A4046,#2C2A2A 45%,#171616)'
      return box(
        'linear-gradient(155deg,#6CC2BA,#3E938E)',
        6,
        tri(18, 64, 'c', 0, 0.5) +
          tri(10, 38, 'l', 10, 0.3) +
          tri(10, 38, 'r', 10, 0.3) +
          baseline(0.5) +
          stack(5, 26, 7, [CREAM, darkTeal, CREAM, darkTeal, CREAM], 'rgba(10,60,58,.35)') +
          dice,
      )
    }
    case 6: {
      const dice = `<div style="width:17px;height:17px;border-radius:5px;background:linear-gradient(150deg,#FFFDF6,#E8DCC6 58%,#BFA987);box-shadow:inset 0 .5px 0 rgba(255,255,255,.9),0 2px 4px rgba(80,25,20,.4);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:3px;box-sizing:border-box">
        <div style="width:3px;height:3px;border-radius:50%;background:#7E2620"></div><div></div><div style="width:3px;height:3px;border-radius:50%;background:#7E2620;justify-self:end"></div>
        <div style="width:3px;height:3px;border-radius:50%;background:#7E2620;align-self:center"></div><div></div><div style="width:3px;height:3px;border-radius:50%;background:#7E2620;justify-self:end;align-self:center"></div>
        <div style="width:3px;height:3px;border-radius:50%;background:#7E2620;align-self:end"></div><div></div><div style="width:3px;height:3px;border-radius:50%;background:#7E2620;justify-self:end;align-self:end"></div>
      </div>`
      const darkRed = 'linear-gradient(180deg,#4E4038,#332924 48%,#1C1512)'
      return box(
        'linear-gradient(155deg,#E08B82,#BE504A)',
        4,
        tri(18, 66, 'c', 0, 0.5) +
          tri(10, 42, 'l', 8, 0.3) +
          tri(10, 42, 'r', 8, 0.3) +
          baseline(0.5) +
          stack(4, 22, 7, [CREAM], 'rgba(80,25,20,.35)') +
          dice +
          stack(4, 22, 7, [darkRed], 'rgba(80,25,20,.35)'),
      )
    }
    case 7: {
      const glow = `<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:110px;height:76px;background:radial-gradient(ellipse at 50% 84%,rgba(255,255,255,.34),transparent 66%)"></div>`
      const blueTop = 'linear-gradient(180deg,#C6D6F0,#8DA4D0 48%,#4C6DA8)'
      const cube = `<div style="perspective:160px;padding-bottom:1px"><div style="width:24px;height:24px;position:relative;transform-style:preserve-3d;transform:rotateX(-16deg) rotateY(-26deg)">
        <div style="position:absolute;inset:0;transform:translateZ(12px);background:linear-gradient(150deg,#FFFDF6,#E6DAC2 60%,#C4AE8C);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#2A4270">8</div>
        <div style="position:absolute;inset:0;transform:rotateY(90deg) translateZ(12px);background:linear-gradient(160deg,#C9B492,#9C8663);border-radius:4px"></div>
        <div style="position:absolute;inset:0;transform:rotateX(90deg) translateZ(12px);background:linear-gradient(160deg,#FFFDF7,#E9DFCA);border-radius:4px"></div>
      </div></div>`
      return box(
        'linear-gradient(155deg,#6C7CAE,#3F4C78)',
        5,
        glow +
          tri(20, 70, 'c', 0, 0.52) +
          tri(10, 46, 'l', 6, 0.3) +
          tri(10, 46, 'r', 6, 0.3) +
          baseline(0.55, 7) +
          stack(6, 24, 7, [blueTop, CREAM], 'rgba(15,25,55,.4)') +
          cube,
      )
    }
    case 8: {
      const glow = `<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:120px;height:80px;background:radial-gradient(ellipse at 50% 84%,rgba(255,255,255,.26),transparent 64%)"></div>`
      const steel = 'linear-gradient(180deg,#F2F5F8,#C2C9D0 48%,#7C848C)'
      const darkSteel = 'linear-gradient(180deg,#4E4A48,#332F2C 48%,#1C1918)'
      const cube = `<div style="perspective:160px;padding-bottom:1px"><div style="width:22px;height:22px;position:relative;transform-style:preserve-3d;transform:rotateX(-16deg) rotateY(-24deg)">
        <div style="position:absolute;inset:0;transform:translateZ(11px);background:linear-gradient(150deg,#F7F9FB,#D4D9DE 60%,#9AA3AC);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#2C3238">32</div>
        <div style="position:absolute;inset:0;transform:rotateY(90deg) translateZ(11px);background:linear-gradient(160deg,#A8B0B8,#6E767E);border-radius:4px"></div>
        <div style="position:absolute;inset:0;transform:rotateX(90deg) translateZ(11px);background:linear-gradient(160deg,#FAFBFC,#DDE2E7);border-radius:4px"></div>
      </div></div>`
      return box(
        'linear-gradient(155deg,#8E959D,#5B6268)',
        3,
        glow +
          tri(22, 72, 'c', 0, 0.55) +
          tri(10, 48, 'l', 5, 0.32) +
          tri(10, 48, 'r', 5, 0.32) +
          baseline(0.6, 6) +
          stack(6, 18, 6, [steel, darkSteel], 'rgba(30,34,38,.4)') +
          cube +
          stack(6, 18, 6, [steel, CREAM], 'rgba(30,34,38,.4)'),
      )
    }
    case 9: {
      const glow = `<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:130px;height:82px;background:radial-gradient(ellipse at 50% 82%,rgba(216,192,138,.5),transparent 62%)"></div>`
      const crown = `<div style="position:absolute;top:5px;left:50%;transform:translateX(-50%);display:flex;align-items:flex-end;gap:3px">
        <div style="width:5px;height:6px;clip-path:polygon(50% 0,100% 100%,0 100%);background:rgba(216,192,138,.6)"></div>
        <div style="width:7px;height:9px;clip-path:polygon(50% 0,100% 100%,0 100%);background:#EBD7AA"></div>
        <div style="width:5px;height:6px;clip-path:polygon(50% 0,100% 100%,0 100%);background:rgba(216,192,138,.6)"></div>
      </div>`
      const podium = `<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:84px;height:6px;border-radius:2px;background:linear-gradient(180deg,#8A7248,#4A3B24);box-shadow:inset 0 .5px 0 rgba(240,224,180,.6),0 2px 5px rgba(0,0,0,.45)"></div>`
      const goldTop = 'linear-gradient(180deg,#F8EBC8,#D8C08A 48%,#957C45)'
      const darkGold = 'linear-gradient(180deg,#4E4238,#332A22 48%,#1C1612)'
      const goldTri = (w: number, h: number, side: 'c' | 'l' | 'r', pos: number, op: number, bottom = 12) => {
        const place = side === 'c' ? `left:50%;transform:translateX(-50%)` : side === 'l' ? `left:${pos}px` : `right:${pos}px`
        return `<div style="position:absolute;bottom:${bottom}px;${place};width:${w}px;height:${h}px;clip-path:polygon(50% 0,100% 100%,0 100%);background:linear-gradient(180deg,rgba(216,192,138,${op}),rgba(216,192,138,0) 88%)"></div>`
      }
      const cube = `<div style="perspective:170px;position:relative;padding-bottom:1px"><div style="width:21px;height:21px;position:relative;transform-style:preserve-3d;transform:rotateX(-14deg) rotateY(-24deg)">
        <div style="position:absolute;inset:0;transform:translateZ(10.5px);background:linear-gradient(150deg,#FBF3DE,#E4D0A4 58%,#B99C63);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#4A3A1E">64</div>
        <div style="position:absolute;inset:0;transform:rotateY(90deg) translateZ(10.5px);background:linear-gradient(160deg,#C3A874,#8C7346);border-radius:4px"></div>
        <div style="position:absolute;inset:0;transform:rotateX(90deg) translateZ(10.5px);background:linear-gradient(160deg,#FFFBF0,#EBDCB8);border-radius:4px"></div>
      </div></div>`
      return box(
        'linear-gradient(155deg,#6A5E4A,#33291E)',
        3,
        glow +
          goldTri(24, 74, 'c', 0, 0.6) +
          goldTri(11, 50, 'l', 4, 0.32) +
          goldTri(11, 50, 'r', 4, 0.32) +
          crown +
          podium +
          stack(6, 18, 6, [goldTop, CREAM], 'rgba(0,0,0,.4)') +
          cube +
          stack(6, 18, 6, [goldTop, darkGold], 'rgba(0,0,0,.4)'),
        lockOverlay('#EBD7AA', 'rgba(28,22,14,'),
      )
    }
    default:
      return box('linear-gradient(155deg,#EDA694,#D8806C)', 5, baseline(0.45))
  }
}
