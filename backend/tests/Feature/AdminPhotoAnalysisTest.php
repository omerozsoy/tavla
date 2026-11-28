<?php

namespace Tests\Feature;

use App\Models\PhotoAnalysis;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
