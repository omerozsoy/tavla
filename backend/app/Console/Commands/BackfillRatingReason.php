<?php

namespace App\Console\Commands;

use App\Models\MatchResult;
use App\Models\Room;
use App\Support\RatingPolicy;
use App\Support\StatsConfig;
use Illuminate\Console\Command;

/**
 * Geçmiş PUANSIZ maç satırlarına rating_reason'ı (bot|unrated|guest|friendly|casual) doldurur. Kolon
 * 2026-11-02'de eklendi -> ÖNCEKİ satırlarda NULL. Yalnız rated=false + rating_reason NULL satırlar
 * hedeflenir (puanlı satır NULL kalmalı -> dokunulmaz). Oda hâlâ varsa KESİN (RatingPolicy::unratedReason);
 * oda purge edildiyse satır alanlarından TÜRETİLİR (match_type='ai'->bot; rakip hesapsız->guest; else
 * friendly). Idempotent + resumable (whereNull + chunkById): yarıda kesilirse relaunch kaldığı yerden.
 *
 *   php artisan tavla:backfill-rating-reason [--chunk=500] [--dry-run]
 */
class BackfillRatingReason extends Command
{
    protected $signature = 'tavla:backfill-rating-reason {--chunk=500} {--dry-run}';

    protected $description = 'Geçmiş puansız maçlara rating_reason doldurur (oda varsa kesin, yoksa türetilir)';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $chunk = max(50, (int) $this->option('chunk'));

        $q = MatchResult::query()->where('rated', false)->whereNull('rating_reason');
        $total = (clone $q)->count();
        $this->info(($dry ? '[DRY] ' : '')."Hedef: $total puansız + rating_reason NULL satır (chunk=$chunk)");
        if ($total === 0) {
            return self::SUCCESS;
        }

        $done = 0;
        $byReason = [];
        // YALNIZ gerekli kolonlar: log/gnubg_review gibi dev JSON kolonlarını YÜKLEME (500 satır × büyük
        // JSON = OOM). id chunkById için şart.
        $q->select(['id', 'room_code', 'opponent_user_id', 'match_type'])
            ->orderBy('id')->chunkById($chunk, function ($rows) use (&$done, &$byReason, $dry) {
            // Oda context'ini TOPLU yükle (N+1 yok): bu chunk'taki kodlar.
            $codes = $rows->pluck('room_code')->filter()->unique()->values()->all();
            $rooms = $codes
                ? Room::whereIn('code', $codes)->get(['code', 'bot', 'unrated', 'mode'])->keyBy('code')
                : collect();

            foreach ($rows as $r) {
                $room = $r->room_code ? $rooms->get($r->room_code) : null;
                if ($room) {
                    $reason = RatingPolicy::unratedReason($room, (int) $r->opponent_user_id); // KESİN
                } elseif ($r->match_type === StatsConfig::MATCH_TYPE_AI) {
                    $reason = 'bot'; // oda yok ama tür AI -> bota karşı
                } elseif ((int) $r->opponent_user_id <= 0) {
                    $reason = 'guest'; // rakip hesapsız (misafir)
                } else {
                    $reason = 'friendly'; // oda purge -> insan-insan puansız (en olası: arkadaş/davet)
                }

                $byReason[$reason] = ($byReason[$reason] ?? 0) + 1;
                $done++;
                if (! $dry) {
                    MatchResult::where('id', $r->id)->update(['rating_reason' => $reason]);
                }
            }
        });

        $this->info(($dry ? '[DRY] ' : '').'Dolduruldu: '.$done);
        foreach ($byReason as $reason => $n) {
            $this->line("  $reason: $n");
        }

        return self::SUCCESS;
    }
}
