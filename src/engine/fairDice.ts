// Provably-fair (dogrulanabilir) zar.
// Mac basinda serverSeed uretilir; commitment = SHA256(serverSeed) oyuncuya gosterilir.
// Her atis: SHA256(serverSeed ":" clientSeed ":" nonce) -> baytlardan reddetme
// ornekleme ile iki zar. Mac sonunda serverSeed ifsa edilir; oyuncu
// commitment'i ve her atisi bagimsizca dogrulayabilir (verifyRoll).
// Bagimli kutuphane yok: senkron SHA-256 asagida.

/* ---------- Senkron SHA-256 ---------- */
function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n))
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

// UTF-8 bayt dizisinin SHA-256'sini bayt (Uint8Array, 32) olarak dondur
export function sha256Bytes(input: Uint8Array): Uint8Array {
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const l = input.length
  const bitLen = l * 8
  // Padding: 0x80, sonra 0'lar, son 8 bayt uzunluk (big-endian)
  const withPad = new Uint8Array((((l + 8) >> 6) + 1) << 6)
  withPad.set(input)
  withPad[l] = 0x80
  const dv = new DataView(withPad.buffer)
  dv.setUint32(withPad.length - 4, bitLen >>> 0, false)
  dv.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false)

  const w = new Uint32Array(64)
  for (let i = 0; i < withPad.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4, false)
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + S1 + ch + K[t] + w[t]) | 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0
      hh = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }
    h[0] = (h[0] + a) | 0
    h[1] = (h[1] + b) | 0
    h[2] = (h[2] + c) | 0
    h[3] = (h[3] + d) | 0
    h[4] = (h[4] + e) | 0
    h[5] = (h[5] + f) | 0
    h[6] = (h[6] + g) | 0
    h[7] = (h[7] + hh) | 0
  }
  const out = new Uint8Array(32)
  const odv = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, h[i] >>> 0, false)
  return out
}

function toHex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}
function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}
export function sha256Hex(s: string): string {
  return toHex(sha256Bytes(utf8(s)))
}

// Rastgele hex tohum
function randomSeed(bytes = 16): string {
  const b = new Uint8Array(bytes)
  crypto.getRandomValues(b)
  return toHex(b)
}

// serverSeed:clientSeed:nonce -> iki zar (reddetme ornekleme, modulo yanliligi yok)
export function rollFromSeed(serverSeed: string, clientSeed: string, nonce: number): number[] {
  const dice: number[] = []
  let round = 0
  while (dice.length < 2) {
    const digest = sha256Bytes(utf8(`${serverSeed}:${clientSeed}:${nonce}:${round}`))
    for (const byte of digest) {
      if (byte >= 252) continue // 252 = 42*6 -> ustunu reddet
      dice.push((byte % 6) + 1)
      if (dice.length === 2) break
    }
    round++
  }
  const [a, b] = dice
  return a === b ? [a, a, a, a] : [a, b]
}

export interface FairReveal {
  serverSeed: string
  clientSeed: string
  commitment: string
  rolls: number
}

// Bir mac icin adil zar ureticisi
export class FairDice {
  serverSeed: string
  clientSeed: string
  commitment: string
  nonce = 0

  constructor(serverSeed?: string, clientSeed?: string) {
    this.serverSeed = serverSeed ?? randomSeed()
    this.clientSeed = clientSeed ?? randomSeed(8)
    this.commitment = sha256Hex(this.serverSeed)
  }

  // Siradaki atisi uret ve nonce'u ilerlet
  next(): number[] {
    const dice = rollFromSeed(this.serverSeed, this.clientSeed, this.nonce)
    this.nonce++
    return dice
  }

  reveal(): FairReveal {
    return {
      serverSeed: this.serverSeed,
      clientSeed: this.clientSeed,
      commitment: this.commitment,
      rolls: this.nonce,
    }
  }
}

// Dogrulama: verilen tohumlarla n. atisi yeniden hesapla
export function verifyRoll(serverSeed: string, clientSeed: string, nonce: number): number[] {
  return rollFromSeed(serverSeed, clientSeed, nonce)
}
