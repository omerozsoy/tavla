<?php

namespace Tests\Feature;

use App\Filament\Resources\PhotoAnalysisResource\Pages\DuzeltPhotoAnalysis;
use App\Models\PhotoAnalysis;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class AdminPhotoAnalysisTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    public function test_show_returns_position_and_recognized_for_admin(): void
    {
        $pos = ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white', 'dice' => [3, 1], 'cube' => ['value' => 1, 'owner' => null]];
        $pa = PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done', 'valid' => true, 'position' => $pos]);
        $this->actingAs($this->admin())->getJson("/api/admin/photo-analysis/{$pa->id}")
            ->assertOk()->assertJsonPath('recognized.dice', [3, 1])->assertJsonPath('position.turn', 'white')
            ->assertJsonStructure(['image_url']);
    }

    public function test_non_admin_forbidden(): void
    {
        $pa = PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done']);
        $this->actingAs(User::factory()->create())->getJson("/api/admin/photo-analysis/{$pa->id}")->assertStatus(403);
    }

    public function test_label_saves_ground_truth_and_marks_labeled(): void
    {
        $pa = PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done']);
        $gt = ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white', 'dice' => [2, 6], 'cube' => ['value' => 2, 'owner' => 'white']];
        $this->actingAs($this->admin())->postJson("/api/admin/photo-analysis/{$pa->id}/label", ['ground_truth' => $gt])
            ->assertOk()->assertJson(['ok' => true]);
        $this->assertSame($gt, $pa->refresh()->ground_truth);
        $this->assertSame('labeled', $pa->review_status);
    }

    public function test_label_rejects_malformed_ground_truth(): void
    {
        $pa = PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done']);
        $this->actingAs($this->admin())->postJson("/api/admin/photo-analysis/{$pa->id}/label", ['ground_truth' => ['points' => [1, 2]]])
            ->assertStatus(422);  // points 24 degil
        $this->assertNull($pa->refresh()->ground_truth);
    }

    public function test_show_404_for_missing(): void
    {
        $this->actingAs($this->admin())->getJson('/api/admin/photo-analysis/999999')->assertStatus(404);
    }

    // Panel-içi native düzeltme sayfası (iframe/ön yüz YOK): Alpine board $pos'u ground_truth'a yazar.
    public function test_duzelt_page_save_writes_ground_truth_and_labels(): void
    {
        $pos = ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white', 'dice' => [3, 1], 'cube' => ['value' => 1, 'owner' => null]];
        $pa = PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done', 'valid' => true, 'position' => $pos, 'reported_at' => now()]);

        $edited = $pos;
        $edited['points'][5] = 2;   // sen 2 taş
        $edited['points'][12] = -3; // rakip 3 taş
        $edited['turn'] = 'black';
        $edited['bar'] = ['white' => 1, 'black' => 2]; // kırık taşlar bara
        $edited['cube'] = ['value' => 2, 'owner' => 'white'];

        Livewire::actingAs($this->admin())->test(DuzeltPhotoAnalysis::class, ['record' => $pa->id])
            ->set('pos', $edited)->call('save')->assertHasNoErrors();

        $pa->refresh();
        $this->assertSame('labeled', $pa->review_status);
        $this->assertSame(2, $pa->ground_truth['points'][5]);
        $this->assertSame(-3, $pa->ground_truth['points'][12]);
        $this->assertSame('black', $pa->ground_truth['turn']);
        $this->assertSame(['white' => 1, 'black' => 2], $pa->ground_truth['bar']);
        $this->assertSame(['value' => 2, 'owner' => 'white'], $pa->ground_truth['cube']);
    }

    // YÖN düzeltmesi: admin "Ben Koyu" seçerse düzeltilmiş fotoğrafçı rengi debug['photographer']'a yazılır.
    public function test_duzelt_page_save_persists_photographer_orientation(): void
    {
        $pos = ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white', 'dice' => [], 'cube' => ['value' => 1, 'owner' => null]];
        $pa = PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done', 'reported_at' => now(), 'debug' => ['photographer' => 'light', 'board_conf' => 0.9]]);

        Livewire::actingAs($this->admin())->test(DuzeltPhotoAnalysis::class, ['record' => $pa->id])
            ->set('pos', $pos)->set('photographerDark', true)->call('save')->assertHasNoErrors();

        $pa->refresh();
        $this->assertSame('dark', $pa->debug['photographer']);  // yön güncellendi
        $this->assertSame(0.9, $pa->debug['board_conf']);        // diğer debug alanları korundu
    }

    // "Küp yok" (recognition zarı küp sandı): değer 1 + sahip null olarak kaydedilir.
    public function test_duzelt_page_save_cube_none(): void
    {
        $pos = ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white', 'dice' => [], 'cube' => ['value' => 1, 'owner' => null]];
        $pa = PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done', 'reported_at' => now()]);

        Livewire::actingAs($this->admin())->test(DuzeltPhotoAnalysis::class, ['record' => $pa->id])
            ->set('pos', $pos)->call('save')->assertHasNoErrors();

        $this->assertSame(['value' => 1, 'owner' => null], $pa->refresh()->ground_truth['cube']);
    }

    // Bozuk konum (24≠nokta) kaydedilmez — eğitim etiketini kirletme.
    public function test_duzelt_page_save_rejects_malformed(): void
    {
        $pa = PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done', 'reported_at' => now()]);

        Livewire::actingAs($this->admin())->test(DuzeltPhotoAnalysis::class, ['record' => $pa->id])
            ->set('pos', ['points' => [1, 2], 'turn' => 'white'])->call('save');

        $this->assertNull($pa->refresh()->ground_truth);
        $this->assertNull($pa->review_status);
    }

    private function gt(): array
    {
        return ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white', 'dice' => [2, 6], 'cube' => ['value' => 1, 'owner' => null]];
    }

    // Doğru hata bildirimi ödülü: bildiren kullanıcı, tarama elle düzeltilince REPORT_REWARD coin alır.
    public function test_label_rewards_reporter_once(): void
    {
        $reporter = User::factory()->create(['coins' => 50]);
        $pa = PhotoAnalysis::create(['user_id' => $reporter->id, 'image_path' => 'p/a.jpg', 'status' => 'done', 'reported_at' => now()]);

        $pa->labelCorrected($this->gt());
        $this->assertSame(50 + PhotoAnalysis::REPORT_REWARD, $reporter->refresh()->coins);

        // Yeniden kaydet -> idempotent, çift ödeme YOK.
        $pa->labelCorrected($this->gt());
        $this->assertSame(50 + PhotoAnalysis::REPORT_REWARD, $reporter->refresh()->coins);
    }

    // Bildirilmemiş (reported_at null) tarama düzeltmesi ödül vermez.
    public function test_label_without_report_gives_no_reward(): void
    {
        $owner = User::factory()->create(['coins' => 50]);
        $pa = PhotoAnalysis::create(['user_id' => $owner->id, 'image_path' => 'p/a.jpg', 'status' => 'done']);

        $pa->labelCorrected($this->gt());
        $this->assertSame(50, $owner->refresh()->coins);
    }
}
