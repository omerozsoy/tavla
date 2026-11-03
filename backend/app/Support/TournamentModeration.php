<?php

namespace App\Support;

use App\Models\Tournament;
use App\Models\User;
use App\Services\WalletService;
use App\Support\Swiss\SwissRuntime;
use Illuminate\Support\Facades\DB;

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
    /**
     * Oyuncuyu turnuvaya kaydet (coin / TL / ücretsiz ORTAK tek kaynak: HTTP join + TL ödeme callback'i).
     * $feePaid = ödenen COIN tutarı (iptal/çıkışta coin iadesi bundan hesaplanır). TL ödemede feePaid=0
     * verilmeli: TL iadesi coin cüzdanına yapılmaz (manueldir) -> removeRegistered/refundAll coin mint
     * etmesin. Idempotent: zaten kayıtlıysa false. Çağıran turnuva satırını kilitli tutmalı.
     */
    public static function register(Tournament $t, User $u, int $feePaid = 0): bool
    {
        foreach ($t->players ?? [] as $p) {
            if (($p['id'] ?? null) === $u->id) {
                return false; // zaten kayitli
            }
        }
        $players = $t->players ?? [];
        $players[] = [
            'id' => $u->id,
            'name' => $u->nickname ?: $u->first_name ?: 'Oyuncu',
            'rating' => $u->rating ?? 1500,
            'avatar' => $u->avatar,
            'premium' => $u->plan_active !== 'free', // kayıt anındaki premium (snapshot)
            'fee_paid' => max(0, $feePaid),
            'entry' => bin2hex(random_bytes(6)), // kayıt kimliği: iptal iadesi idempotency anahtarı (A-22)
        ];
        $t->players = $players;
        $t->save();

        return true;
    }

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
        // A-09: iade = oyuncunun GERÇEKTEN ödediği tutar (kayıtta fee_paid). Eskiden GÜNCEL entry_fee
        // iade ediliyordu: ücret kayıt açıkken değişirse ödenmemiş coin iade edilebiliyor (0 ödeyip 1000
        // almak) ya da ödenen kısmen kayboluyordu; ücretsiz eklenen oluşturucu da iade alabiliyordu.
        // fee_paid alanı yoksa (bu düzeltmeden önceki kayıt) eski davranış: güncel ücret.
        $fee = array_key_exists('fee_paid', $players[$idx]) ? (int) $players[$idx]['fee_paid'] : (int) ($t->entry_fee ?? 0);
        if ($fee > 0) {
            $u = User::lockForUpdate()->find($uid);
            if ($u) {
                // İADE: oyuncu oynamadan çıkıyor -> YAKILAN giriş ücreti geri verilir (mint). prize_coins'e
                // DOKUNMA: ücret havuza hiç eklenmedi (yakıldı); havuz = YALNIZ admin'in yazdığı ödül.
                app(WalletService::class)->credit($u, $fee, 'tournament_refund');
            }
        }
        array_splice($players, $idx, 1);
        $t->players = array_values($players);
        $t->save();
    }

    /**
     * A-22: turnuva İPTAL (yönetici bitir/sil/sıfırla) -> ödül ödenmediyse her oyuncuya ÖDEDİĞİ giriş
     * ücreti iade edilir, havuz sıfırlanır. Eskiden ücretler sessizce kayboluyordu (açık turnuvada
     * "ayrıl" da kapandığı için iade yolu yoktu). Idempotent: oyuncu+turnuva başına tek iade anahtarı.
     * Çağıran turnuva satırını kilitli tutmalı. Dönüş: iade edilen toplam.
     */
    public static function refundAll(Tournament $t): int
    {
        if ($t->prize_paid ?? false) {
            return 0; // ödül dağıtıldı -> iade yok (kazanç/kayıp kesinleşti)
        }
        $total = 0;
        foreach ($t->players ?? [] as $p) {
            $uid = (int) ($p['id'] ?? 0);
            if ($uid <= 0) {
                continue;
            }
            $fee = array_key_exists('fee_paid', $p) ? (int) $p['fee_paid'] : (int) ($t->entry_fee ?? 0);
            if ($fee <= 0) {
                continue;
            }
            $u = User::lockForUpdate()->find($uid);
            if (! $u) {
                continue;
            }
            app(WalletService::class)->credit($u, $fee, 'tournament_refund', Tournament::class, (int) $t->id,
                'tournament_cancel_refund:'.$t->id.':'.$uid.':'.($p['entry'] ?? 'legacy'));
            $total += $fee;
        }
        $t->prize_coins = 0;

        return $total;
    }

    /** Kilitli transaction içinde refundAll + $then (Filament sıfırla/sil aksiyonları için). */
    public static function cancelWithRefund(Tournament $record, callable $then): void
    {
        DB::transaction(function () use ($record, $then) {
            $t = Tournament::whereKey($record->id)->lockForUpdate()->first();
            if ($t) {
                self::refundAll($t);
                $then($t);
            }
        });
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
