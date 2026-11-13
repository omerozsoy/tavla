<?php

namespace Tests\Feature;

use App\Models\Tournament;
use App\Models\TournamentAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Canlı Turnuva Sistemi dernek/grup paneli: şifre kapısı + turnuva kurma.
 */
class LiveTournamentAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_gates_on_password_and_active(): void
    {
        TournamentAccess::create(['name' => 'Beşiktaş Tavla Derneği', 'password' => 'bjk123', 'active' => true]);
        TournamentAccess::create(['name' => 'Kapalı Grup', 'password' => 'kapali', 'active' => false]);

        // Yanlış şifre -> 401
        $this->postJson('/api/live-tournament/login', ['password' => 'yanlis'])->assertStatus(401);
        // Pasif erişim -> 401
        $this->postJson('/api/live-tournament/login', ['password' => 'kapali'])->assertStatus(401);
        // Doğru + aktif -> 200 + grup adı
        $this->postJson('/api/live-tournament/login', ['password' => 'bjk123'])
            ->assertOk()
            ->assertJson(['ok' => true, 'name' => 'Beşiktaş Tavla Derneği']);
    }

    public function test_create_requires_valid_password_and_builds_tournament(): void
    {
        $access = TournamentAccess::create(['name' => 'Fenerbahçe Tavla', 'password' => 'fb456', 'active' => true]);

        // Yanlış şifre -> kurmaz
        $this->postJson('/api/live-tournament/create', [
            'password' => 'yanlis', 'name' => 'Deneme', 'size' => 8,
        ])->assertStatus(401);
        $this->assertSame(0, Tournament::count());

        // Doğru şifre -> turnuva kurulur (grup adı venue, premium_only false)
        $res = $this->postJson('/api/live-tournament/create', [
            'password' => 'fb456',
            'name' => 'FB Kış Turnuvası',
            'type' => 'swiss_triple',
            'size' => 16,
            'match_length' => 3,
            'swiss_lives' => 2,
            'join_password' => 'gizli',
        ])->assertOk()->json();

        $t = Tournament::find($res['id']);
        $this->assertNotNull($t);
        $this->assertSame('FB Kış Turnuvası', $t->name);
        $this->assertSame('swiss_triple', $t->type);
        $this->assertSame(16, $t->size);
        $this->assertSame(2, (int) $t->swiss_lives);
        $this->assertSame('open', $t->status);
        $this->assertFalse((bool) $t->premium_only);
        $this->assertSame('Fenerbahçe Tavla', $t->venue);
        $this->assertSame('gizli', $t->join_password);
        $this->assertNull($t->creator_id);

        // Erişim sayacı artar
        $this->assertSame(1, $access->fresh()->created_count);
    }
}
