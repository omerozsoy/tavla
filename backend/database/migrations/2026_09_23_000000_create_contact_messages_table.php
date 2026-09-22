<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// İletişim / turnuva organizasyonu talepleri: footer "İletişim" sayfasindaki ve
// /tavla-turnuvasi-organizasyonu (+ kurumsal/belediye/avm) landing'lerindeki formdan
// gonderilir. Misafir de gonderebilir (user_id null); giris yapmissa iliskilendirilir.
// Filament "İletişim Talepleri" panelinde incelenir; BugReport ile ayni gelen-kutusu deseni.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index(); // giris yapmissa iliskilendir
            $table->string('name', 120);                       // ad soyad (zorunlu)
            $table->string('org', 160)->nullable();            // kurum / sirket / belediye / AVM adi
            $table->string('email', 190)->nullable();          // geri donus e-postasi
            $table->string('phone', 40)->nullable();           // telefon (WhatsApp/geri arama)
            $table->string('subject', 40)->nullable();         // talep turu: kurumsal|belediye|avm|genel|online
            $table->string('city', 80)->nullable();            // il / sehir
            $table->string('event_date', 60)->nullable();      // yaklasik etkinlik tarihi (serbest metin)
            $table->unsignedInteger('participants')->nullable(); // tahmini katilimci sayisi
            $table->text('message');                           // mesaj / detay
            $table->string('source_page', 120)->nullable();    // formun gonderildigi sayfa (slug)
            $table->string('url', 500)->nullable();            // location.href (otomatik)
            $table->string('user_agent', 400)->nullable();     // tarayici (otomatik)
            $table->string('status', 20)->default('new');      // new | in_progress | resolved
            $table->text('admin_note')->nullable();            // dahili yonetici notu
            $table->text('admin_reply')->nullable();           // talebe gonderilen yanit
            $table->timestamp('replied_at')->nullable();       // yanit gonderim zamani
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_messages');
    }
};
