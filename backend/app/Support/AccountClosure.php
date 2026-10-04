<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Hesap kapatma (siteden yasaklama) ve yeniden acma — TEK kaynak. Filament aksiyonlari,
 * testler ve olasi CLI ayni sozlesmeyi kullansin.
 *
 * Guvenlik sozlesmesi:
 *  - KAPATMA once ve KOSULSUZ yazilir (banned_at + token silme). Yan islemler (denetim
 *    kaydi, aktif oyun hukmen) BEST-EFFORT; biri patlasa bile hesap KAPALI kalir
 *    (spec: "entegrasyonda hata olsa bile kapatilan hesap erisime devam edemesin").
 *  - banned_at zaten her yerde enforce ediliyor: login (parola+Google), EnsureActiveAccount
 *    (kimlik dogrulanmis API/poll -> 401/403), canAccessPanel. Ayrica cache YOK -> aninda etki.
 *  - Aktif oyun: token silinince banli oyuncu poll atamaz -> mevcut presence/AFK hukmen
 *    politikasi rakibe galibiyeti otomatik yazar (idempotent -> cift sonuc yok). Turnuvada
 *    banli sonraki maclara giremez. (ponytail: aktif nudge yok, mevcut hukmen backstop'una
 *    guveniliyor; ceiling ~60sn+grace gecikme.)
 */
class AccountClosure
{
    /** Hesabi kapat (siteden yasakla). banned_at bos ise yazar; zaten kapaliysa no-op. */
    public static function close(User $user, int $actorId, string $reason, ?string $note = null): void
    {
        if ($user->isBanned()) {
            return; // zaten kapali -> cift kayit uretme
        }
        // A-18: kök (config) yönetici yalnız kökçe kapatılabilir; kimse kendini kapatamaz.
        $deny = AdminGuard::denyReason(User::find($actorId), $user);
        if ($deny !== null) {
            throw new \RuntimeException($deny);
        }
        // 1) KOSULSUZ kapat + tum oturum/refresh token'lari (Sanctum) iptal et.
        $user->forceFill([
            'banned_at' => now(),
            'banned_by' => $actorId,
            'ban_reason' => $reason,
            'ban_note' => $note,
        ])->save();
        $user->tokens()->delete();

        // 2) Yan islemler: patlasa bile kapatma gecerli.
        self::record($user->id, 'closed', $actorId, $reason, $note);
    }

    /** Hesabi yeniden ac. Eski oturumlari CANLANDIRMAZ (token'lar silinmis kalir -> kullanici
     *  yeniden giris yapar). Ayri konusma yasagini / turnuva diskalifiyesini GERI ALMAZ
     *  (bu servis onlara hic dokunmaz). */
    public static function reopen(User $user, int $actorId, string $reason): void
    {
        if (! $user->isBanned()) {
            return;
        }
        $user->forceFill([
            'banned_at' => null,
            'banned_by' => null,
            'ban_reason' => null,
            'ban_note' => null,
        ])->save();

        self::record($user->id, 'reopened', $actorId, $reason, null);
    }

    /** account_ban_events defterine yaz + Shield denetim izi. Best-effort. */
    private static function record(int $userId, string $action, int $actorId, string $reason, ?string $note): void
    {
        try {
            DB::table('account_ban_events')->insert([
                'user_id' => $userId,
                'action' => $action,
                'actor_id' => $actorId,
                'reason' => $reason,
                'note' => $note,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('account_ban_events write failed', ['action' => $action, 'user' => $userId, 'err' => $e->getMessage()]);
        }
        try {
            Shield::audit($actorId, 'account_'.$action, "user=#{$userId} reason=".mb_substr($reason, 0, 200), 3);
        } catch (\Throwable $e) {
            // denetim yazilamadi -> yut; kapatma zaten gecerli
        }
    }
}
