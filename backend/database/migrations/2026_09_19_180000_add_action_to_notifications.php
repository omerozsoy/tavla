<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            // Eyleme donuk bildirim: action='friend_request' -> Bildirimler'de "Kabul Et" butonu,
            // actor_id = istegi gonderen kullanici (accept ucu bu id ile cagrilir). Diger bildirimler
            // (bilgilendirici) NULL kalir -> buton cikmaz.
            $table->string('action', 32)->nullable()->after('icon');
            $table->unsignedBigInteger('actor_id')->nullable()->after('action');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['action', 'actor_id']);
        });
    }
};
