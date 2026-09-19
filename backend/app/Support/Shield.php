<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Güvenlik Kalkanı çekirdeği. Her /api isteği (yanıt üretildikten SONRA) buraya düşer;
 * istek sahibinin canlı durumunu (shield_presence) günceller, anomali eşiği aşılınca
 * shield_events'e olay yazar ve ciddi durumlarda Alert (e-posta/WhatsApp) tetikler.
 *
 * Tamamen savunma amaçlı + istek akışını ASLA bozmaz: her şey try/catch ile sarılıdır
 * ve tablolar yoksa (deploy öncesi) sessizce atlanır.
 */
class Shield
{
    // Oturum: son istekten bu kadar saniye geçtiyse YENİ oturum (sayaçlar sıfırlanır).
    private const SESSION_GAP = 1800; // 30 dk

    private const WINDOW = 60;        // istek/dk penceresi (sn)

    // İstek/dk eşikleri (kullanıcı+IP başına).
    private const RATE_WARN = 120;
    private const RATE_DANGER = 240;

    // Oturum başına hata (4xx/5xx) eşikleri.
    private const ERR_WARN = 15;
    private const ERR_DANGER = 40;

    // Oturum başına çark+slot çevirme eşikleri.
    private const SPIN_WARN = 60;
    private const SPIN_DANGER = 150;

    private static ?bool $ready = null;

    /** İstek işlenip yanıt üretildikten sonra çağrılır. Asla exception fırlatmaz. */
    public static function record(Request $request, int $status): void
    {
        try {
            if (! self::tablesReady()) {
                return;
            }

            $method = $request->getMethod();
            if ($method === 'OPTIONS') {
                return; // CORS preflight — gürültü
            }

            $path = $request->path();                 // ör: "api/lucky-wheel/spin"
            $uri = rawurldecode($request->getRequestUri()); // yol + query (tarama tespiti için)
            $user = $request->user();
            $userId = $user?->getKey();
            $ip = (string) $request->ip();
            $subject = $userId ? "u:{$userId}" : "ip:{$ip}";
            $ua = mb_substr((string) $request->userAgent(), 0, 255);
            $now = now();
            $nowTs = $now->getTimestamp();

            $isErr = $status >= 400;
            $isSpin = self::isSpin($path);
            $isSusp = self::suspiciousPath($uri);
            $adminProbe = str_starts_with($path, 'api/admin') && $status === 403;
            $bannedHit = $user && $user->banned_at !== null;

            $prev = DB::table('shield_presence')->where('subject', $subject)->first();

            $continuing = $prev
                && $prev->last_seen_at
                && ($nowTs - strtotime($prev->last_seen_at) < self::SESSION_GAP);

            $sessionStart = $continuing ? $prev->session_started_at : $now;
            $reqCount = ($continuing ? (int) $prev->req_count : 0) + 1;
            $errCount = ($continuing ? (int) $prev->err_count : 0) + ($isErr ? 1 : 0);
            $spinCount = ($continuing ? (int) $prev->spin_count : 0) + ($isSpin ? 1 : 0);
            $suspCount = ($continuing ? (int) $prev->susp_count : 0) + (($isSusp || $adminProbe) ? 1 : 0);

            // --- İstek/dk penceresi ---
            $winStart = $continuing ? $prev->win_started_at : $now;
            $winCount = ($continuing ? (int) $prev->win_count : 0);
            $rateMax = $continuing ? (int) $prev->rate_max : 0;
            $rateTier = $continuing ? (int) $prev->rate_tier : 0;
            $errTier = $continuing ? (int) $prev->err_tier : 0;
            $spinTier = $continuing ? (int) $prev->spin_tier : 0;

            $rateEventTier = null;
            if ($winStart && ($nowTs - strtotime($winStart) >= self::WINDOW)) {
                // Pencere doldu: biten pencerenin sayımını değerlendirip yenisini başlat.
                $finalRate = $winCount;
                $rateMax = max($rateMax, $finalRate);
                $winStart = $now;
                $winCount = 1;
            } else {
                $winCount++;
            }
            // Pencere içi ANLIK patlama da yakalansın (60sn dolmadan eşik aşılırsa).
            $rateMax = max($rateMax, $winCount);
            $liveTier = $winCount >= self::RATE_DANGER ? 2 : ($winCount >= self::RATE_WARN ? 1 : 0);
            if ($liveTier > $rateTier) {
                $rateEventTier = $liveTier;
                $rateTier = $liveTier;
            }

            // --- Hata / spin kademeleri (yalnızca kademe YÜKSELİNCE olay üret) ---
            $eTier = $errCount >= self::ERR_DANGER ? 2 : ($errCount >= self::ERR_WARN ? 1 : 0);
            $errEventTier = $eTier > $errTier ? $eTier : null;
            $errTier = max($errTier, $eTier);

            $sTier = $spinCount >= self::SPIN_DANGER ? 2 : ($spinCount >= self::SPIN_WARN ? 1 : 0);
            $spinEventTier = $sTier > $spinTier ? $sTier : null;
            $spinTier = max($spinTier, $sTier);

            // --- Risk skoru (0-100) ---
            $risk = 0;
            $risk += $rateTier === 2 ? 40 : ($rateTier === 1 ? 20 : ($rateMax >= 60 ? 8 : 0));
            $risk += $errTier === 2 ? 25 : ($errTier === 1 ? 12 : ($errCount >= 5 ? 4 : 0));
            $risk += $spinTier === 2 ? 20 : ($spinTier === 1 ? 10 : 0);
            $risk += min(50, $suspCount * 50);
            if ($bannedHit) {
                $risk += 30;
            }
            $risk = min(100, $risk);

            $payload = [
                'user_id' => $userId,
                'ip' => $ip,
                'user_agent' => $ua,
                'last_path' => mb_substr($path, 0, 191),
                'last_method' => $method,
                'last_status' => $status,
                'last_seen_at' => $now,
                'session_started_at' => $sessionStart,
                'req_count' => $reqCount,
                'err_count' => $errCount,
                'spin_count' => $spinCount,
                'susp_count' => $suspCount,
                'win_started_at' => $winStart,
                'win_count' => $winCount,
                'rate_max' => $rateMax,
                'rate_tier' => $rateTier,
                'err_tier' => $errTier,
                'spin_tier' => $spinTier,
                'risk' => $risk,
                'updated_at' => $now,
            ];

            if ($prev) {
                DB::table('shield_presence')->where('subject', $subject)->update($payload);
            } else {
                DB::table('shield_presence')->insert($payload + [
                    'subject' => $subject,
                    'created_at' => $now,
                ]);
            }

            // --- Olaylar ---
            if ($rateEventTier !== null) {
                self::event($userId, $ip, 'rate_burst', $rateEventTier + 1, $path, $method, $status,
                    "≈{$winCount}/dk istek");
            }
            if ($errEventTier !== null) {
                self::event($userId, $ip, 'error_burst', $errEventTier + 1, $path, $method, $status,
                    "{$errCount} hata (oturum)");
            }
            if ($spinEventTier !== null) {
                self::event($userId, $ip, 'spin_burst', $spinEventTier + 1, $path, $method, $status,
                    "{$spinCount} çevirme (oturum)");
            }
            if ($isSusp && self::guard($subject, 'susp', 10)) {
                self::event($userId, $ip, 'suspicious_path', 3, $path, $method, $status, 'Şüpheli/tarama isteği');
            }
            if ($adminProbe && self::guard($subject, 'admin', 10)) {
                self::event($userId, $ip, 'admin_probe', 3, $path, $method, $status, 'Yetkisiz panel denemesi (403)');
            }
            if ($bannedHit && self::guard($subject, 'banned', 60)) {
                self::event($userId, $ip, 'banned_hit', 2, $path, $method, $status, 'Yasaklı hesap istek atıyor');
            }

            self::maybePrune();
        } catch (\Throwable $e) {
            // Güvenlik izleme, asıl istek akışını asla bozmaz.
        }
    }

