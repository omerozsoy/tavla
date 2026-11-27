<?php

namespace Tests\Feature;

use App\Jobs\AnalyzePhotoJob;
use App\Models\PhotoAnalysis;
use App\Models\User;
use App\Services\GnuBg\GnuBgClient;
use App\Services\Recognition\RecognitionClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PhotoAnalysisTest extends TestCase
{
    use RefreshDatabase;

    public function test_upload_creates_pending_record_and_dispatches_job(): void
    {
        Storage::fake('local');
        Bus::fake();
        $user = User::factory()->create();

        $resp = $this->actingAs($user)->postJson('/api/photo-analysis', [
            'image' => UploadedFile::fake()->image('board.jpg', 800, 600),
        ]);

        $resp->assertStatus(202)->assertJson(['status' => 'pending']);
        $this->assertDatabaseHas('photo_analyses', ['user_id' => $user->id, 'status' => 'pending']);
        Bus::assertDispatched(AnalyzePhotoJob::class);
    }

    public function test_job_recognizes_then_analyzes_and_stores_hint(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        Storage::disk('local')->put('photo-analysis/x.jpg', 'FAKEBYTES');
        $pa = PhotoAnalysis::create([
            'user_id' => $user->id, 'image_path' => 'photo-analysis/x.jpg', 'status' => 'pending',
        ]);

        $position = ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0],
            'turn' => 'white', 'dice' => [3, 1], 'cube' => ['value' => 1, 'owner' => null]];
        $recog = $this->mock(RecognitionClient::class);
        $recog->shouldReceive('recognize')->once()
            ->andReturn(['ok' => true, 'position' => $position, 'debug' => ['valid' => true, 'checkers' => 30]]);
        $gnubg = $this->mock(GnuBgClient::class);
        $gnubg->shouldReceive('analyze')->once()
            ->andReturn(['gnubgid' => 'abc', 'result' => ['hint' => [['move' => '8/5 6/5']]]]);

        (new AnalyzePhotoJob($pa->id))->handle($recog, $gnubg);

        $pa->refresh();
        $this->assertSame('done', $pa->status);
        $this->assertTrue($pa->valid);
        $this->assertSame('8/5 6/5', $pa->hint['result']['hint'][0]['move']);
    }

    public function test_invalid_recognition_does_not_call_gnubg(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('photo-analysis/y.jpg', 'FAKE');
        $pa = PhotoAnalysis::create(['image_path' => 'photo-analysis/y.jpg', 'status' => 'pending']);

        $recog = $this->mock(RecognitionClient::class);
        $recog->shouldReceive('recognize')->once()
            ->andReturn(['ok' => true, 'position' => ['points' => array_fill(0, 24, 0)],
                'debug' => ['valid' => false, 'checkers' => 17]]);
        $gnubg = $this->mock(GnuBgClient::class);
        $gnubg->shouldNotReceive('analyze');

        (new AnalyzePhotoJob($pa->id))->handle($recog, $gnubg);

        $pa->refresh();
        $this->assertSame('invalid', $pa->status);
        $this->assertFalse($pa->valid);
    }
}
