<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Kullanıcı isteği: "Şans Çarkı" (luckywheel) + "Zar Slotu" (diceslot) sol menüde GÖRÜNSÜN.
// Bu ikisi menu_items override tablosunda visible=false + group='compete' olarak duruyordu
// (eskiden sağ-üst bara taşınmış, sol menüden gizlenmişti). EĞLENCE (fun) grubunda görünür yap.
// pages.ts tarafında da inMenu:false kaldırıldı (ikisi birlikte gerekli).
return new class extends Migration {
    public function up(): void
    {
        DB::table('menu_items')
            ->whereIn('key', ['luckywheel', 'diceslot'])
            ->update(['visible' => true, 'group' => 'fun']);
    }

    public function down(): void
    {
        // Geri al: tekrar gizle (grup değişikliği bilinçli bırakılıyor).
        DB::table('menu_items')
            ->whereIn('key', ['luckywheel', 'diceslot'])
            ->update(['visible' => false]);
    }
};
