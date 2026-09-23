<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Örnek/test makalesi (Content type='makale') — makale altyapısı canlıda görünür olsun diye
// bir başlangıç içeriği. İdempotent: aynı başlıklı makale zaten varsa tekrar EKLEMEZ.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contents')) {
            return;
        }

        $title = 'Tavlaya Yeni Başlayanlar İçin 5 Temel Strateji';
        $exists = DB::table('contents')
            ->where('type', 'makale')
            ->where('title', $title)
            ->exists();
        if ($exists) {
            return;
        }

        $body = <<<'HTML'
<p>Tavla, öğrenmesi kolay ama ustalaşması yıllar süren bir oyundur. Bu makalede yeni
başlayanların oyununu hızla ileri taşıyacak beş temel stratejiyi derledik.</p>
<h2>1. Açılış hamlelerini ezberleyin</h2>
<p>Her zar atışının onlarca yıllık analizle bulunmuş en iyi bir açılış hamlesi vardır.
Bunları öğrenmek oyununuza sağlam bir başlangıç kazandırır.</p>
<h2>2. Kilit ve prime kurun</h2>
<p>Ardışık kapalı hanelerden oluşan bir "prime", rakibin pullarını hapseder. Kendi
bölgenizde art arda haneleri kapatmayı hedefleyin.</p>
<h2>3. Blot bırakmaktan kaçının</h2>
<p>Tek başına duran (blot) pullar kırılmaya açıktır. Mümkün oldukça pullarınızı çift
tutun; risk ile ödülü dengeleyin.</p>
<h2>4. Pip sayımını öğrenin</h2>
<p>Kimin önde olduğunu bilmek, yarış mı yoksa tutma oyunu mu oynayacağınızı belirler.
Basit pip sayımı, doğru kararların temelidir.</p>
<h2>5. Küpü doğru kullanın</h2>
<p>Doubling cube, tavlayı bir zar oyunundan strateji oyununa dönüştürür. Ne zaman
katlayacağınızı ve kabul/pas kararlarını öğrenin.</p>
<p>Bu temelleri kavradıkça oyununuz gözle görülür şekilde gelişecek. İyi oyunlar!</p>
HTML;

        DB::table('contents')->insert([
            'type' => 'makale',
            'title' => $title,
            'body' => $body,
            'published' => true,
            'sort' => 0,
            'event_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (Schema::hasTable('contents')) {
            DB::table('contents')
                ->where('type', 'makale')
                ->where('title', 'Tavlaya Yeni Başlayanlar İçin 5 Temel Strateji')
                ->delete();
        }
    }
};
