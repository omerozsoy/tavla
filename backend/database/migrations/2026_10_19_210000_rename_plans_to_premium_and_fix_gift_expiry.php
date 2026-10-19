<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// ÜYELİK SADELEŞTİRME (owner kararı 2026-10-19): tek ücretli tip = 'premium'. Eski 'star'/'starpro'
// değerleri SİSTEMDEN temizlenir -> 'premium'a taşınır (users + historik payments). AYRICA tüm mevcut
// premium üyelerin plan_until'ı 2 Ocak 2027 00:00'a çekilir: hediye üyelik dönemi burada biter, sonra
// herkes normal (free) üye olur ve Premium satın alır. Geri alınamaz (owner bilerek istedi).
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'plan')) {
            DB::table('users')->whereIn('plan', ['star', 'starpro'])->update(['plan' => 'premium']);
            // Tüm premium üyelerin süresi 2 Ocak 2027 00:00'da bitsin (hediye dönemi kapanışı).
            // Para ödeyenler dahil TÜM premium üyeler (owner "tüm üyeler" dedi).
            DB::table('users')->where('plan', 'premium')->update(['plan_until' => '2027-01-02 00:00:00']);
        }
        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'plan')) {
            DB::table('payments')->whereIn('plan', ['star', 'starpro'])->update(['plan' => 'premium']);
        }
    }

    public function down(): void
    {
        // Geri alınamaz (eski 'star'/'starpro' ayrımı ve orijinal plan_until tarihleri kaybolur) — no-op.
    }
};
