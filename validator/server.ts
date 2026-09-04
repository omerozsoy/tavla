// Sunucu-otoriter hamle doğrulama servisi (para maçı güvenliği Faz 2).
//
// Mevcut TS motorunu (src/engine) YENİDEN KULLANIR — PHP↔TS mantık sapması YOK.
// PHP backend (RoomController) her hamleyi buraya sorar; yasadışıysa reddedilir.
//
// Güvenlik: yalnız backend erişmeli. VALIDATOR_SECRET set edilirse `x-validator-secret`
// başlığı zorunlu. Servisi ASLA halka açık porta koyma (localhost + backend).
//
// Çalıştırma (Plesk/Node): `node validator/server.ts` (Node 24 type-stripping) veya
//   bundle: `node validator/dist/server.mjs`. Port: VALIDATOR_PORT (vars. 8090).

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { validateTurn } from '../src/engine/validateTurn.ts'
import { generateMoves } from '../src/engine/moves.ts'
import { analyzePr, type PrLogEntry } from './analyzePr.ts'

const SECRET = process.env.VALIDATOR_SECRET || ''
// Plesk/Passenger PORT env'i enjekte eder; SSH/PM2'de VALIDATOR_PORT kullanılır; yoksa 8090.
const PORT = Number(process.env.VALIDATOR_PORT || process.env.PORT || 8090)

function send(res: ServerResponse, code: number, body: unknown): void {
  const s = JSON.stringify(body)
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(s)
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1_000_000) {
        // 1MB üstü gövde reddet (kötüye kullanım)
        reject(new Error('body-too-large'))
        req.destroy()
        return
      }
      data += chunk
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        reject(new Error('bad-json'))
      }
    })
    req.on('error', reject)
  })
}

const LOG_IP = process.env.VALIDATOR_LOG_IP === '1'

const server = createServer(async (req, res) => {
  // Teşhis: isteğin kaynak IP'sini logla (VALIDATOR_LOG_IP=1). IP Address Restriction'ı
  // DOĞRU IP'ye kurmak için: backend bir hamle gönderdiğinde loglarda görünen IP = beyaz
  // listeye alınacak IP (sunucunun kendi public IP'si ya da 127.0.0.1 — kuruluma göre).
  if (LOG_IP) {
    const xff = (req.headers['x-forwarded-for'] as string | undefined) || ''
    // eslint-disable-next-line no-console
    console.log(`[validator] ${req.method} ${req.url} from=${req.socket.remoteAddress} xff=${xff}`)
  }
  // Sağlık kontrolü (secret'siz)
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, service: 'tavla-validator' })
  }
  // Paylaşılan sır (backend dışına kapalı)
  if (SECRET && req.headers['x-validator-secret'] !== SECRET) {
    return send(res, 401, { error: 'unauthorized' })
  }
  try {
    const body = (await readJson(req)) as {
      state?: unknown
      steps?: unknown
      hc?: unknown
      log?: unknown
      matchLength?: unknown
      isMoney?: unknown
    }
    if (req.method === 'POST' && req.url === '/validate') {
      // state: otoriter durum (zar dolu), steps: istemcinin önerdiği tam-tur
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = validateTurn(body.state as any, body.steps as any)
      return send(res, 200, r)
    }
    if (req.method === 'POST' && req.url === '/legal-moves') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const moves = generateMoves(body.state as any)
      return send(res, 200, { moves })
    }
    if (req.method === 'POST' && req.url === '/analyze-pr') {
      // Sunucu-otoriter PR: hc oyuncusunun kararlarini modelle YENIDEN degerlendir.
      const hc = body.hc === 'white' || body.hc === 'black' ? body.hc : null
      const log = Array.isArray(body.log) ? (body.log as PrLogEntry[]) : null
      if (!hc || !log) return send(res, 400, { error: 'bad-request', detail: 'hc/log gerekli' })
      const ml = typeof body.matchLength === 'number' && body.matchLength >= 1 ? body.matchLength : 1
      const r = await analyzePr(hc, log, ml, body.isMoney === true)
      return send(res, 200, r)
    }
    return send(res, 404, { error: 'not-found' })
  } catch (e) {
    return send(res, 400, { error: 'bad-request', detail: String((e as Error)?.message ?? e) })
  }
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[tavla-validator] listening on :${PORT}${SECRET ? ' (secret on)' : ''}`)
})
