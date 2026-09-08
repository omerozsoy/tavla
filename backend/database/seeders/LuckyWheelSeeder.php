<?php

namespace Database\Seeders;

use App\Models\LuckyWheelReward;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Şans Çarkı başlangıç ödülleri (12 dilim). Ağırlıklar = istenen yüzdeler (toplam 100).
 * İsme göre updateOrCreate -> tekrar çalıştırılabilir (kopya üretmez).
 *
 * Çalıştır: php artisan db:seed --class=LuckyWheelSeeder
 */
class LuckyWheelSeeder extends Seeder
{
    use WithoutModelEvents; // seed bir admin işlemi değil -> audit üretme

    public function run(): void
    {
        // [name, type, amount, reference_id, weight, icon, slice_color, text_color, desc]
        $rewards = [
            ['25 Coin', 'COIN', 25, null, 25, 'coins', '#e6b422', '#3a2a00', 'Küçük ama tatlı.'],
            ['50 Coin', 'COIN', 50, null, 20, 'coins', '#d9a520', '#3a2a00', null],
            ['100 Coin', 'COIN', 100, null, 15, 'coins', '#caa116', '#ffffff', null],
            ['250 Coin', 'COIN', 250, null, 10, 'coins', '#b8860b', '#ffffff', null],
            ['500 Coin', 'COIN', 500, null, 6, 'coins', '#a86e00', '#ffffff', null],
            ['1.000 Coin', 'COIN', 1000, null, 3, 'coins', '#8a5a00', '#ffffff', 'Büyük vurgun!'],
            ['1 Gün Premium', 'PREMIUM_DAY', 1, null, 8, 'star', '#6e3b8a', '#ffffff', '1 gün StarPRO ayrıcalıkları.'],
            ['Özel Avatar', 'AVATAR', 0, 'pop', 5, 'user', '#1f5673', '#ffffff', 'Özel avatar çerçevesi.'],
            ['Özel Tavla Teması', 'BOARD_THEME', 0, 'neon', 4, 'shop', '#2f6f4f', '#ffffff', 'Özel tahta teması.'],
            ['5.000 Coin Jackpot', 'COIN', 5000, null, 1, 'crown', '#9c2c2c', '#ffffff', 'Büyük ikramiye!'],
            ['Tekrar Çevir', 'FREE_SPIN', 1, null, 2, 'refresh', '#2a9d8f', '#ffffff', 'Bir çevirme hakkı daha!'],
            ['Boş / Şansını Tekrar Dene', 'CUSTOM', 0, null, 1, 'gift', '#4a4e69', '#ffffff', 'Bu sefer olmadı, tekrar dene.'],
        ];

        foreach ($rewards as $i => [$name, $type, $amount, $ref, $weight, $icon, $slice, $text, $desc]) {
            LuckyWheelReward::updateOrCreate(
                ['name' => $name],
                [
                    'type' => $type,
                    'amount' => $amount,
                    'reference_id' => $ref,
                    'weight' => $weight,
                    'icon' => $icon,
                    'slice_color' => $slice,
                    'text_color' => $text,
                    'description' => $desc,
                    'sort' => $i + 1,
                    'is_active' => true,
                    'stock' => null,
                    'starts_at' => null,
                    'ends_at' => null,
                ]
            );
        }
    }
}
