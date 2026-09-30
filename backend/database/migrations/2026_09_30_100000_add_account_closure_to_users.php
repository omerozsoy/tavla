<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Hesap kapatma (siteden yasaklama) alanlari. banned_at ZATEN var (2026_08_22) ve tum
// enforcement (login/EnsureActiveAccount/canAccessPanel) ona bakiyor; burada yalnizca
// GEREKCE/NOT/KIM ve yeniden-acma GECMISI icin ek alan+tablo ekliyoruz. Idempotent.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'banned_by')) {
                $table->unsignedBigInteger('banned_by')->nullable()->after('banned_at');
            }
            if (! Schema::hasColumn('users', 'ban_reason')) {
                $table->text('ban_reason')->nullable()->after('banned_by');
            }
            if (! Schema::hasColumn('users', 'ban_note')) {
                // YALNIZ admin gorur; asla istemciye serialize edilmez ($hidden).
                $table->text('ban_note')->nullable()->after('ban_reason');
            }
        });

        if (! Schema::hasTable('account_ban_events')) {
            Schema::create('account_ban_events', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('action', 16); // 'closed' | 'reopened'
                $table->unsignedBigInteger('actor_id')->nullable();
                $table->text('reason');
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['banned_by', 'ban_reason', 'ban_note'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
        Schema::dropIfExists('account_ban_events');
    }
};
