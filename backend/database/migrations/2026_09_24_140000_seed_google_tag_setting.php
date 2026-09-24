<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

// Google Etiketi (gtag.js / Google Ads dönüşüm) baslangic ayari. Kullanici verdigi AW- kimligiyle
// AÇIK olarak tohumlanir -> deploy'da (migrate) canli olur; sonra admin panel (Ayarlar > Site
// Ayarlari > Google Etiketi) ile ID degistirilebilir/kapatilabilir. Setting::put idempotent
// (updateOrCreate) ama migration bir kez calisir -> admin'in sonraki degisikligini EZMEZ.
return new class extends Migration
{
    public function up(): void
    {
        // Zaten elle ayarlanmissa (id dolu) dokunma; yoksa kullanicinin verdigi degeri tohumla.
        if (Setting::get('gtag_id', '') === '') {
            Setting::put('gtag_id', 'AW-18472158080');
            Setting::put('gtag_enabled', '1');
        }
    }

    public function down(): void
    {
        Setting::put('gtag_enabled', '0');
    }
};
