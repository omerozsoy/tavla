<?php

namespace App\Support;

use App\Models\Room;

/**
 * SUNUCU-OTORITER online mac sonucu: bir oyuncunun odada gercekten kazanip
 * kazanmadigini ODANIN paylasilan durumundan cikarir (istemci 'won' beyanina
 * degil). Hem canli akis (AuthController::reportRating) hem geriye-donuk duzeltme
 * (matches:fix-results) ayni mantigi kullansin diye tek yerde.
 *
 * Slot->renk: p1=beyaz, p2=siyah (RoomController ile ayni).
 */
class RoomResult
{
    /**
     * Kaynak onceligi: (1) mac skoru (hedefe ulasan taraf) -> (2) p{slot}_result
     * (saat/forfeit/settle) -> (3) tek-puanlik gameEnd.winner. Belirlenemezse null.
     *
     * @return array{won:bool, self:?int, opp:?int}|null
     */
    public static function resolve(Room $room, int $userId): ?array
    {
        $slot = (int) $room->p1_user_id === $userId ? 'p1'
            : ((int) $room->p2_user_id === $userId ? 'p2' : null);
        if ($slot === null) {
            return null;
        }
        $userColor = $slot === 'p1' ? 'white' : 'black';
        $oppColor = $userColor === 'white' ? 'black' : 'white';

        $state = is_array($room->state) ? $room->state : [];
        $match = is_array($state['match'] ?? null) ? $state['match'] : [];
        $score = is_array($match['score'] ?? null) ? $match['score'] : null;
        $target = (int) ($room->target ?? ($match['target'] ?? 1));

        // 1) Mac skoru: bir taraf hedefe ulasmis ve esitlik yoksa -> kesin sonuc.
        if ($score !== null && isset($score[$userColor], $score[$oppColor])) {
            $s = (int) $score[$userColor];
            $o = (int) $score[$oppColor];
            if ($s !== $o && $target > 0 && ($s >= $target || $o >= $target)) {
                return ['won' => $s > $o, 'self' => $s, 'opp' => $o];
            }
        }
        // 2) Oda p{slot}_result (saat/forfeit/settle).
        $rc = $room->{$slot.'_result'} ?? null;
        if ($rc === 'won' || $rc === 'lost') {
            return [
                'won' => $rc === 'won',
                'self' => isset($score[$userColor]) ? (int) $score[$userColor] : null,
                'opp' => isset($score[$oppColor]) ? (int) $score[$oppColor] : null,
            ];
        }
        // 3) Tek-puanlik macta gameEnd.winner (renk).
        $ge = is_array($state['gameEnd'] ?? null) ? $state['gameEnd'] : null;
        if ($target <= 1 && $ge !== null && isset($ge['winner']) && in_array($ge['winner'], ['white', 'black'], true)) {
            return ['won' => $userColor === $ge['winner'], 'self' => null, 'opp' => null];
        }

        return null;
    }
}
