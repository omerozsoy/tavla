<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('icon', 32)->nullable(); // Icon adi (bell/crown/medal/star ...)
            $table->boolean('read')->default(false);
            $table->timestamp('created_at')->nullable();
            $table->index(['user_id', 'read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
