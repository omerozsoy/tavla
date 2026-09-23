<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\OfficialMessenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

// /online-ids: site geneli çevrimiçi durum noktası kaynağı. Son 70sn görülmüş,
// 'offline' değil, sistem hesabı hariç kullanıcı id'leri.
class OnlineIdsTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $tag): User
    {
        return User::create([
            'first_name' => $tag, 'last_name' => 'T', 'country' => '',
            'nickname' => $tag.uniqid(), 'email' => uniqid().'@x.com', 'password' => bcrypt('secret123'),
        ]);
    }

    public function test_returns_only_recently_seen_visible_non_system(): void
    {
        $online = $this->makeUser('on');
        $offline = $this->makeUser('off');
        $hidden = $this->makeUser('hid');
        $system = OfficialMessenger::account();

        User::whereKey($online->id)->update(['last_seen' => now()]);
        User::whereKey($offline->id)->update(['last_seen' => now()->subMinutes(5)]); // eski -> offline
        User::whereKey($hidden->id)->update(['last_seen' => now(), 'presence_status' => 'offline']); // gizli
        User::whereKey($system->id)->update(['last_seen' => now()]); // yakın ama is_system

        Cache::flush(); // 10sn cache testler arası sızmasın
        $ids = collect($this->getJson('/api/online-ids')->assertOk()->json('ids'));

        $this->assertTrue($ids->contains($online->id));
        $this->assertFalse($ids->contains($offline->id));
        $this->assertFalse($ids->contains($hidden->id));
        $this->assertFalse($ids->contains($system->id));
    }
}
