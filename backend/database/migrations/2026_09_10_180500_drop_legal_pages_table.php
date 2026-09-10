<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

// Hukuki sayfalar info_pages'e tasindi (bkz 180400). Ayri legal_pages tablosu artik gereksiz.
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('legal_pages');
    }

    public function down(): void
    {
        // Geri alinmaz (icerik info_pages'te).
    }
};
