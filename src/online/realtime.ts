// GERÇEK-ZAMANLI PUSH (Faz 2): Reverb WebSocket üzerinden oda güncellemelerini ANINDA al ->
// 1.2sn polling yükü düşer. Tasarım: push SADECE "hemen poll et" sinyali verir; tüm state-uygulama
// mantığı App.tsx poll'unda TEK yerde kalır (yeni desync yolu YOK). Push kapalı/bağlanamazsa
// isRealtimeConnected hep false -> App.tsx saf 1.2sn poll'a düşer (dormant, sıfır risk).
//
// Kanal PUBLIC `room.{code}` (non-bot maçlar zaten herkese izlenebilir) -> broadcasting-auth YOK.
// Konfig (enabled + public app key) sunucudan çalışma anında çekilir -> build'e gömülmez.
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { getRealtimeConfig } from '../api'

type EchoAny = {
  channel: (name: string) => { listen: (ev: string, cb: (p: unknown) => void) => void }
  leaveChannel: (name: string) => void
  connector?: { pusher?: { connection?: { bind: (e: string, cb: () => void) => void; state?: string } } }
}

let echoInstance: EchoAny | null = null
let initPromise: Promise<EchoAny | null> | null = null
let connected = false
const connListeners = new Set<(c: boolean) => void>()

function setConnected(c: boolean): void {
  if (c === connected) return
  connected = c
  connListeners.forEach((f) => {
    try {
      f(c)
    } catch {
      /* dinleyici hatası yayılmasın */
    }
  })
}

/** O anki push bağlantı durumu (App.tsx yedek-poll hızını buna göre ayarlar). */
export function isRealtimeConnected(): boolean {
  return connected
}

/** Bağlantı durumu değişimini dinle. Döndürdüğü fn aboneliği kaldırır. */
export function onRealtimeConn(cb: (c: boolean) => void): () => void {
  connListeners.add(cb)
  return () => connListeners.delete(cb)
}

// Echo'yu bir kez (lazy) kur. Konfig kapalı/eksikse null -> çağıran saf poll'a düşer.
async function getEcho(): Promise<EchoAny | null> {
  if (echoInstance) return echoInstance
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const cfg = await getRealtimeConfig()
      if (!cfg?.enabled || !cfg?.key) return null
      ;(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher
      const https = window.location.protocol === 'https:'
      const inst = new Echo({
        broadcaster: 'reverb',
        key: cfg.key,
        // Host/port istemcinin kendi alan adından türetilir (nginx /app -> 127.0.0.1:8080 proxy'ler).
        wsHost: window.location.hostname,
        wsPort: https ? 443 : 80,
        wssPort: https ? 443 : 80,
        forceTLS: https,
        enabledTransports: ['ws', 'wss'],
      }) as unknown as EchoAny
      const conn = inst.connector?.pusher?.connection
      if (conn) {
        conn.bind('connected', () => setConnected(true))
        conn.bind('connecting', () => setConnected(false))
        conn.bind('unavailable', () => setConnected(false))
        conn.bind('disconnected', () => setConnected(false))
        conn.bind('failed', () => setConnected(false))
        if (conn.state === 'connected') setConnected(true)
      }
      echoInstance = inst
      return inst
    } catch {
      return null // push kurulamadı -> saf poll (dormant)
    }
  })()
  return initPromise
}

/**
 * Bir odanın güncellemelerine abone ol. `onUpdate` her 'room.updated' olayında çağrılır
 * (App.tsx bunu "hemen poll et" tetikleyicisi olarak kullanır; payload'ı doğrudan uygulamaz).
 * Push yoksa no-op abonelik döner (çağıran saf poll'la çalışır). Döndürdüğü fn aboneliği bırakır.
 */
export async function subscribeRoom(code: string, onUpdate: (payload: unknown) => void): Promise<() => void> {
  const echo = await getEcho()
  if (!echo) return () => {}
  const name = 'room.' + code
  try {
    echo.channel(name).listen('.room.updated', onUpdate)
  } catch {
    return () => {}
  }
  return () => {
    try {
      echo.leaveChannel(name)
    } catch {
      /* yut */
    }
  }
}
