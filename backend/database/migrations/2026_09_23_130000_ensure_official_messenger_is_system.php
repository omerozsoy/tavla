<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Resmi hesabın ("Tavla TV Yönetim", yonetim@sistem.tavlatv) is_system bayrağını KESİN 1 yapar.
 *
 * SORUN: Canlıda hesap oyuncu listelerinden (liderlik/top-3/çevrimiçi) gizlenmiyordu; çünkü
 * is_system=false filtresi çalışması için değerin 1 olması gerek ama bazı durumlarda 0/null
 * kalmış olabiliyor (hesap kolon eklenmeden önce oluşmuş, ya da eski satır). Bu idempotent
 * migration e-posta ile hedefleyip is_system=1 yapar (zaten 1 ise no-op).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'is_system')) {
            return;
        }
        DB::table('users')
            ->where('email', 'yonetim@sistem.tavlatv')
            ->update(['is_system' => true]);
    }

    public function down(): void
    {
        // Geri alınmaz (gizleme davranışını bozar).
    }
};
