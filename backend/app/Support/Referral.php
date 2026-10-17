<?php

namespace App\Support;

use App\Models\MatchResult;
use App\Models\Setting;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Arkadaş davet (referral) — TEK kaynak. "Davet et, 5000 coin kazan":
 *  1) Davet eden kullanıcının stabil kodu (referral_code) olur; davet linki /?ref=KOD.
 *  2) Davet edilen o kodla kaydolunca referred_by işlenir (link()).
 *  3) Davet edilen İLK PUANLI ONLINE İNSAN maçını yapınca (bota karşı DEĞİL, davet edenine
 *     karşı DEĞİL) her iki tarafa REWARD coin verilir (maybeReward(), referral_rewarded_at ile
 *     bir kez — WalletService referans-idempotent + bayrak = çift kalkan).
 */
class Referral
{
    public const REWARD_SETTING = 'referral_coins'; // admin ayarı (Site Ayarları); varsayılan 5000
    public const DEFAULT_REWARD = 5000;
    public const DEFAULT_DAILY_LIMIT = 5; // kullanıcı başına günlük davet maili (admin: referral_daily_limit)

    /** Kolonlar migrate edilmiş mi (migration öncesi çağrılar kayıt/maçı patlatmasın). */
    public static function enabled(): bool
    {
        return Schema::hasColumn('users', 'referral_code');
    }

    public static function reward(): int
    {
        return Setting::int(self::REWARD_SETTING, self::DEFAULT_REWARD);
    }

    /** Kullanıcı başına günlük davet maili limiti (admin: Site Ayarları). */
    public static function dailyLimit(): int
    {
        return Setting::int('referral_daily_limit', self::DEFAULT_DAILY_LIMIT);
    }

    /** Kullanıcının stabil davet kodu (yoksa üret + kaydet). */
    public static function codeFor(User $user): string
    {
        if (! empty($user->referral_code)) {
            return $user->referral_code;
        }
        do {
            $code = strtoupper(Str::random(8));
        } while (User::where('referral_code', $code)->exists());
        $user->referral_code = $code;
        $user->save();

        return $code;
    }

    /** Davet linki (ziyaret edilen markanın domaininde). */
    public static function linkFor(User $user): string
    {
        $origin = rtrim((string) (Brand::current()['origin'] ?? config('app.url')), '/');

        return $origin.'/?ref='.self::codeFor($user);
    }

    /** Yeni kaydolan kullanıcıyı davet koduyla davet edene bağla (kayıtta bir kez). */
    public static function link(User $newUser, ?string $code): void
    {
        if (! self::enabled() || $code === null) {
            return;
        }
        $code = strtoupper(trim($code));
        if ($code === '' || ! empty($newUser->referred_by)) {
            return;
        }
        $inviter = User::where('referral_code', $code)->first();
        if (! $inviter || $inviter->id === $newUser->id) {
            return; // geçersiz kod ya da kendi kodu -> yok say
        }
        $newUser->referred_by = $inviter->id;
        $newUser->save();
    }

    /**
     * Maç raporlandıktan sonra çağrılır. Davet edilen kişi UYGUN ilk maçını yaptıysa iki tarafa
     * ödül ver. UYGUN = puanlı (rated) + online (room_code) + bota karşı DEĞİL + davet edenine
     * karşı DEĞİL (self-match farm kalkanı). Bir kez (referral_rewarded_at), kilitli + idempotent.
     */
    public static function maybeReward(MatchResult $result): void
    {
        if (! self::enabled()) {
            return;
        }
        if (! $result->rated || $result->match_type === 'ai' || empty($result->room_code)) {
            return; // yalnız puanlı online insan maçı tetikler
        }
        $invited = User::find($result->user_id);
        if (! $invited || empty($invited->referred_by) || $invited->referral_rewarded_at !== null) {
            return;
        }
        if ((int) $result->opponent_user_id === (int) $invited->referred_by) {
            return; // davet eden ile oynanan maç ödül vermez (kendini davet edip farmlamayı kır)
        }
        $amount = self::reward();
        if ($amount <= 0) {
            return;
        }
        DB::transaction(function () use ($invited, $amount) {
            // Kilit altında tekrar kontrol (eşzamanlı iki maç raporu çift ödül vermesin).
            $locked = User::lockForUpdate()->find($invited->id);
            if (! $locked || $locked->referral_rewarded_at !== null) {
                return;
            }
            $inviter = User::find($locked->referred_by);
            if (! $inviter) {
                return;
            }
            $wallet = app(WalletService::class);
            // Referans-idempotent: (type|User|karşı taraf|kendi) anahtarı -> replay güvenli.
            $wallet->credit($locked, $amount, 'referral_reward', User::class, $inviter->id);
            $wallet->credit($inviter, $amount, 'referral_reward', User::class, $locked->id);
            $locked->referral_rewarded_at = now();
            $locked->save();
            User::where('id', $inviter->id)->increment('referral_count');
        });
    }

    /** Davet maili gönder (emails.message şablonu, markaya göre TR/EN). */
    public static function sendInvite(User $inviter, string $email): void
    {
        $brand = Brand::current();
        $origin = (string) ($brand['origin'] ?? '');
        if ($origin !== '') {
            \Illuminate\Support\Facades\URL::forceRootUrl($origin);
        }
        $en = (($brand['locale'] ?? 'tr') === 'en');
        $name = (string) ($brand['name'] ?? 'TavlaTV');
        $reward = self::reward();
        $inviterName = trim((string) ($inviter->nickname ?: $inviter->first_name)) ?: $name;
        $url = self::linkFor($inviter);

        $payload = $en ? [
            'heading' => "{$inviterName} invited you to {$name}!",
            'intro' => "Join {$name} and play backgammon online. When you sign up and finish your first rated online match, you AND {$inviterName} each get {$reward} coins.",
            'url' => $url,
            'buttonText' => 'Join & Claim '.$reward.' Coins',
            'outro' => 'If you were not expecting this invitation, you can ignore this email.',
        ] : [
            'heading' => "{$inviterName} seni {$name}'ye davet etti!",
            'intro' => "{$name}'ye katıl, online tavla oyna. Kaydolup İLK puanlı online maçını bitirince hem sen hem {$inviterName} {$reward} coin kazanırsınız.",
            'url' => $url,
            'buttonText' => $reward.' Coin Kazanmak İçin Katıl',
            'outro' => 'Bu daveti beklemiyorsan bu e-postayı yok sayabilirsin.',
        ];
        $payload['brand'] = $brand;
        $subject = $en ? "{$inviterName} invited you to {$name}" : "{$inviterName} seni {$name}'ye davet etti";
        try {
            Mail::send('emails.message', $payload, fn ($m) => $m->to($email)->subject($subject));
        } catch (\Throwable $e) {
            Log::warning('referral invite mail failed', ['inviter' => $inviter->id, 'err' => $e->getMessage()]);
            throw $e; // çağıran (controller) kullanıcıya "gönderilemedi" döndürsün
        }
    }
}
