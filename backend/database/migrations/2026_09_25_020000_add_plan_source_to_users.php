<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Premium (plan) KAYNAK izi: bir üyenin premium'u NEREDEN geldi + (admin ise) HANGİ admin.
 * Panelde "Üyelik/Cüzdan" sekmesinde gösterilir; "#230 e-postasını aktive etmeden nasıl premium
 * olmuş?" gibi soruların cevabı tek bakışta görünür.
 *   plan_source    : 'payment' | 'wheel' | 'welcome' | 'admin' (null = bilinmiyor/eski)
 *   plan_source_by : admin kaynaklıysa işlemi yapan admin user_id
 *   plan_source_at : kaynağın yazıldığı an
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'plan_source')) {
                $table->string('plan_source', 24)->nullable()->after('plan_since');
            }
            if (! Schema::hasColumn('users', 'plan_source_by')) {
                $table->unsignedBigInteger('plan_source_by')->nullable()->after('plan_source');
            }
            if (! Schema::hasColumn('users', 'plan_source_at')) {
                $table->timestamp('plan_source_at')->nullable()->after('plan_source_by');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }
        Schema::table('users', function (Blueprint $table) {
            foreach (['plan_source', 'plan_source_by', 'plan_source_at'] as $c) {
                if (Schema::hasColumn('users', $c)) {
                    $table->dropColumn($c);
                }
            }
        });
    }
};
