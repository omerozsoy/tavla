<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Bildirim: OKUNDU = sil DEGIL (kalici, profilde gorunur); SILME ayri (tek/toplu).
class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(): User
    {
        $u = User::create([
            'first_name' => 'N', 'last_name' => 'T', 'country' => '',
            'nickname' => 'notif'.uniqid(), 'email' => uniqid().'@x.com', 'password' => bcrypt('secret123'),
        ]);
        Sanctum::actingAs($u);

        return $u;
    }

    private function seedNotifs(User $u, int $n): array
    {
        $ids = [];
        for ($i = 0; $i < $n; $i++) {
            Notification::notify($u->id, "Bildirim $i", null, 'bell');
        }

        return Notification::where('user_id', $u->id)->pluck('id')->all();
    }

    public function test_read_marks_as_read_not_delete(): void
    {
        $u = $this->makeUser();
        $this->seedNotifs($u, 3);

        $this->postJson('/api/notifications/read', [])->assertOk();

        // Silinmedi: 3'u de duruyor, hepsi read=true, unread=0
        $this->assertSame(3, Notification::where('user_id', $u->id)->count());
        $this->assertSame(0, Notification::where('user_id', $u->id)->where('read', false)->count());
    }

    public function test_delete_by_ids_removes_only_those(): void
    {
        $u = $this->makeUser();
        $ids = $this->seedNotifs($u, 3);

        $this->postJson('/api/notifications/delete', ['ids' => [$ids[0]]])->assertOk();

        $this->assertNull(Notification::find($ids[0]));
        $this->assertSame(2, Notification::where('user_id', $u->id)->count());
    }

    public function test_delete_all_when_no_ids(): void
    {
        $u = $this->makeUser();
        $this->seedNotifs($u, 3);

        $this->postJson('/api/notifications/delete', [])->assertOk();

        $this->assertSame(0, Notification::where('user_id', $u->id)->count());
    }

    public function test_delete_scoped_to_owner(): void
    {
        $other = $this->makeUser();
        $otherIds = $this->seedNotifs($other, 2);
        $me = $this->makeUser(); // actingAs artik $me
        $this->seedNotifs($me, 1);

        // Toplu sil: yalniz KENDI bildirimlerim silinir; baskasininki durur
        $this->postJson('/api/notifications/delete', [])->assertOk();

        $this->assertSame(0, Notification::where('user_id', $me->id)->count());
        $this->assertSame(2, Notification::where('user_id', $other->id)->count());
        $this->assertNotNull(Notification::find($otherIds[0]));
    }
}
