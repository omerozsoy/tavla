<?php

namespace App\Jobs;

use App\Models\MatchResult;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Tavlai Luck V1: bir maçın .mat'ini gnubg'ye analiz ettirip (analyse match) NATIVE per-oyuncu
 * luck'ı ARKA PLANDA (queue) hesaplar. gnubg 'Luck total (MWC)' zaten yüzde -> luck_mwc'ye yazılır
 * (kullanıcıya "+8.4%"). .mat'te sütun 0 = white (sol), sütun 1 = black (sağ) — buildMat garantisi.
 * Bu satırın oyuncusunun rengi (log.hc) ile eşlenir; rakip satırı da (aynı room_code) idempotent
 * güncellenir. gnubg down/başarısızsa sessiz geçer (istemci ONNX luck fallback kalır).
 */
class AnalyzeMatchLuckJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 200;

    public function __construct(public int $matchResultId, public string $mat) {}

    public function handle(GnuBgClient $gnubg): void
    {
        if (! Schema::hasColumn('match_results', 'luck_mwc')) {
            return; // migration henüz yoksa sessiz geç
        }
        $mr = MatchResult::find($this->matchResultId);
        if (! $mr || $this->mat === '') {
            return;
        }
        $res = $gnubg->matchluck($this->mat);
        $luck = is_array($res) ? ($res['luck'] ?? null) : null;
        if (! is_array($luck) || ! isset($luck['p0'], $luck['p1'])) {
            Log::warning('gnubg luck: parse yok', ['id' => $mr->id, 'res' => is_array($res) ? array_keys($res) : gettype($res)]);

            return;
        }
        $white = $luck['p0']; // .mat sol sütun = white
        $black = $luck['p1']; // sağ sütun = black

        // Bu satırın oyuncusunun rengi (log.hc). Bilinmezse white varsay (geriye uyum).
        $hc = 'white';
        $decoded = json_decode((string) $mr->log, true);
        if (is_array($decoded) && in_array(($decoded['hc'] ?? null), ['white', 'black'], true)) {
            $hc = $decoded['hc'];
        }
        $mine = $hc === 'white' ? $white : $black;
        $opp = $hc === 'white' ? $black : $white;

        $this->write($mr->id, $mine);

        // Rakip satırı (aynı oda) — idempotent senkron: iki oyuncu da kendi luck'ını görsün.
        if (! empty($mr->room_code)) {
            $oppRow = MatchResult::where('room_code', $mr->room_code)
                ->where('user_id', '!=', $mr->user_id)->latest('id')->first();
            if ($oppRow) {
                $this->write($oppRow->id, $opp);
            }
        }

        Log::info('gnubg luck V1', [
            'id' => $mr->id, 'hc' => $hc,
            'mine_mwc' => $mine['mwc_total'] ?? null, 'opp_mwc' => $opp['mwc_total'] ?? null,
        ]);
    }

    /** Query-builder update (fillable gerekmez); yalnız var olan kolonlara yaz. */
    private function write(int $rowId, array $luck): void
    {
        $upd = ['luck_method' => 'TAVLAI_LUCK_V1'];
        if (isset($luck['mwc_total'])) {
            $upd['luck_mwc'] = round((float) $luck['mwc_total'], 3);
        }
        if (isset($luck['emg_total'])) {
            $upd['luck_emg'] = round((float) $luck['emg_total'], 4);
        }
        MatchResult::where('id', $rowId)->update($upd);
    }
}
