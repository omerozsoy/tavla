<?php

namespace App\Support;

use App\Jobs\AnalyzeMatchLuckJob;
use App\Jobs\AnalyzeMatchPrJob;
use App\Models\MatchMove;
use App\Models\MatchResult;
use App\Models\Room;
use Illuminate\Support\Facades\Log;

/**
 * SUNUCU-OTORİTER MAÇ SONLANDIRMA (anında).
 *
 * Kök sorun: maç bitince PR/şans YALNIZ raporlayan oyuncu için anında hesaplanıyordu; rakibin
 * satırı + analizi 5 dk'lık backstop + 15 dk'lık heal cron'larını bekliyordu -> oyuncu sonucu
 * saniyeler içinde açınca "rakibin PR'i yok / luck boş" görüyordu (sonra doluyordu).
 *
 * Çözüm: Maç terminal olur olmaz (bir oyuncu reportRating çağırınca VEYA terk/timeout finalize'ında)
 *   1) HER İKİ oyuncunun match_results satırını SUNUCUDA aç (MatchBackstop — idempotent, bare satır),
 *   2) eksik PR/şansı SUNUCU kaydından (match_moves) ANINDA kuyruğa al.
 * Analiz kaynağı match_moves'tir (istemci log'u DEĞİL) -> tam sunucu-otoriter. Idempotent +
 * best-effort: asla çağıran akışı (rapor/terk yanıtını) kırmaz.
 */
class MatchFinalize
{
    /** Yazılan (backstop ile açılan) eksik satır sayısını döndürür (cron raporu için). */
    public static function run(?Room $room): int
    {
        if (! $room || empty($room->code)) {
            return 0;
        }
        // Prompt finalize YALNIZ sunucu-otoriter modda çalışır: PR/şans match_moves'tan hesaplanır,
        // rakibin istemci raporuna İHTİYAÇ YOK -> bare satırı erken açmak güvenli. shadow/off modda
        // istemci raporu (log/pr/luck) hâlâ gerekli; erken ensure onu reddeder -> ESKİ akış + cron
        // backstop bırak (yalnız authoritative'de erken müdahale et).
        if ((string) config('gnubg.pr_mode', 'off') !== 'authoritative') {
            return 0;
        }
        $written = 0;
        try {
            // 1) Eksik oyuncu satırlarını SUNUCUDA tamamla (bot odası ensure içinde atlanır).
            $written = MatchBackstop::ensure($room);

            // 2) PR + şans analizini SUNUCU kaydından (match_moves) tetikle — yalnız eksik alan için.
            $hasMoves = MatchMove::existsForRoom($room->code);
            $rows = MatchResult::where('room_code', $room->code)->get(['id', 'gnubg_pr', 'gnubg_pr_at', 'luck_mwc', 'luck_method', 'log']);
            foreach ($rows as $r) {
                // Kaynak gerekir: istemci log'u VEYA sunucu hamleleri (match_moves). İkisi de yoksa atla.
                if (empty($r->log) && ! $hasMoves) {
                    continue;
                }
                // PR: hiç denenmemişse (gnubg_pr_at NULL) kuyruğa al. (Mezar taşı varsa döngü kurma.)
                if ($r->gnubg_pr === null && $r->gnubg_pr_at === null) {
                    AnalyzeMatchPrJob::dispatch($r->id)->onConnection('database');
                }
                // Şans: boş ve karantina (UNAVAILABLE) değilse kuyruğa al.
                if ($r->luck_mwc === null && $r->luck_method !== 'TAVLAI_LUCK_UNAVAILABLE') {
                    AnalyzeMatchLuckJob::dispatch($r->id)->onConnection('database');
                }
            }
        } catch (\Throwable $e) {
            Log::warning('MatchFinalize hata (yok sayildi)', ['room' => $room->code ?? null, 'err' => $e->getMessage()]);
        }

        return $written;
    }
}
