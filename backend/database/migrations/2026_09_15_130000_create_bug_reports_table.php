<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kullanici hata bildirimi ("Hata Bildir"): sayfanin sag kenarindaki butondan acilan
// kucuk form. Hangi sayfada hata yasandigi (metin) + aciklama + opsiyonel ekran goruntusu.
// Misafir de bildirebilir (user_id null); giris yapmissa otomatik iliskilendirilir.
// Ekran goruntusu public/uploads/bug-reports altina yazilir (yol saklanir), Filament'te goruntulenir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bug_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index(); // giris yapmissa iliskilendir
            $table->string('name', 120)->nullable();           // misafir icin ad (opsiyonel)
            $table->string('email', 190)->nullable();          // geri donus icin e-posta (opsiyonel)
            $table->string('page', 300)->nullable();           // hata yasanan sayfa (kullanici metni / okunur ad)
            $table->string('url', 500)->nullable();            // gercek konum (location.href) — otomatik
            $table->text('message');                           // ne oldu (aciklama)
            $table->string('screenshot', 500)->nullable();     // uploads diskindeki yol (bug-reports/...)
            $table->string('user_agent', 400)->nullable();     // tarayici (otomatik) — tekrar uretim icin
            $table->string('status', 20)->default('new');      // new | in_progress | resolved
            $table->text('admin_note')->nullable();            // yonetici notu
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bug_reports');
    }
};
