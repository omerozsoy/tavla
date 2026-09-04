<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Oynanan bir maçın hamle+zar kaydı. Bkz. migration create_game_logs_table.
 * Turlar p1_events/p2_events JSON dizilerinde tutulur; admin görünümü birleştirir.
 */
class GameLog extends Model
{
    protected $fillable = [
        'uid',
        'mode',
        'target',
        'p1_name',
        'p2_name',
        'p1_user_id',
        'p2_user_id',
        'status',
        'winner',
        'score',
        'p1_events',
        'p2_events',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'array',
            'p1_events' => 'array',
            'p2_events' => 'array',
        ];
    }

    /**
     * İki oyuncunun turlarını (g, s, o) sırasına göre TEK zaman çizelgesinde birleştirir.
     * o = aynı seq içinde ikincil sıra (kup<hamle<bitiş). Oyun sonu (k='end') olayları iki
     * istemci de yazabildiği için oyun başına TEKİLLEŞTİRİLİR.
     * Dönen: [['g'=>1,'s'=>0,'p'=>'W','d'=>'6-5','m'=>'24/18 13/8','k'=>null], ...]
     */
    public function mergedTurns(): array
    {
        $turns = array_merge(
            is_array($this->p1_events) ? $this->p1_events : [],
            is_array($this->p2_events) ? $this->p2_events : [],
        );
        usort($turns, function ($a, $b) {
            $ga = (int) ($a['g'] ?? 0);
            $gb = (int) ($b['g'] ?? 0);
            if ($ga !== $gb) {
                return $ga <=> $gb;
            }
            $sa = (int) ($a['s'] ?? 0);
            $sb = (int) ($b['s'] ?? 0);
            if ($sa !== $sb) {
                return $sa <=> $sb;
            }

            return (int) ($a['o'] ?? 0) <=> (int) ($b['o'] ?? 0);
        });

        // Oyun sonu olaylarını oyun başına tekilleştir (iki istemci de yazmış olabilir).
        $seenEnd = [];
        $out = [];
        foreach ($turns as $t) {
            if (($t['k'] ?? null) === 'end') {
                $g = (int) ($t['g'] ?? 0);
                if (isset($seenEnd[$g])) {
                    continue;
                }
                $seenEnd[$g] = true;
            }
            $out[] = $t;
        }

        return $out;
    }
}
