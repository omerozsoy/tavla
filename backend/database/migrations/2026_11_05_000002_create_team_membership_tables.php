<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Başvurular: oyuncu aynı anda en fazla 3 AÇIK başvuru tutabilir (§4).
        Schema::create('team_applications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('team_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('status', 12)->default('pending'); // pending | accepted | rejected | cancelled
            $table->unsignedInteger('rating_at_apply')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index(['team_id', 'status']);
        });

        // Davetler: kontenjan AYIRMAZ; şartlar kabul anında yeniden kontrol edilir (§4).
        Schema::create('team_invites', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('team_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('invited_by')->nullable();
            $table->string('status', 12)->default('pending'); // pending | accepted | declined | revoked | expired
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index(['team_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_invites');
        Schema::dropIfExists('team_applications');
    }
};