    /** Çark/slot çevirme isteği mi? */
    public static function isSpin(string $path): bool
    {
        return str_contains($path, 'lucky-wheel/spin') || str_contains($path, 'dice-slot/spin');
    }

    /** Bilinen tarama/sömürü kalıpları (yol + query üzerinde, /api istekleri). */
    public static function suspiciousPath(string $uri): bool
    {
        return (bool) preg_match(
            '#(\.php($|[/?])|wp-(login|admin|content|includes)|/\.(env|git|aws|ssh|htaccess)'
            .'|phpmyadmin|adminer|/vendor/|/storage/logs|\.(sql|bak|old|zip|tar|gz|7z)($|\?)'
            .'|union\s+select|select.+from|information_schema|sleep\(|benchmark\(|/etc/passwd'
            .'|\.\./|%2e%2e|<script|onerror\s*=|base64_decode|eval\()#i',
            $uri
        );
    }

    /** İnsan-okunur risk kademesi: 0 normal, 1 şüpheli, 2 tehlike. */
    public static function riskTier(int $risk): int
    {
        return $risk >= 60 ? 2 : ($risk >= 30 ? 1 : 0);
    }

    private static function tablesReady(): bool
    {
        if (self::$ready === null) {
            try {
                self::$ready = Schema::hasTable('shield_presence') && Schema::hasTable('shield_events');
            } catch (\Throwable $e) {
                self::$ready = false;
            }
        }
        return self::$ready;
    }

    /** Aynı özne+tür için kısa süre içinde tek olay (spam engelle). */
    private static function guard(string $subject, string $type, int $seconds): bool
    {
        try {
            return Cache::add("shield:ev:{$subject}:{$type}", 1, now()->addSeconds($seconds));
        } catch (\Throwable $e) {
            return true;
        }
    }

    private static function event(?int $userId, ?string $ip, string $type, int $severity,
        string $path, string $method, int $status, string $detail): void
    {
        DB::table('shield_events')->insert([
            'user_id' => $userId,
            'ip' => $ip,
            'type' => $type,
            'severity' => $severity,
            'path' => mb_substr($path, 0, 191),
            'method' => $method,
            'status' => $status,
            'detail' => mb_substr($detail, 0, 255),
            'created_at' => now(),
        ]);

        // Ciddi (tehlike) olaylarda admin'e uyarı — özne başına 30 dk spam-limitli.
        if ($severity >= 3 && ! app()->environment('testing')) {
            $who = $userId ? "üye #{$userId}" : "IP {$ip}";
            $key = 'shield:alert:'.($userId ? "u:{$userId}" : "ip:{$ip}");
            try {
                if (Cache::add($key, 1, now()->addMinutes(30))) {
                    Alert::send(
                        "🛡️ Güvenlik Kalkanı: {$detail}\nKim: {$who}\nYol: {$method} /{$path} ({$status})",
                        'TavlaTV — Güvenlik Uyarısı'
                    );
                }
            } catch (\Throwable $e) {
                // uyarı, istek akışını bozmasın
            }
        }
    }

    /** Ara sıra eski kayıtları buda (istek başına ~1/400 olasılık). */
    private static function maybePrune(): void
    {
        if (mt_rand(1, 400) !== 1) {
            return;
        }
        try {
            DB::table('shield_events')->where('created_at', '<', now()->subDays(14))->delete();
            DB::table('shield_presence')->where('last_seen_at', '<', now()->subDays(2))->delete();
        } catch (\Throwable $e) {
        }
    }
}
