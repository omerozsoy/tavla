<?php

namespace App\Console\Commands;

use App\Models\PhotoAnalysis;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

/**
 * Admin'in elle duzelttigi (foto -> dogru konum) ciftlerini tanima regresyon/eval setine doker:
 * her ground_truth != null kaydin gorselini <dir>'e kopyalar + labels.jsonl satiri yazar. Bu set
 * recognition/eval.py ile geometri iyilestirmelerini skorlamak icin kullanilir (model EGITIMI DEGIL).
 */
class ExportPhotoLabels extends Command
{
    protected $signature = 'photo:export-labels {--dir=}';

    protected $description = 'Etiketli (foto->dogru konum) ciftlerini recognition eval setine dok';

    public function handle(): int
    {
        $dir = $this->option('dir') ?: base_path('../recognition/eval-data');
        File::ensureDirectoryExists($dir);
        $jsonl = $dir.'/labels.jsonl';
        File::put($jsonl, ''); // yeniden export tam seti yazsin (eski birikinti temizlensin)

        $count = 0;
        PhotoAnalysis::whereNotNull('ground_truth')->whereNotNull('image_path')->cursor()
            ->each(function (PhotoAnalysis $pa) use ($dir, $jsonl, &$count) {
                if (! Storage::disk('local')->exists($pa->image_path)) {
                    $this->warn("atlandi (gorsel yok): #{$pa->id} {$pa->image_path}");

                    return;
                }
                $file = $pa->id.'.jpg';
                File::put($dir.'/'.$file, Storage::disk('local')->get($pa->image_path));
                File::append($jsonl, json_encode([
                    'file' => $file,
                    'flip' => (bool) $pa->flip,
                    'ground_truth' => $pa->ground_truth,
                ], JSON_UNESCAPED_UNICODE)."\n");
                $count++;
            });

        $this->info("$count etiket export edildi -> $dir");

        return self::SUCCESS;
    }
}
