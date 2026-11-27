<?php

namespace Tests\Feature;

use App\Models\PhotoAnalysis;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ExportPhotoLabelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_exports_labeled_records_with_images_and_skips_missing(): void
    {
        Storage::fake('local');
        $dir = base_path('tests/tmp/eval-'.uniqid());
        Storage::disk('local')->put('photo-analysis/a.jpg', 'IMGBYTES');
        $gt = ['points' => array_fill(0, 24, 0), 'bar' => ['white' => 0, 'black' => 0], 'turn' => 'white', 'dice' => [3, 1]];
        // etiketli + görseli var -> export edilir
        PhotoAnalysis::create(['image_path' => 'photo-analysis/a.jpg', 'status' => 'done', 'flip' => true, 'ground_truth' => $gt, 'reported_at' => now()]);
        // etiketli ama görsel yok -> atlanir (cokme yok)
        PhotoAnalysis::create(['image_path' => 'photo-analysis/missing.jpg', 'status' => 'done', 'ground_truth' => $gt, 'reported_at' => now()]);
        // etiketsiz -> export edilmez
        PhotoAnalysis::create(['image_path' => 'photo-analysis/a.jpg', 'status' => 'done']);

        $this->artisan('photo:export-labels', ['--dir' => $dir])->assertExitCode(0);

        $lines = array_filter(explode("\n", (string) file_get_contents($dir.'/labels.jsonl')));
        $this->assertCount(1, $lines);
        $row = json_decode($lines[0], true);
        $this->assertTrue($row['flip']);
        $this->assertSame('white', $row['ground_truth']['turn']);
        $this->assertFileExists($dir.'/'.$row['file']);
        File::deleteDirectory($dir);
    }
}
