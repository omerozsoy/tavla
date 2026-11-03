<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Turnuva katılım ücreti TL (gerçek para) seçeneği. entry_fee_try = KURUŞ (TL × 100), null/0 = TL yok.
// Ücret tipi TEK: entry_fee_try>0 ise turnuva TL'li (coin entry_fee yok sayılır), değilse coin/ücretsiz.
// payments.tournament_id: tournament_entry türü ödemeyi turnuvaya bağlar (callback'te kayıt için).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (! Schema::hasColumn('tournaments', 'entry_fee_try')) {
                $t->unsignedInteger('entry_fee_try')->nullable()->after('entry_fee');
            }
        });
        Schema::table('payments', function (Blueprint $t) {
            if (! Schema::hasColumn('payments', 'tournament_id')) {
                $t->unsignedBigInteger('tournament_id')->nullable()->after('user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $t) {
            if (Schema::hasColumn('tournaments', 'entry_fee_try')) {
                $t->dropColumn('entry_fee_try');
            }
        });
        Schema::table('payments', function (Blueprint $t) {
            if (Schema::hasColumn('payments', 'tournament_id')) {
                $t->dropColumn('tournament_id');
            }
        });
    }
};
