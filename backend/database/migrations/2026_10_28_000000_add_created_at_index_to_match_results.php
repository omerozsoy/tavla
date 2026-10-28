<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Admin "Maç Geçmişi" listesi created_at DESC sıralı. match_results'ta created_at için TEK-sütun
// indeks YOKTU (mevcutlar (user_id, created_at) bileşik -> global sıralamaya yaramaz) -> liste
// ~15K satırı okuyup filesort yapıyordu (sayfa ~8-40 sn). created_at indeksi -> erken-LIMIT, <10ms.
// NOT: indeks üretimde elle de oluşturulmuş olabilir -> idempotent (varsa atla).
return new class extends Migration
{
    private function hasIndex(): bool
    {
        // information_schema MySQL'e özgü -> sqlite (test) taze DB, indeks yok say (normal oluştur).
        if (DB::getDriverName() !== 'mysql') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', 'match_results')
            ->where('index_name', 'mr_created_at_idx')
            ->exists();
    }

    public function up(): void
    {
        if (! $this->hasIndex()) {
            Schema::table('match_results', function (Blueprint $table) {
                $table->index('created_at', 'mr_created_at_idx');
            });
        }
    }

    public function down(): void
    {
        if ($this->hasIndex()) {
            Schema::table('match_results', function (Blueprint $table) {
                $table->dropIndex('mr_created_at_idx');
            });
        }
    }
};
