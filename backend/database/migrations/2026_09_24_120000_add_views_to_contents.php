<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Makale + Haber okunma sayaci. Mevcut yazilar 40-150 arasi RASTGELE bir baslangic
// okunmasiyla doldurulur (yeni yazilar icin ayni baslangici Content model 'creating' hook'u verir).
// Surucu-bagimsiz: RAND()/RANDOM() yerine PHP dongusu (MySQL canli + SQLite test ayni calisir).
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('contents', 'views')) {
            Schema::table('contents', function (Blueprint $t) {
                $t->unsignedInteger('views')->default(0);
            });
        }

        // Yalniz makale/haber + henuz 0 olanlar -> 40..150 rastgele. Timestamp'lere DOKUNMA
        // (DB::table update; siralamayi bozacak updated_at guncellemesi olmaz).
        $ids = DB::table('contents')
            ->whereIn('type', ['makale', 'news'])
            ->where('views', 0)
            ->pluck('id');
        foreach ($ids as $id) {
            DB::table('contents')->where('id', $id)->update(['views' => random_int(40, 150)]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('contents', 'views')) {
            Schema::table('contents', function (Blueprint $t) {
                $t->dropColumn('views');
            });
        }
    }
};
