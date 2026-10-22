<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // notifications.title VARCHAR(255) -> text: uzun resmi duyuru toast'ta tam görünsün (bkz OfficialMessenger::pushNotices).
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->text('title')->change();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('title')->change();
        });
    }
};
