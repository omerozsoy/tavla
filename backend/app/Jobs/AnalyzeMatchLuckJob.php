<?php

namespace App\Jobs;

use App\Models\MatchResult;
use App\Services\GnuBg\GnuBgClient;
use App\Support\MatBuilder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Tavlai Luck V1 (KALICI): online maçın NATIVE gnubg luck'ını ARKA PLANDA (queue) hesaplar. Her
 * istemci KENDİ kısmi matchLog'unu gönderir (rakip hamleleri eksik olabilir) -> tek istemci .mat'i
 * güvenilmez ("biri 0" bug'ı). ÇÖZÜM: İKİ oyuncunun stored logunu BİRLEŞTİR (MatBuilder — her
 * oyuncunun KENDİ renginin hamleleri kendi logunda TAM) -> TAM .mat -> gnubg iki oyuncuya da GERÇEK
 * luck verir. Sonuç luck_mwc/emg (MWC% = display). Yalnız İKİ oyuncu da raporlayınca çalışır
 * (rakip yoksa döner; rakip raporlayınca job yeniden tetiklenir + iki satırı da yazar).
 */
class AnalyzeMatchLuckJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 200;

    public function __construct(public int $matchResultId) {}

    public function handle(GnuBgClient $gnubg): void
    {
        if (! Schema::hasColumn('match_results', 'luck_mwc')) {
            return; // migration yoksa sessiz geç
        }
        $mr = MatchResult::find($this->matchResultId);
        if (! $mr || empty($mr->room_code)) {
            return; // online (room_code) değilse birleştirilecek rakip yok
        }
        $oppRow = MatchResult::where('room_code', $mr->room_code)
            ->where('user_id', '!=', $mr->user_id)->latest('id')->first();
        if (! $oppRow) {
            return; // rakip henüz raporlamadı; onun raporu bu job'ı yeniden tetikler (iki log hazır olur)
        }

        $mine = json_decode((string) $mr->log, true);
        $theirs = json_decode((string) $oppRow->log, true);
        if (! is_array($mine) || ! is_array($theirs)) {
            return;
        }
        $myHc = $mine['hc'] ?? null;
        $theirHc = $theirs['hc'] ?? null;
        if (! in_array($myHc, ['white', 'black'], true) || ! in_array($theirHc, ['white', 'black'], true) || $myHc === $theirHc) {
            return; // renkler belirsiz/aynı -> güvenli çık
        }

        // Beyaz-logu ve siyah-logu belirle (her oyuncunun KENDİ renginin hamleleri kendi logunda tam).
        [$whiteLog, $blackLog] = $myHc === 'white'
            ? [$mine['log'] ?? [], $theirs['log'] ?? []]
            : [$theirs['log'] ?? [], $mine['log'] ?? []];
        [$whiteRow, $blackRow] = $myHc === 'white' ? [$mr, $oppRow] : [$oppRow, $mr];

        $merged = MatBuilder::mergeLogs(is_array($whiteLog) ? $whiteLog : [], is_array($blackLog) ? $blackLog : []);
        if (count($merged) < 2) {
            return;
        }
        $matchLen = max(1, (int) ($mr->match_length ?? 1));
        $mat = MatBuilder::build($merged, $matchLen, 'White', 'Black');

        $res = $gnubg->matchluck($mat);
        $luck = is_array($res) ? ($res['luck'] ?? null) : null;
        if (! is_array($luck) || ! isset($luck['p0'], $luck['p1'])) {
            Log::warning('gnubg luck (merged): parse yok', ['id' => $mr->id, 'mat_len' => strlen($mat)]);

            return;
        }
        $white = $luck['p0']; // .mat sol sütun = white
        $black = $luck['p1'];

        // emg TAM 0 = hesaplanamadı (birleştirilmiş .mat'te bile eksikse ciddi) -> yazma + logla.
        $suspicious = fn ($l) => ! isset($l['emg_total']) || abs((float) $l['emg_total']) < 1e-9;
        if ($suspicious($white) || $suspicious($black)) {
            Log::warning('gnubg luck (merged) ŞÜPHELİ 0 — birleştirmeye rağmen eksik', [
                'id' => $mr->id, 'p0' => $white, 'p1' => $black,
                'merged_count' => count($merged), 'mat_head' => substr($mat, 0, 1800),
                'stats' => substr((string) ($res['statistics_match'] ?? ''), 0, 1200),
            ]);
        }

        // Birleştirilmiş .mat AUTHORITATIVE (tam) -> iki satırı da (yalnız gerçek değerle) yaz/ez.
        if (! $suspicious($white)) {
            $this->write($whiteRow->id, $white);
        }
        if (! $suspicious($black)) {
            $this->write($blackRow->id, $black);
        }

        Log::info('gnubg luck V1 (merged)', [
            'room' => $mr->room_code, 'merged' => count($merged),
            'white_mwc' => $white['mwc_total'] ?? null, 'black_mwc' => $black['mwc_total'] ?? null,
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
