<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * İKİNCİ-EKRAN (second-screen) HİLE SİNYALİ: oyuncu hamlesini gönderirken o turda pencereyi
 * gizlemiş/odağı kaybetmiş miydi (motor uygulamasına geçiş). İstemci her /move POST'una
 * `blurred` bayrağını koyar; burada satır-başı saklanır. CheatScan::focusSignal bunu renk
 * eşlemesiyle (rooms p1=white/p2=black) kullanıcı-başına toplar → hamle-başı blur oranı.
 *
 * SİNYAL'dir, KANIT değil + DESTEKLEYİCİ: ikinci FİZİKSEL cihazla delinir (blur olmaz) ve
 * dikkatli hileci bayrağı göndermeyebilir. null = raporlanmadı (eski istemci / bildirmeyen).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('match_moves')) {
            return;
        }
        Schema::table('match_moves', function (Blueprint $table) {
            $table->boolean('blurred')->nullable()->after('cube_value');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('match_moves', 'blurred')) {
            return;
        }
        Schema::table('match_moves', function (Blueprint $table) {
            $table->dropColumn('blurred');
        });
    }
};
