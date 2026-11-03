<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Turnuvaya katılım şifresi (opsiyonel). Doldurulursa katılmak için bu şifre istenir; boş (null) =
// halka açık (şifresiz). Paylaşılan turnuva şifresidir (kullanıcı kimlik bilgisi değil) -> admin'in
// görüp katılımcılara paylaşabilmesi için düz metin saklanır.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (! Schema::hasColumn('tournaments', 'join_password')) {
                $t->string('join_password', 60)->nullable()->after('entry_fee');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (Schema::hasColumn('tournaments', 'join_password')) {
                $t->dropColumn('join_password');
            }
        });
    }
};
