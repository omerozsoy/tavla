<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EditUser extends EditRecord
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            // A-18: düz DeleteAction kök/diğer yöneticileri siliyor ve UserEraser'ı (kulüp devri)
            // atlıyordu. Toplu silme ile AYNI sözleşme: yönetici asla silinmez, UserEraser kullanılır.
            Actions\Action::make('deleteUser')
                ->label('Sil')
                ->icon('heroicon-m-trash')
                ->color('danger')
                ->requiresConfirmation()
                ->visible(fn () => ! $this->record->is_admin)
                ->action(function () {
                    $user = $this->record;
                    $deny = \App\Support\AdminGuard::denyReason(auth()->user(), $user);
                    if ($user->is_admin || $deny !== null) {
                        \Filament\Notifications\Notification::make()->danger()
                            ->title($deny ?? 'Yönetici hesaplar silinemez.')->send();

                        return;
                    }
                    \App\Support\Shield::audit(auth()->id(), 'filament_user_delete', 'target_user='.$user->id, 3);
                    \App\Support\UserEraser::erase($user);
                    $this->redirect(UserResource::getUrl('index'));
                }),
        ];
    }

    // User::$fillable bilincli olarak kisitli tutuluyor: plan/coins/is_admin/rating/
    // wins/losses public API mass-assignment'a KAPALI (aksi halde kullanici profil
    // guncellemesiyle kendine premium/coin/admin verebilir). Bu yuzden standart
    // fill()->save() bu alanlari sessizce atliyordu -> panelde "kaydetmiyor" bug'i.
    // Admin paneli guvenilir baglam; forceFill ile fillable'i bypass edip korunan
    // alanlari yaziyoruz. Public API $fillable ile kisitli/guvenli kaliyor.
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        $beforeCoins = (int) ($record->coins ?? 0);
        $coinsChanged = array_key_exists('coins', $data);
        return DB::transaction(function () use ($record, $data, $beforeCoins, $coinsChanged) {
            $locked = $record::query()->lockForUpdate()->findOrFail($record->getKey());
            // A-18: kök (config) yönetici hesabının yetki/e-posta/şifre/yasak alanları yalnız kökçe.
            \App\Support\AdminGuard::assertCanSave(auth()->user(), $locked, $data, 'data.');
            $beforeAdmin = (bool) $locked->is_admin;
            if (array_key_exists('coins', $data)
                && (int) $data['coins'] < (int) ($locked->coins_reserved ?? 0)) {
                throw ValidationException::withMessages([
                    'coins' => 'Bakiye ayrılmış coin miktarının altına indirilemez.',
                ]);
            }
            if (array_key_exists('coins', $data)) {
                $coins = (int) $data['coins'];
                unset($data['coins']);
                app(\App\Services\WalletService::class)->setBalance($locked, $coins, 'admin_adjustment', auth()->id());
            }
            // Premium KAYNAĞI izi: admin plan'ı bir premium değere ÇEVİRİRSE 'admin' + hangi admin
            // damgala (panel Cüzdan/Üyelik sekmesinde "admin yaptı" görünür).
            $beforePlan = $locked->plan ?? 'free';
            $locked->forceFill($data);
            $afterPlan = $locked->plan ?? 'free';
            if ($afterPlan !== $beforePlan && $afterPlan !== 'free') {
                $locked->stampPlanSource('admin', auth()->id());
            }
            $locked->save();
            if ((bool) $locked->is_admin !== $beforeAdmin) {
                \App\Support\Shield::audit(auth()->id(), 'filament_admin_flag',
                    sprintf('target_user=%d is_admin=%d', $locked->id, (int) $locked->is_admin), 3);
            }

            // Denetim/uyarı YALNIZ bakiye gerçekten değiştiyse yazılsın. Coins alanı formda
            // gelip de değer aynı kaldığında (no-op kaydet) tehlike-alarmı üretmeyelim.
            if ($coinsChanged && (int) $locked->coins !== $beforeCoins) {
                \App\Support\Shield::audit(
                    auth()->id(),
                    'filament_wallet_adjustment',
                    sprintf('target_user=%d balance_before=%d balance_after=%d', $locked->id, $beforeCoins, (int) $locked->coins),
                    3
                );
            }

            return $locked;
        });
    }
}
