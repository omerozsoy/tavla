<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// ORGANİZATÖR: Dışarda (salon) Swiss turnuvasını siteye admin girmeden yönetebilen yetkili kullanıcı.
// Admin bu kullanıcıyı atar; o kişi "Organizatör Paneli"nden SADECE kendi turnuvalarına katılımcı
// ekler + sonuç girer. Para ödeyip bu hizmeti alan dış müşteri burada yetkilendirilir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            $t->unsignedBigInteger('manager_user_id')->nullable()->after('creator_id');
            $t->index('manager_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            $t->dropIndex(['manager_user_id']);
            $t->dropColumn('manager_user_id');
        });
    }
};
