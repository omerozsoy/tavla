<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Eski takma adlar: [{nickname, at}] — üye isim değiştirince model updating event'i ekler.
            $table->json('nickname_history')->nullable()->after('nickname');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('nickname_history');
        });
    }
};
