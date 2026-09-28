<?php

namespace App\Console\Commands;

use App\Models\Commission;
use App\Models\MatchMove;
use App\Models\MatchResult;
use App\Models\Room;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TEK MAÇ DÖKÜMÜ ("bu maçta ne olmuş?"). Oda + match_results + komisyon + cüzdan hareketleri +
 * sunucu hamle kaydı (küp/oyun sonları + son hamleler) tek çıktıda. Salt-okunur.
 *
 * Kullanım (SUNUCUDA):
 *   php artisan tavla:match WW2KU
 *   php artisan tavla:match WW2KU --moves=20   # son 20 hamle
 */
class MatchInspect extends Command
{
    protected $signature = 'tavla:match {code : Maç/oda kodu} {--moves=8 : Gösterilecek son hamle sayısı}';

    protected $description = 'Bir maçın oda, sonuç, bahis/komisyon, cüzdan ve hamle kayıtlarını tek çıktıda döker (salt-okunur).';

    public function handle(): int
    {
        $code = strtoupper(trim((string) $this->argument('code')));
        $this->line("=== MAÇ {$code} ===");

        // 1) Oda
        $room = Room::where('code', $code)->first();
        $this->line('');
        $this->line('--- ODA ---');
        if (! $room) {
            $this->warn('rooms satırı yok (reap edilmiş / eski maç olabilir). Diğer kayıtlara bakılıyor.');
        } else {
            $cols = ['id', 'status', 'end_reason', 'mode', 'target', 'stake', 'bet_pct', 'time_control', 'bot', 'bot_level',
                'p1_user_id', 'p1_name', 'p2_user_id', 'p2_name', 'p1_result', 'p2_result', 'server_winner',
                'settled', 'escrowed', 'authoritative', 'version', 'rematch_code', 'created_at', 'updated_at'];
            foreach ($cols as $c) {
                $v = $room->getAttribute($c);
                if (is_array($v) || is_object($v)) {
                    $v = json_encode($v, JSON_UNESCAPED_UNICODE);
                }
                $this->line(sprintf('  %-14s: %s', $c, $v === null ? 'null' : (is_bool($v) ? ($v ? 'true' : 'false') : $v)));
            }
            $sm = $room->server_match;
            if ($sm) {
                $this->line('  server_match  : '.(is_string($sm) ? $sm : json_encode($sm, JSON_UNESCAPED_UNICODE)));
            }
        }

        // 2) Sonuç satırları
        $this->line('');
        $this->line('--- MATCH_RESULTS ---');
        $results = MatchResult::where('room_code', $code)->orderBy('id')->get();
        if ($results->isEmpty()) {
            $this->warn('  sonuç satırı YOK');
        } else {
            $this->table(
                ['id', 'user', 'won', 'skor', 'delta', 'rated', 'type', 'pr', 'luck', 'created'],
                $results->map(fn ($r) => [
                    $r->id, $r->user_id, $r->won ? 'W' : 'L', "{$r->score_self}-{$r->score_opp}", $r->delta,
                    $r->rated ? 'y' : 'n', $r->match_type, $r->pr, $r->luck, $r->created_at,
                ])->all()
            );
        }

        // 3) Komisyon + cüzdan
        $this->line('');
        $this->line('--- KOMİSYON ---');
        $com = Commission::where('room_code', $code)->get();
        $com->isEmpty() ? $this->line('  yok')
            : $com->each(fn ($c) => $this->line("  winner={$c->winner_id} loser={$c->loser_id} stake={$c->stake} komisyon={$c->commission} (%{$c->pct}) {$c->created_at}"));

        if ($room && Schema::hasTable('wallet_transactions')) {
            $this->line('');
            $this->line('--- CÜZDAN HAREKETLERİ ---');
            $tx = DB::table('wallet_transactions')->where('reference_type', Room::class)->where('reference_id', $room->id)->orderBy('id')->get();
            $tx->isEmpty() ? $this->line('  yok')
                : $this->table(array_keys((array) $tx->first()), $tx->map(fn ($t) => array_map(
                    fn ($v) => is_string($v) && strlen($v) > 60 ? substr($v, 0, 57).'...' : $v, (array) $t
                ))->all());
        }

        // 4) Sunucu hamle kaydı
        $this->line('');
        $this->line('--- HAMLELER (match_moves) ---');
        if (! Schema::hasTable('match_moves')) {
            $this->line('  tablo yok');

            return self::SUCCESS;
        }
        $total = MatchMove::where('room_code', $code)->count();
        $this->line("  toplam kayıt: {$total}");
        if ($total > 0) {
            $events = MatchMove::where('room_code', $code)->whereIn('kind', ['double', 'take', 'drop', 'end'])->orderBy('id')->get();
            $this->line('  küp / oyun sonu olayları:');
            $events->isEmpty() ? $this->line('    yok')
                : $this->table(['oyun', 'tur', 'oyuncu', 'tür', 'küp', 'puan', 'kazanan', 'zaman'],
                    $events->map(fn ($m) => [$m->game_no, $m->seq, $m->player, $m->kind, $m->cube_value, $m->points, $m->winner, $m->created_at])->all());

            $n = max(1, (int) $this->option('moves'));
            $this->line("  son {$n} kayıt:");
            $last = MatchMove::where('room_code', $code)->orderByDesc('id')->limit($n)->get()->reverse();
            $this->table(['oyun', 'tur', 'oyuncu', 'tür', 'zar', 'hamle', 'zaman'],
                $last->map(fn ($m) => [$m->game_no, $m->seq, $m->player, $m->kind, $m->dice ? implode('-', $m->dice) : '', $m->notation, $m->created_at])->all());
        }

        return self::SUCCESS;
    }
}
