<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * "Tavla TV Yönetim" resmi hesabını (yonetim@sistem.tavlatv) id=1'e taşır — İSTEK ÜZERİNE.
 *
 * GÜVENLİK KURALLARI:
 *  - Yalnız MySQL'de çalışır (sqlite/test → no-op).
 *  - id=1 BAŞKA bir kullanıcıdaysa HİÇBİR ŞEY YAPMAZ (deploy'u bozmaz; log'a "id=1 dolu"
 *    yazar). Bu yüzden mevcut 1 numaralı hesabın üzerine YAZILMAZ.
 *  - id=1 boşsa: FK kontrolleri kapatılır, users.id + TÜM referans veren kolonlar
 *    (information_schema'daki formal FK'ler + FK'siz plain user kolonları) atomik güncellenir,
 *    sonra FK kontrolleri geri açılır.
 *
 * NOT: Veri taşımasıdır, geri alınamaz sayılır (down = no-op). ÇALIŞTIRMADAN ÖNCE DB YEDEĞİ ŞART.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return; // yalnız canlı MySQL; sqlite/test atlanır
        }

        $email = 'yonetim@sistem.tavlatv';
        $official = DB::table('users')->where('email', $email)->first(['id']);
        if (! $official) {
            Log::warning('[official->id1] Resmi hesap bulunamadı; atlandı.');
            return;
        }
        $old = (int) $official->id;
        if ($old === 1) {
            return; // zaten 1
        }

        if (DB::table('users')->where('id', 1)->exists()) {
            Log::warning("[official->id1] id=1 DOLU; resmi hesap (id={$old}) taşınmadı — güvenlik için atlandı.");
            return;
        }

        // users.id'ye referans veren TÜM formal FK kolonları (tablo, kolon).
        $fkCols = DB::select(
            'SELECT TABLE_NAME AS t, COLUMN_NAME AS c
               FROM information_schema.KEY_COLUMN_USAGE
              WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
                AND REFERENCED_TABLE_NAME = ?
                AND REFERENCED_COLUMN_NAME = ?',
            ['users', 'id']
        );

        // FK'siz (yalnız index'li) kullanıcı referansları — information_schema yakalamaz.
        $plain = [
            ['sessions', 'user_id'],
            ['bug_reports', 'user_id'],
            ['contact_messages', 'user_id'],
        ];

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        try {
            DB::transaction(function () use ($fkCols, $plain, $old) {
                foreach ($fkCols as $r) {
                    DB::table($r->t)->where($r->c, $old)->update([$r->c => 1]);
                }
                foreach ($plain as [$t, $c]) {
                    if (Schema::hasTable($t) && Schema::hasColumn($t, $c)) {
                        DB::table($t)->where($c, $old)->update([$c => 1]);
                    }
                }
                DB::table('users')->where('id', $old)->update(['id' => 1]);
            });
            Log::info("[official->id1] Resmi hesap id={$old} → id=1 taşındı.");
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    public function down(): void
    {
        // Veri taşımasıdır; güvenli şekilde geri alınamaz (id çakışması + FK riski).
        // Gerekirse DB yedeğinden dönülür.
    }
};
