<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Hata bildirimine YÖNETİCİ YANITI: admin panelden bildirene yazılan cevap. admin_note
// (dahili not) ayrı kalır; admin_reply bildirene E-POSTA ile gönderilen metindir.
// replied_at: yanıt e-postasının en son gönderildiği an (panelde "yanıtlandı" göstergesi).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bug_reports', function (Blueprint $table) {
            $table->text('admin_reply')->nullable()->after('admin_note');   // bildirene gönderilen yanıt
            $table->timestamp('replied_at')->nullable()->after('admin_reply'); // yanıt e-postası zamanı
        });
    }

    public function down(): void
    {
        Schema::table('bug_reports', function (Blueprint $table) {
            $table->dropColumn(['admin_reply', 'replied_at']);
        });
    }
};
