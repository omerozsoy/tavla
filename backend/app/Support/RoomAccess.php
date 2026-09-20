<?php

namespace App\Support;

use App\Models\Room;
use App\Models\User;

/** Account ownership is authoritative; a guest capability never impersonates an account. */
final class RoomAccess
{
    public static function requiresAccount(Room $room): bool
    {
        // Multi-stake waiting rooms may have stake=0 until a match is selected.
        $stakes = is_array($room->stakes) ? $room->stakes : [];

        return $room->mode === 'ranked' || (int) $room->stake > 0
            || (int) $room->bet_pct > 0 || (bool) $room->escrowed
            || count(array_filter($stakes, fn ($stake) => (int) $stake > 0)) > 0;
    }

    public static function slot(Room $room, ?User $user, string $guestToken = ''): ?string
    {
        if ($user?->isBanned()) {
            return null;
        }

        $owned = [];
        if ($user && (int) $user->id > 0) {
            foreach (['p1', 'p2'] as $slot) {
                if ((int) $room->{$slot.'_user_id'} === (int) $user->id) {
                    $owned[] = $slot;
                }
            }
        }
        if ($owned !== []) {
            // Ambiguous legacy self-match rows must not authorize either seat.
            return count($owned) === 1 && ! ($room->bot && $owned[0] === 'p2') ? $owned[0] : null;
        }
        if (self::requiresAccount($room) || $guestToken === '') {
            return null;
        }

        $guestSeats = [];
        foreach (['p1', 'p2'] as $slot) {
            $token = (string) $room->{$slot.'_token'};
            if ($room->{$slot.'_user_id'} === null && ! ($room->bot && $slot === 'p2')
                && $token !== '' && hash_equals($token, $guestToken)) {
                $guestSeats[] = $slot;
            }
        }

        return count($guestSeats) === 1 ? $guestSeats[0] : null;
    }
}
