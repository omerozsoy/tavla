<?php

namespace App\Jobs;

use App\Exceptions\TransientAnalysisException;
use App\Models\PhotoAnalysis;
use App\Services\GnuBg\GnuBgClient;
use App\Services\Recognition\RecognitionClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

/**
 * Yuklenen tahta fotografini tanima servisine verir (foto->yapisal konum), tanima oz-denetimi
 * gecerse mevcut gnubg'ye analiz ettirir (hint), sonucu PhotoAnalysis'e yazar. AYRI 'photo' kuyrugu
 * (canli is kuyrugunu ac birakma — bkz backend/CLAUDE.md starvation kurali).
 */
class AnalyzePhotoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    /** gnubg gecici down -> denemeler arasi artan bekleme. */
    public function backoff(): array
    {
        return [10, 30];
    }

    public function __construct(public int $photoAnalysisId)
    {
        $this->onQueue('photo');
    }

    public function handle(RecognitionClient $recog, GnuBgClient $gnubg): void
    {
        $pa = PhotoAnalysis::find($this->photoAnalysisId);
        if ($pa === null || $pa->status !== 'pending') {
            return; // silinmis / zaten islenmis
        }
        if (! Storage::disk('local')->exists($pa->image_path)) {
            $pa->update(['status' => 'failed', 'error' => 'image_missing']);

            return;
        }

        $result = $recog->recognize(Storage::disk('local')->get($pa->image_path), (bool) $pa->flip);
        if ($result === null) {
            // tanima servisi erisilemez -> gecici, retry (alarm-muaf)
            throw new TransientAnalysisException('recognition unavailable');
        }

        $debug = $result['debug'] ?? [];
        $position = $result['position'] ?? null;
        $valid = (bool) ($debug['valid'] ?? false);
        $pa->fill(['debug' => $debug, 'position' => $position, 'valid' => $valid]);

        if (! ($result['ok'] ?? false) || ! $valid || $position === null) {
            // tanima guvenilmez -> gnubg'ye COP gonderme; kullanici yeniden ceksin
            $pa->update(['status' => 'invalid', 'error' => $result['error'] ?? 'low_confidence']);

            return;
        }

        // gnubg analizi icin konumu tamamla (para oyunu varsayimi; dice tanimadan geldi)
        $gnubgPos = array_merge($position, [
            'off' => $position['off'] ?? ['white' => 0, 'black' => 0],
            'score' => ['white' => 0, 'black' => 0],
            'matchLength' => 0,
            'crawford' => false,
            'plies' => 2,
        ]);

        $hint = $gnubg->analyze($gnubgPos);
        if ($hint === null) {
            // gnubg down/degrade -> SAHTE sonuc yazma; retry/heal'e birak (alarm-muaf)
            throw new TransientAnalysisException('gnubg unavailable for photo analysis');
        }

        $pa->update(['hint' => $hint, 'status' => 'done', 'error' => null]);
    }
}
