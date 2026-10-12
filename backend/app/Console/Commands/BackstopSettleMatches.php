<?php

namespace App\Console\Commands;

use App\Http\Controllers\RoomController;
use App\Models\Room;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * SUNUCU-OTORİTER EKONOMİK SETTLEMENT YEDEĞİ.
 *
 * KÖK SORUN: bahisli (sabit stake / %-bahis) bir maç bitince coin transferi + `settled=1` + kilit
 * açma YALNIZCA istemcinin `POST /rooms/{code}/settle` çağrısıyla oluyordu. İstemci düşerse (sekme
 * kapandı / ağ koptu / crash / 409'u retry etmedi) oda sonsuza dek `settled=0` kalıyor -> bitmiş
 * maç oyuncunun coinini KALICI kilitliyor (Room::pctLockedCoins). `matches:backstop-finished` yalnız
 * match_results (istatistik) satırını açıyordu, PARAYI settle ETMİYORDU -> orphan'lar birikti.
 *
 * ÇÖZÜM: bitmiş + settled=0 + bahisli odaları periyodik tara, RoomController::settleRoom() ile
 * SUNUCUDAN settle et (kazanan server_match'ten otoriter; token gerekmez). Idempotent (settled=false
 * claim) + best-effort: kazanan çözülemezse / kaybeden bakiyesi stake'in altındaysa settleRoom 409
 * fırlatır -> o oda PENDING kalır, sonraki tur tekrar denenir. Diğer odaları etkilemez.
 *
 * GRACE (--minutes): canlı istemci kendi settle'ını önce yapsın diye yalnız bu kadar dakikadan eski.
 * LOOKBACK (--days): bahisli/unsettled odalar silinmez; 30 gün geriye kadar tara.
 */
class BackstopSettleMatches extends Command
{
    protected $signature = 'matches:backstop-settle {--minutes=2 : Bu kadar dakikadan eski maçlara bak (grace)} {--days=30 : Bu kadar günden yeni odaları tara} {--limit=1000 : Tur başına en fazla oda}';

    protected $description = 'Bitmiş ama kapanmamış (settled=0) bahisli maçları sunucudan settle eder (orphan kilit önleme).';

    public function handle(): int
    {
        $graceMin = max(0, (int) $this->option('minutes'));
        $days = max(1, (int) $this->option('days'));
        $limit = max(1, (int) $this->option('limit'));
        $before = now()->subMinutes($graceMin);
        $after = now()->subDays($days);

        $controller = app(RoomController::class);
        $settled = 0;
        $pending = 0;
        $skipped = 0;
        $scanned = 0;

        Room::query()
            ->where('settled', false)
            ->where(function ($q) {
                $q->where('stake', '>', 0)->orWhere('bet_pct', '>', 0);
            })
            ->whereIn('status', ['playing', 'finished'])
            ->whereNotNull('p1_user_id')
            ->whereNotNull('p2_user_id')
            ->where('updated_at', '<', $before)
            ->where('updated_at', '>', $after)
            ->orderBy('id')
            ->limit($limit)
            ->chunkById(200, function ($rooms) use ($controller, &$settled, &$pending, &$skipped, &$scanned) {
                foreach ($rooms as $room) {
                    $scanned++;
                    try {
                        $res = $controller->settleRoom($room);
                        if (isset($res['amount'])) {
                            $settled++; // coin transferi yapıldı + kilit açıldı
                        } elseif ($res['pending'] ?? false) {
                            $pending++; // kazanan çözülemedi (ör. non-authoritative eski maç)
                        } else {
                            $skipped++; // already (zaten settled) | skip (bahissiz/arkadaş)
                        }
                    } catch (\Throwable $e) {
                        // 409 (snapshot yok / kaybeden bakiyesi < stake) -> PENDING; sonraki tur dener.
                        $pending++;
                        Log::info('matches:backstop-settle pending', ['room' => $room->code, 'err' => $e->getMessage()]);
                    }
                }
            });

        $this->info("Backstop-settle: {$scanned} oda tarandı -> {$settled} settle, {$pending} pending, {$skipped} atlandı.");

        return self::SUCCESS;
    }
}
