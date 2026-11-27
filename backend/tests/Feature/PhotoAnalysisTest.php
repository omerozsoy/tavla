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

    private function donePhoto(User $user): PhotoAnalysis
    {
        return PhotoAnalysis::create([
            'user_id' => $user->id, 'image_path' => 'photo-analysis/z.jpg', 'status' => 'done', 'valid' => true,
            'position' => ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0],
                'turn' => 'white', 'dice' => [], 'cube' => ['value' => 1, 'owner' => null]],
            'hint' => ['cube' => ['proper' => 'No double, take']],
        ]);
    }

    public function test_settings_reanalyze_same_position_with_new_cube(): void
    {
        $user = User::factory()->create();
        $pa = $this->donePhoto($user);

        $gnubg = $this->mock(GnuBgClient::class);
        $gnubg->shouldReceive('analyze')->once()
            ->withArgs(fn (array $p) => $p['cube'] === ['value' => 2, 'owner' => 'white'] && $p['matchLength'] === 0
                && $p['score'] === ['white' => 0, 'black' => 0] && $p['crawford'] === false && $p['plies'] === 2)
            ->andReturn(['cube' => ['proper' => 'No redouble, take']]);

        $this->actingAs($user)->postJson("/api/photo-analysis/{$pa->id}/settings", ['cube_value' => 2, 'cube_owner' => 'white'])
            ->assertOk()
            ->assertJsonPath('position.cube.value', 2)
            ->assertJsonPath('position.cube.owner', 'white')
            ->assertJsonPath('hint.cube.proper', 'No redouble, take');

        $this->assertSame(2, $pa->refresh()->position['cube']['value']);
    }

    public function test_settings_match_score_and_crawford_reach_gnubg(): void
    {
        $user = User::factory()->create();
        $pa = $this->donePhoto($user);

        $gnubg = $this->mock(GnuBgClient::class);
        $gnubg->shouldReceive('analyze')->once()
            ->withArgs(fn (array $p) => $p['matchLength'] === 7 && $p['score'] === ['white' => 6, 'black' => 4]
                && $p['crawford'] === true)
            ->andReturn(['cube' => ['proper' => 'No double, take']]);

        $this->actingAs($user)->postJson("/api/photo-analysis/{$pa->id}/settings", [
            'cube_value' => 1, 'match_length' => 7, 'score_me' => 6, 'score_opp' => 4, 'crawford' => true,
        ])->assertOk()->assertJsonPath('position.matchLength', 7)->assertJsonPath('position.score.white', 6);
    }

    public function test_settings_rules_and_ownership(): void
    {
        $user = User::factory()->create();
        $pa = $this->donePhoto($user);
        $gnubg = $this->mock(GnuBgClient::class);
        $gnubg->shouldReceive('analyze')->once()->andReturn(['cube' => ['proper' => 'Double, take']]);

        $url = "/api/photo-analysis/{$pa->id}/settings";
        // sahipli kup sahipsiz olamaz
        $this->actingAs($user)->postJson($url, ['cube_value' => 4])->assertStatus(422);
        // gecersiz kup degeri
        $this->actingAs($user)->postJson($url, ['cube_value' => 3, 'cube_owner' => 'white'])->assertStatus(422);
        // skor mac uzunlugundan kucuk olmali
        $this->actingAs($user)->postJson($url, ['cube_value' => 1, 'match_length' => 5, 'score_me' => 5])
            ->assertStatus(422);
        // baskasinin kaydi
        $other = User::factory()->create();
        $this->actingAs($other)->postJson($url, ['cube_value' => 1])->assertStatus(403);
        // deger 1 -> sahip zorla null; crawford, kimse maca 1 kala degilken yok sayilir
        $this->actingAs($user)->postJson($url, [
            'cube_value' => 1, 'cube_owner' => 'black', 'match_length' => 7, 'score_me' => 2, 'crawford' => true,
        ])->assertOk()->assertJsonPath('position.cube.owner', null)->assertJsonPath('position.crawford', false);
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
