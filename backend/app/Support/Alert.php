<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Merkezi UYARI kanalı: sistemde aksama yaratabilecek her aşamada çağrılır. E-posta (ADMIN_EMAILS)
 * + WhatsApp (CallMeBot: ALERT_WHATSAPP_PHONE/APIKEY) + log. Kanallar ayarlı değilse sessizce atlar
 * (log yine yazılır). Hiçbir kanal patlaması çağıranı bozmaz (her biri try/catch).
 */
class Alert
{
    /**
     * Uyarıyı tüm ayarlı kanallara gönder.
     *
     * @param  string  $msg  Kullanıcı-okur mesaj (WhatsApp + e-posta gövdesi).
     * @param  string  $subject  E-posta konusu.
     */
    public static function send(string $msg, string $subject = 'TavlaTV — Sistem Uyarısı'): void
    {
        // 1) E-posta (ADMIN_EMAILS, virgülle ayrık)
        foreach ((array) config('services.admin_emails', []) as $to) {
            if (! $to) {
                continue;
            }
            try {
                Mail::raw($msg, function ($m) use ($to, $subject) {
                    $m->to($to)->subject($subject);
                });
            } catch (\Throwable $e) {
                Log::warning('Alert email failed', ['to' => $to, 'err' => $e->getMessage()]);
            }
        }

        // 2) WhatsApp (CallMeBot)
        $phone = (string) config('services.alert.whatsapp_phone', '');
        $apikey = (string) config('services.alert.whatsapp_apikey', '');
        if ($phone !== '' && $apikey !== '') {
            try {
                Http::timeout(10)->get('https://api.callmebot.com/whatsapp.php', [
                    'phone' => $phone,
                    'text' => $msg,
                    'apikey' => $apikey,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Alert whatsapp failed', ['err' => $e->getMessage()]);
            }
        }

        // 3) Log (her hâlükârda)
        Log::error('ALERT: '.str_replace("\n", ' ', $msg));
    }

    /**
     * Spam-önleyici uyarı: yalnız DÜŞÜŞ anında + düşük kaldıkça REALERT_SECONDS'ta bir. Durum
     * cache'te tutulur (transition tespiti). "Sistemde aksama" olaylarında bunu kullan.
     *
     * @param  string  $key  Bu olay için benzersiz cache anahtarı (ör. 'watch:gnubg')
     * @param  bool  $isDown  Şu an sorunlu mu
     * @param  string  $downMsg  Düşünce gönderilecek mesaj
     * @param  string  $upMsg  Düzelince gönderilecek mesaj (boşsa gönderilmez)
     * @param  int  $realertSeconds  Düşük kaldıkça hatırlatma aralığı
     * @return string  Ne yapıldı: 'alerted-down' | 'suppressed-down' | 'recovered' | 'ok'
     */
    public static function transition(string $key, bool $isDown, string $downMsg, string $upMsg = '', int $realertSeconds = 900): string
    {
        $cache = \Illuminate\Support\Facades\Cache::class;
        $downKey = "alert:$key:down";
        $lastKey = "alert:$key:last";
        $wasDown = (bool) $cache::get($downKey, false);
        $now = time();

        if ($isDown) {
            $last = (int) $cache::get($lastKey, 0);
            $should = ! $wasDown || ($now - $last >= $realertSeconds);
            if ($should) {
                self::send($downMsg, 'TavlaTV — Sistem Uyarısı');
                // downKey ile AYNI TTL (7 gün) -> 1 günden uzun kesintide $last süresi dolup fazladan
                // uyarı tetiklemesin (aksi halde günde bir kez yeniden-uyarı yağmuru).
                $cache::put($lastKey, $now, now()->addDays(7));
            }
            $cache::put($downKey, true, now()->addDays(7));

            return $should ? 'alerted-down' : 'suppressed-down';
        }

        // Ayakta
        if ($wasDown) {
            if ($upMsg !== '') {
                self::send($upMsg, 'TavlaTV — Sistem Düzeldi');
            }
            $cache::forget($downKey);
            $cache::forget($lastKey);

            return 'recovered';
        }

        return 'ok';
    }
}
