// Bagimliliksiz PWA ikonu ureteci (zlib ile ham PNG). Navy zemin + krem tas + zar noktalari.
import zlib from 'node:zlib'
import { writeFileSync } from 'node:fs'

const NAVY = [10, 13, 46]
const CREAM = [233, 220, 195]
const NAVY2 = [20, 26, 74]

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'latin1')
  const body = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function makePng(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const cx = size / 2
  const cy = size / 2
  const rChecker = size * 0.34
  const rPip = size * 0.045
  // Zar noktalari (5'li) icin ofsetler
  const pipOff = size * 0.14
  const pips = [
    [cx - pipOff, cy - pipOff],
    [cx + pipOff, cy - pipOff],
    [cx, cy],
    [cx - pipOff, cy + pipOff],
    [cx + pipOff, cy + pipOff],
  ]
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      let col = NAVY
      if (dist < rChecker) {
        col = CREAM
        // zar noktalari (navy)
        for (const [px, py] of pips) {
          if (Math.hypot(x - px, y - py) < rPip) {
            col = NAVY2
            break
          }
        }
      }
      const p = rowStart + 1 + x * 3
      raw[p] = col[0]
      raw[p + 1] = col[1]
      raw[p + 2] = col[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const s of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), makePng(s))
  console.log(`icon-${s}.png yazildi`)
}
