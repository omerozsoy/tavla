<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// StarPRO kademesi kaldırıldı (kullanılmayan placeholder; Star ile birebir aynıydı). Mevcut
// 'starpro' kullanıcıları 'star'a taşınır -> premium ayrıcalıkları KORUNUR (süre/plan_until aynı).
// Historik payments.plan='starpro' satırları da 'star' yapılır (yeniden finalize edilirse tutarlı).
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'plan')) {
            DB::table('users')->where('plan', 'starpro')->update(['plan' => 'star']);
        }
        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'plan')) {
            DB::table('payments')->where('plan', 'starpro')->update(['plan' => 'star']);
        }
    }

    public function down(): void
    {
        // Geri alınamaz (starpro artık tanımlı değil) — no-op.
    }
};
