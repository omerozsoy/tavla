<?php

namespace App\Support;

use App\Models\MatchResult;
use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * SUNUCU-OTORİTER YEDEK: normal biten bir online maçta, istemcisi reportRating'i
 * kalıcılaştıramamış (sekme kapandı / ağ hatası / başka cihaz / matchWinner uç durumu)
 * oyuncuların match_results satırını SUNUCUDA tamamlar — böylece tamamlanmış maç HER
 * İKİ oyuncunun "Maç Analizleri" listesinde de görünür.
 *
 * ForfeitLoss YALNIZ terk/timeout yolunda ve YALNIZ KAYBEDENİ yazar; bu ise KAZANANI
 * ve normal-bitiş no-show'larını da kapsar. Sonuç RoomResult::resolve ile ODANIN
 * paylaşılan durumundan (istemci beyanına değil) çıkarılır -> KESİN değilse hiçbir şey
 * yazılmaz (yarım kalan/terk edilmiş maça asla tahminle satır açmaz).
 *
 * IDEMPOTENT: (room_code, user_id) satırı zaten varsa DOKUNMAZ -> istemcinin zengin
 * log/PR/luck'lı satırını EZMEZ (bu yüzden yalnız GRACE sonrası çağrılır; canlı istemci
 * önce yazar). User satırı lockForUpdate + (room_code,user_id) UNIQUE index ile çift-Elo
 * yarışına karşı korunur. Elo/istatistik reportRating & ForfeitLoss ile AYNI (k=32).
 *
 * Puansız (friendly) maç: satır yazılır ama rating/istatistik DEĞİŞMEZ (delta=0) —
 * reportRating casual davranışıyla birebir; maç yine geçmişte görünür.
 */
class MatchBackstop
{
    /**
     * Bir oda için eksik oyuncu satırlarını tamamlar. Yazılan satır sayısını döndürür.
     */
    public static function ensure(Room $room): int
    {
        $written = 0;
        $ranked = $room->mode !== 'friendly';
        $matchType = ((int) $room->stake > 0 || (int) $room->bet_pct > 0)
            ? StatsConfig::MATCH_TYPE_COIN
            : StatsConfig::MATCH_TYPE_MATCH;

        foreach (['p1' => 'p2', 'p2' => 'p1'] as $slot => $oppSlot) {
            $uid = (int) ($room->{$slot.'_user_id'} ?? 0);
            if ($uid <= 0) {
                continue; // misafir / hesapsız -> kaydedecek sicil yok
            }
            // Hızlı ön-kontrol (kilit almadan): zaten kayıtlıysa geç (istemci raporlamış).
            if (MatchResult::where('room_code', $room->code)->where('user_id', $uid)->exists()) {
                continue;
            }
            $res = RoomResult::resolve($room, $uid);
            if ($res === null) {
                continue; // sonuç KESİN değil -> asla tahminle yazma
            }
            $oppRating = (int) ($room->{$oppSlot.'_rating'} ?? 0);
            $oppName = $room->{$oppSlot.'_name'} ?? null;
            $matchLength = $room->target !== null ? (int) $room->target : null;
            if (self::writeRow($uid, $res['won'], $oppRating, $res['self'], $res['opp'], $matchLength, $matchType, $oppName, $room->code, $ranked)) {
                $written++;
            }
        }

        return $written;
    }

    /**
     * Tek oyuncu için yedek satırı yaz (idempotent + yarış-güvenli). Yazdıysa true.
     */
    private static function writeRow(
        int $userId,
        bool $won,
        int $oppRating,
        ?int $selfScore,
        ?int $oppScore,
        ?int $matchLength,
        string $matchType,
        ?string $oppName,
        string $roomCode,
        bool $ranked,
    ): bool {
        try {
            return (bool) DB::transaction(function () use ($userId, $won, $oppRating, $selfScore, $oppScore, $matchLength, $matchType, $oppName, $roomCode, $ranked) {
                $u = User::lockForUpdate()->find($userId);
                if (! $u) {
                    return false;
                }
                // Kilit altında TEKRAR kontrol (yarış: bu arada istemci/başka sweep yazmış olabilir).
                if (MatchResult::where('room_code', $roomCode)->where('user_id', $userId)->exists()) {
                    return false;
                }

                $ra = (int) ($u->rating ?? 1500);
                $rb = $oppRating > 0 ? $oppRating : 1500;
                if ($ranked) {
                    $expected = 1 / (1 + pow(10, ($rb - $ra) / 400));
                    $newRating = max(100, (int) round($ra + 32 * (($won ? 1 : 0) - $expected))); // k=32
                    $u->rating = $newRating;
                    $u->games_played = (int) ($u->games_played ?? 0) + 1;
                    if ($won) {
                        $u->wins = (int) ($u->wins ?? 0) + 1;
                    } else {
                        $u->losses = (int) ($u->losses ?? 0) + 1;
                    }
                    $u->save();
                } else {
                    $newRating = $ra; // friendly: rating/istatistik değişmez (delta=0)
                }

                $row = [
                    'user_id' => $userId,
                    'won' => $won,
                    'opponent_rating' => $rb,
                    'rating_before' => $ra,
                    'rating_after' => $newRating,
                    'delta' => $newRating - $ra,
                    'match_length' => $matchLength,
                    'coins_after' => $u->coins ?? 0,
                    'room_code' => $roomCode,
                ];
                if (Schema::hasColumn('match_results', 'opponent_name')) {
                    $row['opponent_name'] = $oppName;
                }
                if (Schema::hasColumn('match_results', 'match_type')) {
                    $row['match_type'] = $matchType;
                }
                if (Schema::hasColumn('match_results', 'score_self')) {
                    $row['score_self'] = $selfScore;
                    $row['score_opp'] = $oppScore;
                }

                MatchResult::create($row); // yarış -> UniqueConstraintViolation -> tx rollback (Elo geri alınır)

                return true;
            });
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            // Gerçek yarış: aynı anda istemci raporu / başka sweep satırı yazdı. Transaction
            // geri alındı -> rating TEKRAR uygulanmadı; istemcinin (zengin) satırı korunur.
            return false;
        }
    }
}
