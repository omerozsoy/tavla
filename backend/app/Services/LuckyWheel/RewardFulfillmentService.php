<?php

namespace App\Services\LuckyWheel;

use App\Http\Controllers\ShopController;
use App\Models\LuckyWheelReward;
use App\Models\Notification;
use App\Models\User;
use App\Services\Achievements\AchievementCatalog;
use App\Services\Achievements\AchievementService;
use Illuminate\Support\Carbon;

/**
 * Şans Çarkı ödül dağıtımı — mevcut ödül-verme yollarını YENİDEN KULLANIR (kopya değil).
 *
 * DİKKAT: Yalnızca bir DB transaction'ı içinde ve $user satırı lockForUpdate ile
 * kilitliyken çağrılmalıdır (LuckyWheelService::spin bunu sağlar). FREE_SPIN durumunda
 * bonus hak ekleme çağıran tarafta (aynı state satırıyla) yapılır — burada işlenmez.
 */
class RewardFulfillmentService
{
    /**
     * Ödülü kullanıcıya işle. FREE_SPIN ve CUSTOM burada coin/plan değiştirmez.
     * @return string|null kullanıcıya gösterilecek kısa özet (bildirim gövdesi)
     */
    public function grant(User $u, LuckyWheelReward $reward): ?string
    {
        $amount = (int) $reward->amount;
        $ref = $reward->reference_id;
        $body = null;

        switch ($reward->type) {
            case LuckyWheelReward::TYPE_COIN:
                if ($amount > 0) {
                    // coins fillable değil -> doğrudan artır (ShopController/AchievementService deseni).
                    $u->increment('coins', $amount);
                    $body = "+{$amount} coin";
                }
                break;

            case LuckyWheelReward::TYPE_PREMIUM_DAY:
                if ($amount > 0) {
                    $this->extendPremium($u, $amount);
                    $body = "+{$amount} gün premium";
                }
                break;

            case LuckyWheelReward::TYPE_AVATAR:
                if ($ref) {
                    $this->addUnlock($u, 'frame.'.$ref);
                    $body = 'Yeni avatar çerçevesi';
                }
                break;

            case LuckyWheelReward::TYPE_BOARD_THEME:
                if ($ref) {
                    $this->addUnlock($u, 'theme.'.$ref);
                    $body = 'Yeni tahta teması';
                }
                break;

            case LuckyWheelReward::TYPE_BADGE:
                if ($ref) {
                    $def = AchievementCatalog::bySlug($ref);
                    if ($def) {
                        // award=false: rozetin kendi coin ödülünü verme (çark ödülü zaten bu).
                        app(AchievementService::class)->unlock($u, $def, 0, false, false);
                        $body = 'Yeni rozet';
                    }
                }
                break;

            case LuckyWheelReward::TYPE_FREE_SPIN:
                // Bonus hak ekleme çağıran tarafta (state satırıyla) yapılır.
                $body = '+'.max(1, $amount).' çevirme hakkı';
                break;

            case LuckyWheelReward::TYPE_CUSTOM:
            default:
                // Özel ödül: yalnız kayıt/snapshot. Elle işlenir.
                break;
        }

        // Bildirim (achievements deseni). Hata olsa ana işlemi bozmasın.
        try {
            Notification::notify(
                $u->id,
                'Şans Çarkı: '.$reward->name,
                $body,
                $reward->icon ?: config('lucky-wheel.type_icons.'.$reward->type, 'gift')
            );
        } catch (\Throwable $e) {
            // yoksay
        }

        return $body;
    }

    /**
     * ŞANS ÇARKI rastgele kozmetik ödülü: kullanıcının SAHİP OLMADIĞI rastgele bir
     * çerçeve (AVATAR) / tahta teması (BOARD_THEME) id'si seç. Hepsine sahipse yine de
     * havuzdan birini döndür (grant addUnlock zaten dup eklemez). Boş id → null.
     */
    public function pickRandomCosmetic(User $u, string $type): ?string
    {
        $owned = $u->unlocks ?? [];
        if ($type === LuckyWheelReward::TYPE_AVATAR) {
            $all = ShopController::frameMotionIds();
            $prefix = 'frame.';
        } elseif ($type === LuckyWheelReward::TYPE_BOARD_THEME) {
            $all = ShopController::boardThemeIds();
            $prefix = 'theme.';
        } else {
            return null;
        }

        $ownedSet = array_flip($owned);
        $candidates = array_values(array_filter($all, fn ($id) => ! isset($ownedSet[$prefix.$id])));
        if (empty($candidates)) {
            $candidates = $all; // hepsi zaten var -> yine de birini göster
        }
        if (empty($candidates)) {
            return null;
        }

        return $candidates[random_int(0, count($candidates) - 1)];
    }

    /** plan_until'ı $days gün uzat (PaymentController::activateMembership mantığının gün versiyonu). */
    private function extendPremium(User $u, int $days): void
    {
        $future = $u->plan_until && Carbon::parse($u->plan_until)->isFuture();
        $base = $future ? Carbon::parse($u->plan_until) : now();
        // free/boş plan -> en düşük premium 'star'; mevcut star/starpro korunur.
        $current = $u->getAttribute('plan') ?: 'free';
        if ($current === 'free') {
            $u->plan = 'star';
        }
        $u->plan_until = $base->copy()->addDays($days);
        if (! $u->plan_since) {
            $u->plan_since = now();
        }
        $u->save();
    }

    /** unlocks JSON dizisine (yoksa) ekle (ShopController deseni). */
    private function addUnlock(User $u, string $id): void
    {
        $unlocks = $u->unlocks ?? [];
        if (! in_array($id, $unlocks, true)) {
            $unlocks[] = $id;
            $u->unlocks = $unlocks;
            $u->save();
        }
    }
}
