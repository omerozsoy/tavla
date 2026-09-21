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
            Actions\DeleteAction::make(),
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
            if (array_key_exists('coins', $data)
                && (int) $data['coins'] < (int) ($locked->coins_reserved ?? 0)) {
                throw ValidationException::withMessages([
                    'coins' => 'Bakiye ayrılmış coin miktarının altına indirilemez.',
                ]);
            }
            if (array_key_exists('coins', $data)) {
                $coins = (int) $data['coins'];
                unset($data['coins']);
                app(\App\Services\WalletService::class)->setBalance($locked, $coins);
            }
            $locked->forceFill($data)->save();

            if ($coinsChanged) {
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
