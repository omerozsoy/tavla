<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Eski avatar cerceveleri (24 frame + bronze/silver/gold/neon/fire) tamamen kaldirildi.
// Kullanicilarin sahip oldugu/secili eski cerceveleri temizle: avatar_frame -> null,
// unlocks JSON'undan tum 'frame.*' girdilerini cikar (theme.* korunur).
return new class extends Migration
{
    public function up(): void
    {
        // Secili cerceveyi sifirla (eski id'ler artik yok)
        DB::table('users')->whereNotNull('avatar_frame')->update(['avatar_frame' => null]);

        // unlocks JSON'undan frame.* girdilerini cikar
        foreach (DB::table('users')->select('id', 'unlocks')->get() as $row) {
            $unlocks = json_decode($row->unlocks ?? '[]', true);
            if (! is_array($unlocks) || $unlocks === []) {
                continue;
            }
            $filtered = array_values(array_filter($unlocks, fn ($x) => ! str_starts_with((string) $x, 'frame.')));
            if ($filtered !== $unlocks) {
                DB::table('users')->where('id', $row->id)->update(['unlocks' => json_encode($filtered)]);
            }
        }
    }

    public function down(): void
    {
        // Veri temizligi; geri alinamaz.
    }
};
