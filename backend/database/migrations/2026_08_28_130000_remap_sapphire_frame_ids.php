<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// 5 Safir cerceve -> 210 cerceve (42 animasyon x 5 renk) gecisinde id semasi degisti
// (sapphire-<motion> -> <motion>-sapphire). Kullanicilarin takili/satin aldigi eski id'leri
// yeni id'lere esle ki cerceveler boste kalmasin.
return new class extends Migration
{
    private array $map = [
        'sapphire-pulse' => 'pulse-sapphire',
        'sapphire-heartbeat' => 'heartbeat-sapphire',
        'sapphire-glow' => 'glowPulse-sapphire',
        'sapphire-pendulum' => 'pendulum-sapphire',
        'sapphire-neon' => 'neonPulse-sapphire',
    ];

    public function up(): void
    {
        // Takili cerceve (avatar_frame)
        foreach ($this->map as $old => $new) {
            DB::table('users')->where('avatar_frame', $old)->update(['avatar_frame' => $new]);
        }

        // Satin alinanlar (unlocks JSON: 'frame.<old>' -> 'frame.<new>')
        foreach (DB::table('users')->select('id', 'unlocks')->get() as $row) {
            $unlocks = json_decode($row->unlocks ?? '[]', true);
            if (! is_array($unlocks)) {
                continue;
            }
            $changed = false;
            $unlocks = array_map(function ($x) use (&$changed) {
                if (is_string($x) && str_starts_with($x, 'frame.')) {
                    $id = substr($x, 6);
                    if (isset($this->map[$id])) {
                        $changed = true;

                        return 'frame.'.$this->map[$id];
                    }
                }

                return $x;
            }, $unlocks);
            if ($changed) {
                DB::table('users')->where('id', $row->id)->update(['unlocks' => json_encode(array_values($unlocks))]);
            }
        }
    }

    public function down(): void
    {
        // Geri alinamaz.
    }
};
