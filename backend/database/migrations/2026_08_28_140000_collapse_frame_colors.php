<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// 210 cerceve (42 anim x 5 renk) -> 42 cerceve (anim basina tek, rarity renkli).
// Eski id 'frame.<motion>-<color>' -> 'frame.<motion>'. Sahiplik/takili cerceve korunur.
return new class extends Migration
{
    private array $colors = ['rose', 'sapphire', 'emerald', 'gold', 'amethyst'];

    // Sondaki '-<renk>' ekini soy (yoksa aynen dondur)
    private function strip(string $id): string
    {
        foreach ($this->colors as $c) {
            if (str_ends_with($id, '-'.$c)) {
                return substr($id, 0, -1 * (strlen($c) + 1));
            }
        }

        return $id;
    }

    public function up(): void
    {
        // Takili cerceve (avatar_frame)
        foreach (DB::table('users')->select('id', 'avatar_frame')->whereNotNull('avatar_frame')->get() as $row) {
            $new = $this->strip($row->avatar_frame);
            if ($new !== $row->avatar_frame) {
                DB::table('users')->where('id', $row->id)->update(['avatar_frame' => $new]);
            }
        }

        // Satin alinanlar (unlocks JSON): 'frame.<motion>-<color>' -> 'frame.<motion>', tekillestir
        foreach (DB::table('users')->select('id', 'unlocks')->get() as $row) {
            $unlocks = json_decode($row->unlocks ?? '[]', true);
            if (! is_array($unlocks)) {
                continue;
            }
            $changed = false;
            $out = [];
            foreach ($unlocks as $x) {
                if (is_string($x) && str_starts_with($x, 'frame.')) {
                    $id = substr($x, 6);
                    $stripped = $this->strip($id);
                    if ($stripped !== $id) {
                        $changed = true;
                    }
                    $x = 'frame.'.$stripped;
                }
                if (! in_array($x, $out, true)) {
                    $out[] = $x;
                } else {
                    $changed = true; // ayni cerceveyi birden fazla renk aldiysa tekile in
                }
            }
            if ($changed) {
                DB::table('users')->where('id', $row->id)->update(['unlocks' => json_encode(array_values($out))]);
            }
        }
    }

    public function down(): void
    {
        // Geri alinamaz (renk bilgisi kaybolur).
    }
};
