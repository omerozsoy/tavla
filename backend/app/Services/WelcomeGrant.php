<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// HOŞGELDİN ödülleri (coin + 3 ay Premium) — TEK KAYNAK. AuthController god-object'inden ayristirildi
// (denetim K3): e-posta DOĞRULAMA (VerificationController) ve Google OAuth (AuthController) AYNI grant
// mantigini paylasir -> ortak servis. Davranis BIREBIR korundu (yalnizca tasindi). Hepsi idempotent.
class WelcomeGrant
{
    /**
     * HOŞGELDİN coin'ini BİR KEZ ver (atomik idempotent): welcome_granted=false ise coins += welcome
     * + flag=true. Yalnız e-posta doğrulayan / Google (doğrulanmış) kullanıcıya çağrılır. Eski
     * (zaten doğrulanmış) kullanıcılar doğrulama geçişi yaşamadığı için almaz (retroaktif değil).
     */
    public function coins(int $userId): void
    {
        if (! Schema::hasColumn('users', 'welcome_granted')) {
            return;
        }
        $amount = Setting::int('welcome_coins', (int) config('game.welcome_coins', 100));
        if ($amount <= 0) {
            return;
        }
        DB::transaction(function () use ($userId, $amount) {
            $user = User::lockForUpdate()->find($userId);
            if (! $user || (bool) $user->welcome_granted) {
                return;
            }
            app(WalletService::class)->credit($user, $amount, 'welcome_reward', User::class, $user->id);
            $user->welcome_granted = true;
            $user->save();
        });
    }

    /**
     * HOŞGELDİN premium'unu BİR KEZ ver (atomik idempotent): yeni üye e-postasını DOĞRULAYINCA veya
     * Google ile kaydolunca 2 Ocak 2027'ye kadar ücretsiz Premium. trial_used=false + süresi geçerli ücretli
     * planı OLMAYAN (free/lapsed) kullanıcıya uygulanır -> mevcut ödemeli üyeliği KISALTMAZ, ikinci
     * kez verilmez. Query-builder update (fillable dışı plan alanlarını güvenle yazar).
     */
    public function premium(int $userId): void
    {
        if (! Schema::hasColumn('users', 'trial_used') || ! Schema::hasColumn('users', 'plan_until')) {
            return;
        }
        // HEDİYE ÜYELİK DÖNEMİ (sabit tarih, kullanıcı kararı 2026-10-19): yeni üyeler 2 Ocak
        // 2027 00:00'a kadar ücretsiz Premium ile başlar. 31 Aralık 2026'dan SONRA kayıt olana
        // hediye YOK (dönem bitti) -> normal (free) üye olur, Premium satın alır. Tarihler koda
        // SABİT (admin Setting'i değil) — owner açıkça böyle istedi. Uzatmak gerekirse buradaki
        // iki tarihi değiştir + yeni deploy.
        $now = now();
        $giftUntil = Carbon::parse('2027-01-02 00:00:00'); // hediye premium bitişi
        $giftCutoff = Carbon::parse('2026-12-31 23:59:59'); // son hediye tarihi
        if ($now->gt($giftCutoff)) {
            // Hediye dönemi kapandı: trial_used'ı yine işaretle ki mantık tutarlı kalsın, premium verme.
            User::where('id', $userId)->where('trial_used', false)->update(['trial_used' => true]);

            return;
        }
        $update = [
            'plan' => 'premium',
            'plan_until' => $giftUntil,
            'trial_used' => true,
        ];
        if (Schema::hasColumn('users', 'plan_since')) {
            $update['plan_since'] = $now;
        }
        // premium KAYNAĞI = hoşgeldin (e-posta doğrulama) — panel Cüzdan/Üyelik sekmesinde görünür.
        if (Schema::hasColumn('users', 'plan_source')) {
            $update['plan_source'] = 'welcome';
            $update['plan_source_at'] = $now;
        }
        // trial_used=false AND (plan free VEYA süresi geçmiş) -> yeni üyeye ver. Atomik: WHERE ile yarış yok.
        User::where('id', $userId)
            ->where('trial_used', false)
            ->where(function ($q) use ($now) {
                $q->where('plan', 'free')
                    ->orWhereNull('plan_until')
                    ->orWhere('plan_until', '<=', $now);
            })
            ->update($update);
    }
}
