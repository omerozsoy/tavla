<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Online Turnuvalar sayfası artık herkese açık (misafir dahil GÖRÜR); katılım turnuva başına:
//  - premium_only = true  -> yalnız Premium üyeler katılabilir
//  - premium_only = false -> tüm üyeler (normal + Premium) katılabilir
// Misafir hiçbir turnuvaya katılamaz (join auth:sanctum arkasında).
// Varsayılan TRUE: bugüne kadar tüm turnuvalar Premium-only idi -> mevcut turnuvalar davranışını korur;
// normal üyelere açılacaklar yönetim panelinden seçilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (! Schema::hasColumn('tournaments', 'premium_only')) {
                $t->boolean('premium_only')->default(true)->after('entry_fee');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (Schema::hasColumn('tournaments', 'premium_only')) {
                $t->dropColumn('premium_only');
            }
        });
    }
};
