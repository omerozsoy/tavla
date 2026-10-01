<?php

namespace App\Support;

use App\Models\Tournament;
use App\Models\User;
use App\Services\WalletService;
use App\Support\Swiss\SwissRuntime;

/**
 * Turnuva moderasyonu (çekilme / diskalifiye) — HTTP controller (oyuncu/self + yönetici) ve Filament
 * paneli (yönetici) ORTAK kaynağı. Böylece iade+çıkar mantığı ve Swiss hükmen çıkışı tek yerde.
 *
 * Kayıt açık (open): oyuncu listeden çıkarılır + giriş ücreti iade.
 * Turnuva sürüyor (running): hükmen — Swiss'te durum withdrawn/dq + bekleyen maç rakibe walkover
 * (SwissRuntime::exit); eleme ağacında bekleyen maç rakibe walkover (bracket advancement controller'da,
 * bu yüzden running-bracket burada DEĞİL controller'da ele alınır — bkz withdrawRunningBracket).
 *
 * ÇAĞIRAN lockForUpdate transaction sağlar (yarış-güvenli iade + bracket).
 */
class TournamentModeration
{
    /** Kayıt açıkken oyuncuyu listeden çıkar + giriş ücreti iadesi. Idempotent: kayıtlı değilse no-op. */
    public static function removeRegistered(Tournament $t, int $uid): void
    {
        $players = $t->players ?? [];
        $idx = null;
        foreach ($players as $i => $p) {
            if (($p['id'] ?? null) === $uid) {
                $idx = $i;
                break;
            }
        }
        if ($idx === null) {
            return;
        }
        $fee = (int) ($t->entry_fee ?? 0);
        if ($fee > 0) {
            $u = User::lockForUpdate()->find($uid);
            if ($u) {
                app(WalletService::class)->credit($u, $fee, 'tournament_refund');
                $t->prize_coins = max(0, (int) ($t->prize_coins ?? 0) - $fee);
            }
        }
        array_splice($players, $idx, 1);
        $t->players = array_values($players);
        $t->save();
    }

    /** Oyuncu bu turnuvaya kayıtlı mı? */
    public static function isRegistered(Tournament $t, int $uid): bool
    {
        foreach ($t->players ?? [] as $p) {
            if (($p['id'] ?? null) === $uid) {
                return true;
            }
        }

        return false;
    }

    /**
     * Diskalifiye. $mode: 'dq' (yönetici) | 'withdraw' (oyuncu kendi). open=iade+çıkar; running+Swiss=
     * hükmen (SwissRuntime::exit). Running+eleme ağacı bu servisin KAPSAMINDA DEĞİL (bracket advancement
     * controller'da) → false döner; çağıran (Filament) bu durumu görünürlükle engeller.
     *
     * @return bool işlendi mi (false = running-bracket, burada ele alınmaz)
     */
    public static function remove(Tournament $t, int $uid, string $mode): bool
    {
        if ($t->status === 'open') {
            self::removeRegistered($t, $uid);

            return true;
        }
        if ($t->status !== 'running') {
            return false; // finished vb.
        }
        if (SwissRuntime::isSwiss($t)) {
            SwissRuntime::exit($t, $uid, $mode === 'dq' ? 'dq' : 'withdraw');

            return true;
        }

        return false; // running eleme ağacı -> controller walkover yolu
    }
}
