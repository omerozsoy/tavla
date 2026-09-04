<?php

namespace App\Console\Commands;

use App\Services\MoveValidatorService;
use App\Support\Backgammon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Validator (sunucu-otoriter hakem) izleme + UYARI. Cron ile dakikada bir çalışır.
 * Düşerse: admin e-postası + (ayarlıysa) WhatsApp (CallMeBot) + log. Spam olmasın diye yalnız
 * DÜŞÜŞ anında uyarır; düşük kaldıkça ~15dk'da bir hatırlatır; tekrar ayağa kalkınca "düzeldi" der.
 * Durum cache'te tutulur (transition tespiti).
 */
class ValidatorWatch extends Command
{
    protected $signature = 'validator:watch {--test : Kanalları doğrulamak için hemen test uyarısı gönder}';

    protected $description = 'Validator ayakta mı kontrol et; düşerse admin e-posta + WhatsApp uyarısı gönder';

    private const DOWN_KEY = 'validator:watch:down';

    private const LAST_ALERT_KEY = 'validator:watch:last-alert';

    private const REALERT_SECONDS = 900; // düşük kaldıkça 15dk'da bir hatırlat

    public function handle(MoveValidatorService $validator): int
    {
        // Test: kanalların (e-posta + WhatsApp) çalıştığını servisi düşürmeden doğrula.
        if ($this->option('test')) {
            $this->dispatchAlert("🧪 TavlaTV TEST uyarısı — servis izleme kanalları çalışıyor. (Bu bir testtir.)");
            $this->info('Test uyarısı gönderildi (e-posta + WhatsApp, ayarlı kanallara).');

            return self::SUCCESS;
        }

        // Validator yapılandırılmamışsa (URL yok) authoritative zaten çalışmaz -> uyarma.
        if (! $validator->isConfigured()) {
            return self::SUCCESS;
        }

        $up = $this->probe($validator);
        $wasDown = (bool) Cache::get(self::DOWN_KEY, false);
        $now = time();

        if (! $up) {
            $lastAlert = (int) Cache::get(self::LAST_ALERT_KEY, 0);
            $shouldAlert = ! $wasDown || ($now - $lastAlert >= self::REALERT_SECONDS);
            if ($shouldAlert) {
                $this->dispatchAlert(
                    "🔴 TAVLA VALIDATOR DÜŞTÜ\nSunucu-otoriter maçlarda hamleler REDDEDİLİYOR. ".
                    "Lütfen validator.tavlai.com Node uygulamasını yeniden başlat (admin panel > Servis Durumu > Yeniden Başlat)."
                );
                Cache::put(self::LAST_ALERT_KEY, $now, now()->addDay());
            }
            Cache::put(self::DOWN_KEY, true, now()->addDays(7));
            $this->error('validator DOWN'.($shouldAlert ? ' (uyarı gönderildi)' : ' (uyarı bastırıldı)'));
        } else {
            if ($wasDown) {
                $this->dispatchAlert("🟢 TAVLA VALIDATOR tekrar ÇALIŞIYOR.\nMaçlar normale döndü.");
            }
            Cache::forget(self::DOWN_KEY);
            Cache::forget(self::LAST_ALERT_KEY);
            $this->info('validator UP');
        }

        return self::SUCCESS;
    }

    /** Bilinen-yasal bir hamleyi doğrulatarak validator'ın çalışıp çalışmadığını ölç. */
    private function probe(MoveValidatorService $validator): bool
    {
        try {
            $s = Backgammon::initialState();
            $s['dice'] = [3, 1];
            $s['diceUsed'] = [false, false];
            $r = $validator->validate($s, [
                ['from' => 5, 'to' => 2, 'die' => 3],
                ['from' => 2, 'to' => 1, 'die' => 1],
            ]);

            return (bool) ($r['valid'] ?? false) && empty($r['unreachable']);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** Uyarıyı tüm kanallara gönder: e-posta (admin) + WhatsApp (CallMeBot, ayarlıysa) + log. */
    private function dispatchAlert(string $msg): void
    {
        // 1) E-posta (ADMIN_EMAILS)
        foreach ((array) config('services.admin_emails', []) as $to) {
            try {
                Mail::raw($msg, function ($m) use ($to) {
                    $m->to($to)->subject('TavlaTV — Servis Uyarısı (Validator)');
                });
            } catch (\Throwable $e) {
                Log::warning('validator alert email failed', ['to' => $to, 'err' => $e->getMessage()]);
            }
        }

        // 2) WhatsApp (CallMeBot) — ALERT_WHATSAPP_PHONE + ALERT_WHATSAPP_APIKEY ayarlıysa.
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
                Log::warning('validator alert whatsapp failed', ['err' => $e->getMessage()]);
            }
        }

        // 3) Log (her hâlükârda kayıt)
        Log::error('VALIDATOR ALERT: '.str_replace("\n", ' ', $msg));
    }
}
