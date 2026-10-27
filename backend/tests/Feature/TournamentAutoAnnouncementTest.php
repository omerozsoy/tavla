<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\Tournament;
use App\Models\TournamentAnnouncement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Turnuva BAŞLAYINCA kaydedilmiş standart duyuru metni otomatik yayınlanır (admin elle oluşturmaz).
 * Tek-kaynak: TournamentAnnouncement::publishStandard, Tournament::startBracket + SwissRuntime::start'tan.
 */
class TournamentAutoAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    private function openBracket(): Tournament
    {
        return Tournament::create([
            'name' => 'Test Kupası', 'type' => 'bracket', 'status' => 'open', 'size' => 8, 'match_length' => 1,
            'players' => [['id' => 1, 'name' => 'A'], ['id' => 2, 'name' => 'B']],
        ]);
    }

    public function test_start_auto_publishes_standard_and_is_idempotent(): void
    {
        Setting::put('tournament_std_bracket', 'Tüm oyunculara bol şans!');
        $t = $this->openBracket();

        $t->startBracket();

        $this->assertSame('running', $t->status);
        $ann = TournamentAnnouncement::where('tournament_id', $t->id)->get();
        $this->assertCount(1, $ann);
        $this->assertSame('Tüm oyunculara bol şans!', $ann[0]->message);

        // Çift-başlatma (admin re-start / autoStartDue yarışı) ikinci duyuru yaratmamalı.
        $t->startBracket();
        $this->assertSame(1, TournamentAnnouncement::where('tournament_id', $t->id)->count());
    }

    public function test_empty_standard_text_publishes_nothing(): void
    {
        Setting::put('tournament_std_bracket', '   '); // boş/whitespace → yayınlama
        $t = $this->openBracket();

        $t->startBracket();

        $this->assertSame(0, TournamentAnnouncement::where('tournament_id', $t->id)->count());
    }

    public function test_admin_existing_announcement_is_not_overwritten(): void
    {
        Setting::put('tournament_std_bracket', 'Standart metin');
        $t = $this->openBracket();
        TournamentAnnouncement::create(['tournament_id' => $t->id, 'message' => 'Admin özel duyurusu']);

        $t->startBracket();

        $ann = TournamentAnnouncement::where('tournament_id', $t->id)->get();
        $this->assertCount(1, $ann);
        $this->assertSame('Admin özel duyurusu', $ann[0]->message); // standart basılmadı
    }
}
