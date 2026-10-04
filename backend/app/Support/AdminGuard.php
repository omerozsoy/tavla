<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * A-18: Yönetim panelinde (Filament) hesaplar üzerindeki hassas değişikliklerin TEK kapısı.
 * API/PanelController/AdminController/GuvenlikKalkani config-admin'i (services.admin_emails)
 * zaten koruyordu; Filament kullanıcı ekranları korumuyordu -> sıradan bir yönetici kök hesabın
 * şifresini/e-postasını değiştirip ele geçirebiliyor, yetkisini alıp silebiliyordu.
 */
class AdminGuard
{
    /** Kök hesabı yalnız kök (config) yönetici değiştirebilir. */
    private const PROTECTED_FIELDS = ['is_admin', 'banned_at', 'email', 'password'];

    public static function isConfigEmail(?string $email): bool
    {
        $admins = array_map('strtolower', config('services.admin_emails', []));

        return $email !== null && in_array(strtolower($email), $admins, true);
    }

    /** Düzenleme/oluşturma verisini doğrular; ihlalde ValidationException (form hatası). */
    public static function assertCanSave(?User $actor, ?User $target, array $data, string $errorPrefix = ''): void
    {
        $actorIsRoot = $actor?->isConfigAdmin() ?? false;
        if ($target && $target->isConfigAdmin() && ! $actorIsRoot) {
            foreach (self::PROTECTED_FIELDS as $f) {
                if (! array_key_exists($f, $data)) {
                    continue;
                }
                $changed = $f === 'password'
                    ? filled($data[$f])
                    : (string) ($data[$f] ?? '') !== (string) ($target->getAttribute($f) ?? '');
                if ($changed) {
                    throw ValidationException::withMessages([
                        $errorPrefix.$f => 'Kök yönetici hesabının bu alanını yalnız kök yönetici değiştirebilir.',
                    ]);
                }
            }
        }
        // Kendini (ya da başkasını) yapılandırılmış kök e-postasına taşıyarak silinemez yönetici yapma.
        if (array_key_exists('email', $data) && ! $actorIsRoot
            && self::isConfigEmail($data['email'])
            && strtolower((string) $data['email']) !== strtolower((string) ($target?->email ?? ''))) {
            throw ValidationException::withMessages([
                $errorPrefix.'email' => 'Bu e-posta yapılandırılmış yönetici adresidir; atanamaz.',
            ]);
        }
    }

    /** Hesap kapatma / silme: kök hesap yalnız kökçe, kimse kendini kapatamaz/silemez. */
    public static function denyReason(?User $actor, User $target): ?string
    {
        if ($actor && $actor->is_admin && $actor->id === $target->id) {
            return 'Kendi hesabınız üzerinde bu işlem yapılamaz.';
        }
        if ($target->isConfigAdmin() && ! ($actor?->isConfigAdmin() ?? false)) {
            return 'Kök yönetici hesabı üzerinde bu işlemi yalnız kök yönetici yapabilir.';
        }

        return null;
    }
}
