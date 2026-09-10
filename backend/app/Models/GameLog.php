<?php

namespace App\Models;

use App\Support\MatFromLog;
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

        // TEKİLLEŞTİRME. Artık her istemci RAKİBİN hamlelerini de kendi kolonuna yazabildiği
        // için (tek flush'ta tam .mat), iki kolon aynı turu içerebilir:
        //  - Oyun sonu (k='end'): oyun (g) başına tekilleştir (seq iki istemcide farklı olabilir).
        //  - Hamle/küp: (g, s, o) ile tekilleştir — bu üçlü bir turu BENZERSİZ belirler (seq=ortak
        //    sıra; o aynı seq'te küp<hamle ayrımı). Boş 'm' yerine dolu kaydı tercih et.
        $seenEnd = [];
        $byKey = [];
        $out = [];
        foreach ($turns as $t) {
            if (($t['k'] ?? null) === 'end') {
                $g = (int) ($t['g'] ?? 0);
                if (isset($seenEnd[$g])) {
                    continue;
                }
                $seenEnd[$g] = true;
                $out[] = $t;

                continue;
            }
            $key = (int) ($t['g'] ?? 0).':'.(int) ($t['s'] ?? 0).':'.(int) ($t['o'] ?? 0);
            if (isset($byKey[$key])) {
                $i = $byKey[$key];
                if (($out[$i]['m'] ?? '') === '' && ($t['m'] ?? '') !== '') {
                    $out[$i] = $t; // daha bilgili (dolu hamle) kaydı koru
                }

                continue;
            }
            $byKey[$key] = count($out);
            $out[] = $t;
        }

        return $out;
    }

    /**
     * Bu maçın XG-uyumlu .mat metni (kompakt turlardan üretilir; HER modda tam çalışır).
     * Yönetim panelinde önizleme + indirme kaynağı.
     */
    public function matText(): string
    {
        return MatFromLog::build($this->mergedTurns(), [
            'whiteName' => $this->p1_name ?: 'Player1',
            'blackName' => $this->p2_name ?: 'Player2',
            'matchLength' => max(1, (int) ($this->target ?? 1)),
            'matchId' => (string) $this->uid,
            'eventDate' => optional($this->created_at)->format('Y.m.d') ?? '',
            'eventTime' => optional($this->created_at)->format('H.i') ?? '',
        ]);
    }

    /** İndirme dosya adı: <oyuncu1>_<oyuncu2>_<GG-AA-YYYY>_<oyunid>.mat (nokta yok; ext hariç). */
    public function matFilename(): string
    {
        $clean = static function (?string $s, string $fb): string {
            $s = str_replace(' ', '', (string) ($s ?? ''));
            // Nokta/güvensiz karakterleri at; harf/rakam/_/- kalır (Türkçe harfler korunur).
            $s = preg_replace('/[^\p{L}\p{N}_-]/u', '', $s) ?? '';

            return $s !== '' ? $s : $fb;
        };
        $p1 = $clean($this->p1_name, 'Player1');
        $p2 = $clean($this->p2_name, 'Player2');
        $date = optional($this->created_at)->format('d-m-Y');
        $id = preg_replace('/[^A-Za-z0-9_-]/', '', (string) $this->uid) ?: 'mac';
        $parts = array_filter([$p1, $p2, $date, $id]);

        return implode('_', $parts).'.mat';
    }

    /**
     * Bu maça bağlı sonuç kayıtları (PR / şans / puan / bahis). Online'da uid == room_code
     * ile eşleşir (her oyuncu için bir satır). pvb/local'de bağ yoktur -> boş döner.
     */
    public function relatedResults()
    {
        if ($this->mode !== 'online' || empty($this->uid)) {
            return collect();
        }

        return MatchResult::where('room_code', $this->uid)
            ->with(['user', 'room'])
            ->orderBy('id')
            ->get();
    }
}
