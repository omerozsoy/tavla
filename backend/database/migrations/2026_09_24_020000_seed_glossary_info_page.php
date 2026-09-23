<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "Bilgi › Sözlük" (glossary) bilgi sayfasini seed'ler. Admin panelden (Bilgi Sayfalari)
 * RichEditor ile duzenlenebilir; frontend /bilgi/sozluk sekmesinde gosterilir.
 * Idempotent: satir zaten varsa DOKUNMAZ (admin duzenlemesini ezme).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('info_pages')) {
            return;
        }
        if (DB::table('info_pages')->where('slug', 'glossary')->exists()) {
            return;
        }

        $terms = [
            ['Mars', 'Rakip hiç pul toplayamadan oyunu kaybederse mars olur; kazanan çift puan alır.'],
            ['Gammon', 'Mars’ın uluslararası adı: rakip hiç taş toplayamadan yenilir (2× puan).'],
            ['Backgammon (Katmerli mars)', 'Rakip hiç taş toplayamamış ve ayrıca kazananın ev bölgesinde veya barda taşı varsa; üç kat (3×) puan.'],
            ['Küp (Doubling Cube)', 'Oyunun puan değerini ikiye katlamayı teklif etmeye yarayan zar. Kabul eden oyuncu küpün sahibi olur.'],
            ['Pip', 'Bir taşın toplanana (bear off) kadar kat etmesi gereken toplam adım sayısı. “Pip sayımı” kimin önde olduğunu gösterir.'],
            ['Blot (Kırık taş)', 'Bir hanede yalnız duran tek taş. Rakip üzerine gelirse vurulur (bara gönderilir).'],
            ['Hane / Kapı (Point)', 'Tahtadaki üçgenlerden her biri. Bir haneye iki+ taş konursa “kapı tutulur”; rakip oraya gelemez.'],
            ['Bar', 'Vurulan taşların konduğu orta çizgi. Bardaki taş, rakibin ev bölgesinden yeniden girmeden başka hamle yapılamaz.'],
            ['Toplama (Bearing off)', 'Tüm taşları kendi ev bölgesine getirdikten sonra tahtadan çıkarma aşaması. Tüm taşları ilk toplayan kazanır.'],
            ['Ev bölgesi (Home board)', 'Oyuncunun taşlarını topladığı son çeyrek (kendi 1–6 haneleri).'],
            ['Prime (Duvar)', 'Yan yana tutulan ardışık kapılar. Altılı prime (6 kapı) rakip taşını tamamen hapseder.'],
            ['Anchor (Çıpa)', 'Rakibin ev bölgesinde tutulan kapı; savunmada güvenli nokta sağlar.'],
            ['Crawford kuralı', 'Maçta bir oyuncu kazanmaya bir puan kala oynanan tek oyunda küp kullanılamaz (Crawford oyunu).'],
            ['PR (Performans Reytingi)', 'Hamlelerin en iyi oyundan sapmasını ölçen hata oranı; düşük PR daha iyi oyun demektir (gnubg ile hesaplanır).'],
        ];

        $rows = '';
        foreach ($terms as [$term, $def]) {
            $rows .= '<p><b>'.e($term).':</b> '.e($def).'</p>';
        }
        $body = '<p>Tavlada sık kullanılan terimler ve anlamları:</p>'.$rows;

        DB::table('info_pages')->insert([
            'slug' => 'glossary',
            'title' => 'Sözlük',
            'seo_title' => 'Tavla Sözlüğü — Terimler | TavlaTv',
            'seo_description' => 'Tavla sözlüğü: tavla terimleri ve anlamları — mars, gammon, backgammon, küp, pip ve daha fazlası.',
            'body' => $body,
            'sort' => 3, // Hakkında(1) / Hizmetler(2) altında
            'published' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (Schema::hasTable('info_pages')) {
            DB::table('info_pages')->where('slug', 'glossary')->delete();
        }
    }
};
