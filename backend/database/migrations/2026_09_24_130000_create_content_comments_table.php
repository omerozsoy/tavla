<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Haber yorumlari: kayitli kullanicilar haber (Content type='news') altina yorum birakir;
// yorum ONAY BEKLER (status='pending') -> admin panelden onaylayinca (approved) herkese gorunur.
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('content_comments')) {
            return;
        }
        Schema::create('content_comments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('content_id')->constrained('contents')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->text('body');
            // pending (onay bekliyor) | approved (yayinda) | rejected (reddedildi)
            $t->string('status', 16)->default('pending');
            $t->timestamp('approved_at')->nullable();
            $t->timestamps();
            // Public liste: bir haberin onayli yorumlarini en yeniden eskiye ceker.
            $t->index(['content_id', 'status']);
            // Panel rozeti: bekleyen yorum sayisi.
            $t->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_comments');
    }
};
