<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// A-28: DM görselleri 3 MB base64 olarak DB'ye yazılıyordu, SVG kabul ediliyordu, kota yoktu
// (dakikada ~90 MB/hesap). Artık ~750 KB sınırı, yalnız raster türler ve günlük kota.
class MessageImageLimitsTest extends TestCase
{
    use RefreshDatabase;

    private function friends(): array
    {
        [$a, $b] = User::factory()->count(2)->create()->all();
        DB::table('friendships')->insert(['user_id' => $a->id, 'friend_id' => $b->id, 'status' => 'accepted',
            'created_at' => now(), 'updated_at' => now()]);
        Sanctum::actingAs($a);

        return [$a, $b];
    }

    public function test_large_image_rejected_and_normal_size_accepted(): void
    {
        [, $b] = $this->friends();
        $big = 'data:image/jpeg;base64,'.str_repeat('A', 1_200_000);
        $this->postJson("/api/messages/{$b->id}", ['body' => 'x', 'image' => $big])->assertStatus(422);
        $ok = 'data:image/jpeg;base64,'.str_repeat('A', 900_000);
        $this->postJson("/api/messages/{$b->id}", ['body' => 'x', 'image' => $ok])->assertOk();
    }

    public function test_svg_rejected(): void
    {
        [, $b] = $this->friends();
        $svg = 'data:image/svg+xml;base64,'.base64_encode('<svg onload="alert(1)"/>');
        $this->postJson("/api/messages/{$b->id}", ['body' => 'x', 'image' => $svg])->assertStatus(422);
    }

    public function test_daily_image_quota(): void
    {
        [$a, $b] = $this->friends();
        $img = 'data:image/png;base64,iVBORw0KGgo=';
        for ($i = 0; $i < 60; $i++) {
            Message::create(['sender_id' => $a->id, 'receiver_id' => $b->id, 'body' => '', 'image' => $img, 'created_at' => now()]);
        }
        $this->postJson("/api/messages/{$b->id}", ['body' => 'x', 'image' => $img])->assertStatus(429);
        $this->postJson("/api/messages/{$b->id}", ['body' => 'yazı serbest'])->assertOk();
    }
}
