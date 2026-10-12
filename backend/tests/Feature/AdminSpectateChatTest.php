<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// SADECE yönetici/destek izlediği maça yazabilir; mesaj isim önünde rol kalkanı için uid+role taşır.
class AdminSpectateChatTest extends TestCase
{
    use RefreshDatabase;

    private function room(string $code, int $p1, int $p2): void
    {
        Room::create([
            'code' => $code, 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $p1, 'p2_user_id' => $p2,
            'p1_name' => 'P1', 'p2_name' => 'P2',
            'status' => 'playing', 'mode' => 'ranked', 'version' => 0, 'messages' => [],
        ]);
    }

    public function test_admin_can_chat_while_spectating_with_role_tag(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create();
        $admin = User::factory()->create(['nickname' => 'Yonetici']);
        $admin->is_admin = true;
        $admin->save();
        $this->room('ADM01', $p1->id, $p2->id);

        Sanctum::actingAs($admin);
        $res = $this->postJson('/api/rooms/ADM01/chat', ['token' => 'zzz', 'text' => 'Lütfen saygılı olun'])
            ->assertOk();
        $messages = $res->json('messages');
        $last = end($messages);
        $this->assertSame('admin', $last['slot']);
        $this->assertSame('Yonetici', $last['name']);
        $this->assertSame('admin', $last['role']);
        $this->assertSame($admin->id, $last['uid']);
    }

    public function test_non_admin_spectator_cannot_chat(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create();
        $outsider = User::factory()->create(); // ne oyuncu ne yönetici
        $this->room('ADM02', $p1->id, $p2->id);

        Sanctum::actingAs($outsider);
        $this->postJson('/api/rooms/ADM02/chat', ['token' => 'zzz', 'text' => 'merhaba'])
            ->assertStatus(403);
    }
}
