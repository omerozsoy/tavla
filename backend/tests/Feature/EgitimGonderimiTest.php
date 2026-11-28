<?php

namespace Tests\Feature;

use App\Filament\Pages\EgitimGonderimi;
use App\Models\PhotoAnalysis;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class EgitimGonderimiTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function gt(): array
    {
        return ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white', 'dice' => [3, 1], 'cube' => ['value' => 1, 'owner' => null]];
    }

    public function test_pending_counts_only_train_ready_untrained(): void
    {
        PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done', 'ground_truth' => $this->gt(), 'review_status' => 'labeled']); // hazır
        PhotoAnalysis::create(['image_path' => 'p/b.jpg', 'status' => 'done', 'ground_truth' => $this->gt(), 'review_status' => 'correct']); // hazır
        PhotoAnalysis::create(['image_path' => 'p/c.jpg', 'status' => 'done', 'ground_truth' => $this->gt(), 'review_status' => 'labeled', 'trained_at' => now()]); // gönderilmiş
        PhotoAnalysis::create(['image_path' => 'p/d.jpg', 'status' => 'done']); // etiketsiz

        $this->assertSame(2, EgitimGonderimi::pendingCount());
    }

    public function test_save_limit_persists(): void
    {
        Livewire::actingAs($this->admin())->test(EgitimGonderimi::class)
            ->set('limit', 25)->call('saveLimit');

        $this->assertSame(25, Setting::int('photo_train_limit'));
    }

    public function test_send_to_training_stamps_trained_at_and_exports(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('photo-analysis/a.jpg', 'IMG');
        $dir = base_path('tests/tmp/train-'.uniqid());

        $ready = PhotoAnalysis::create(['image_path' => 'photo-analysis/a.jpg', 'status' => 'done', 'flip' => false, 'ground_truth' => $this->gt(), 'review_status' => 'labeled']);

        Livewire::actingAs($this->admin())->test(EgitimGonderimi::class)
            ->set('trainDir', $dir)->call('sendToTraining');

        $this->assertNotNull($ready->refresh()->trained_at);                     // gönderildi işaretlendi
        $this->assertSame(0, EgitimGonderimi::pendingCount());                   // bekleyen kalmadı
        $lines = array_filter(explode("\n", (string) file_get_contents($dir.'/labels.jsonl')));
        $this->assertCount(1, $lines);                                           // etiket export edildi
        File::deleteDirectory($dir);
    }

    public function test_send_to_training_noop_when_nothing_pending(): void
    {
        PhotoAnalysis::create(['image_path' => 'p/a.jpg', 'status' => 'done', 'ground_truth' => $this->gt(), 'review_status' => 'labeled', 'trained_at' => now()]);

        Livewire::actingAs($this->admin())->test(EgitimGonderimi::class)->call('sendToTraining');

        // Zaten gönderilmiş; yeni trained_at damgası yok, pending 0 kalır.
        $this->assertSame(0, EgitimGonderimi::pendingCount());
    }
}
