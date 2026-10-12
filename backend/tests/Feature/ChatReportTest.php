<?php

namespace Tests\Feature;

use App\Models\ChatReport;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Küfür/sohbet şikayeti: "Şikayet Et" -> o anki SON 10 sohbet satırı + taraflar yönetime kaydedilir.
class ChatReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_records_last_10_messages_with_parties_and_blocks_spam(): void
    {
        $p1 = User::factory()->create(['nickname' => 'Reporter']);
        $p2 = User::factory()->create(['nickname' => 'Rakip']);

        $msgs = [];
        for ($i = 1; $i <= 12; $i++) {
            $msgs[] = [
                'slot' => $i % 2 ? 'p1' : 'p2',
                'name' => $i % 2 ? 'Reporter' : 'Rakip',
                'text' => "m$i",
                'id' => "id$i",
            ];
        }
        Room::create([
            'code' => 'RPT01', 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $p1->id, 'p2_user_id' => $p2->id,
            'p1_name' => 'Reporter', 'p2_name' => 'Rakip',
            'status' => 'playing', 'mode' => 'ranked', 'version' => 0,
            'messages' => $msgs,
        ]);

        Sanctum::actingAs($p1);
        $this->postJson('/api/rooms/RPT01/report-chat', ['token' => 'a'])
            ->assertOk()->assertJson(['ok' => true]);

        $this->assertDatabaseHas('chat_reports', [
            'room_code' => 'RPT01', 'reporter_user_id' => $p1->id,
            'reporter_name' => 'Reporter', 'reported_name' => 'Rakip', 'status' => 'new',
        ]);
        $rep = ChatReport::firstOrFail();
        $this->assertCount(10, $rep->messages);               // yalnız son 10
        $this->assertSame('m3', $rep->messages[0]['text']);   // 12 mesajın son 10'u = m3..m12
        $this->assertSame('m12', $rep->messages[9]['text']);

        // Spam kalkanı: 2 dk içinde ikinci şikayet YENİ kayıt oluşturmaz.
        $this->postJson('/api/rooms/RPT01/report-chat', ['token' => 'a'])
            ->assertOk()->assertJson(['duplicate' => true]);
        $this->assertSame(1, ChatReport::count());
    }

    public function test_non_participant_cannot_report(): void
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create();
        $outsider = User::factory()->create();
        Room::create([
            'code' => 'RPT02', 'p1_token' => 'a', 'p2_token' => 'b',
            'p1_user_id' => $p1->id, 'p2_user_id' => $p2->id,
            'p1_name' => 'A', 'p2_name' => 'B',
            'status' => 'playing', 'mode' => 'ranked', 'version' => 0, 'messages' => [],
        ]);

        Sanctum::actingAs($outsider);
        $this->postJson('/api/rooms/RPT02/report-chat', ['token' => 'x'])->assertStatus(403);
        $this->assertSame(0, ChatReport::count());
    }
}
