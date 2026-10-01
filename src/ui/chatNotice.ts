import type { ChatWarning } from '../api'

type T = (k: string, p?: Record<string, string | number>) => string

// Küfür uyarısı (kırmızı küçük yazı). 1. ihlal = yalnız uyarı (yasak yok); sonrası uygulanan yasak.
export function chatWarnText(t: T, w: ChatWarning): string {
  if (w.label === 'warn') return t('chat.profanityFirst')
  return t('chat.profanity', { ban: t(`chat.ban.${w.label}`) })
}

// Konuşma yasağı aktifken kalan süre (gün/saat) ile uyarı.
export function chatMuteText(t: T, seconds: number): string {
  const left =
    seconds >= 86400
      ? t('chat.leftDays', { n: Math.ceil(seconds / 86400) })
      : t('chat.leftHours', { n: Math.max(1, Math.ceil(seconds / 3600)) })
  return t('chat.muted', { time: left })
}
