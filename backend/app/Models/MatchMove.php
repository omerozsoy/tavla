<?php

namespace App\Models;

use App\Support\MatSerializer;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

/**
 * SUNUCU-OTORİTER HAMLE GEÇMİŞİ. RoomController her doğrulanan hamle/küp/oyun-sonu için bir satır
 * yazar (append-only). .mat / luck / PR bu TEK GERÇEK kaynaktan kurulur — istemci loguna bağımlı
 * DEĞİL (istemci reload/disconnect'te veri kaybı -> "olmayan hamle"/yarım oyun/sonuçsuz maç KÖKTEN
 * biter). Bkz. migration 2026_09_27_180000_create_match_moves_table.
 */
class MatchMove extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'dice' => 'array',
        'steps' => 'array',
        'pos' => 'array',
        'mctx' => 'array',
    ];

    /** Bu room için sunucu-kaydı VAR mı? (yeni maçlar; eski maçlar client-log fallback'ine düşer.) */
    public static function existsForRoom(string $roomCode): bool
    {
        // Tablo yoksa (deploy öncesi pencere / migrate koşmadı) sessizce false -> client-log fallback.
        if (! Schema::hasTable('match_moves')) {
            return false;
        }

        return static::where('room_code', strtoupper($roomCode))->exists();
    }

    /** Kanonik sıra (oyun -> tur -> aynı-tur-ord -> ekleme sırası). */
    private static function orderedForRoom(string $roomCode)
    {
        return static::where('room_code', strtoupper($roomCode))
            ->orderBy('game_no')->orderBy('seq')->orderBy('ord')->orderBy('id')
            ->get();
    }

    /**
     * PR/analiz için MoveLogEntry-benzeri dizi (AnalyzeMatchPrJob checkerPr/cubePr girdisi ile aynı
     * şekil): her move -> pos+dice+notation+playedSteps; her küp -> cube.chosen. 'end' atlanır.
     *
     * @return list<array<string,mixed>>
     */
    public static function buildLog(string $roomCode): array
    {
        $out = [];
        foreach (self::orderedForRoom($roomCode) as $r) {
            if ($r->kind === 'move') {
                $out[] = [
                    'player' => $r->player,
                    'seq' => (int) $r->seq,
                    'dice' => $r->dice ?? [],
                    'notation' => (string) ($r->notation ?? ''),
                    'pos' => $r->pos,
                    'steps' => $r->steps ?? [],
                    'playedSteps' => $r->steps ?? [],
                    'mctx' => $r->mctx,
                    'countsForPR' => true,
                ];
            } elseif (in_array($r->kind, ['double', 'take', 'drop'], true)) {
                $out[] = [
                    'player' => $r->player,
                    'seq' => (int) $r->seq,
                    'cube' => ['chosen' => $r->kind],
                    'pos' => $r->pos,
                    'mctx' => $r->mctx,
                ];
            }
        }

        return $out;
    }

    /**
     * gnubg NATIVE .mat (MatSerializer 'gnubg' ile) — .mat indirmesi + luck kaynağı. Oyunlar
     * game_no ile bölünür; sonuç 'end' satırından (winner+points+cube) — bear-off/drop/resign/timeout
     * HEPSİ applyGameResult'ta 'end' yazdığından her oyun sonuçlanır (yarım-oyun sınırı YOK).
     *
     * @param  array{matchLength?:int,whiteName?:string,blackName?:string}  $opts
     */
    public static function buildMat(string $roomCode, array $opts = []): string
    {
        $rows = self::orderedForRoom($roomCode);
        $games = [];
        foreach ($rows as $r) {
            $g = (int) $r->game_no;
            $games[$g] ??= [];
            $games[$g][] = $r;
        }

        $model = [];
        foreach ($games as $rows) {
            $raw = [];
            $outcome = null;
            foreach ($rows as $r) {
                if ($r->kind === 'move') {
                    $raw[] = ['kind' => 'move', 'player' => $r->player, 'dice' => $r->dice ?? [], 'notation' => (string) ($r->notation ?? '')];
                } elseif (in_array($r->kind, ['double', 'take', 'drop'], true)) {
                    $raw[] = ['kind' => $r->kind, 'player' => $r->player];
                } elseif ($r->kind === 'end' && $r->winner) {
                    $outcome = ['winner' => $r->winner, 'points' => (int) $r->points, 'cube' => (int) $r->cube_value];
                }
            }
            $model[] = ['acts' => MatSerializer::pairCube($raw), 'outcome' => $outcome];
        }

        return MatSerializer::render($model, [
            'dialect' => 'gnubg',
            'matchLength' => max(1, (int) ($opts['matchLength'] ?? 1)),
            'whiteName' => $opts['whiteName'] ?? 'White',
            'blackName' => $opts['blackName'] ?? 'Black',
        ]);
    }
}
