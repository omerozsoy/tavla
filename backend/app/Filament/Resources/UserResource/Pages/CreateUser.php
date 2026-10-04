<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreateUser extends CreateRecord
{
    protected static string $resource = UserResource::class;

    // Bkz. EditUser: korunan alanlari (plan/coins/is_admin/rating/wins/losses)
    // admin panelinden yazabilmek icin forceFill; $fillable public API icin kisitli
    // kalir. 'password' 'hashed' cast'i forceFill'de de calisir (hash korunur).
    protected function handleRecordCreation(array $data): Model
    {
        // A-18: kök e-postası atanamaz; coin doğrudan kolona değil DEFTERE (ledger) yazılır
        // (eskiden yeni hesaba iz bırakmadan sınırsız/negatif coin verilebiliyordu).
        \App\Support\AdminGuard::assertCanSave(auth()->user(), null, $data, 'data.');
        $coins = (int) ($data['coins'] ?? 0);
        unset($data['coins']);
        if ($coins < 0) {
            throw \Illuminate\Validation\ValidationException::withMessages(['data.coins' => 'Bakiye negatif olamaz.']);
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($data, $coins) {
            $model = new (static::getModel());
            $model->forceFill($data)->save();
            if ($coins > 0) {
                app(\App\Services\WalletService::class)->setBalance($model, $coins, 'admin_adjustment', auth()->id());
                \App\Support\Shield::audit(auth()->id(), 'filament_wallet_adjustment',
                    sprintf('target_user=%d balance_before=0 balance_after=%d (create)', $model->id, $coins), 3);
            }
            if ($model->is_admin) {
                \App\Support\Shield::audit(auth()->id(), 'filament_admin_flag', sprintf('target_user=%d is_admin=1 (create)', $model->id), 3);
            }

            return $model;
        });
    }
}
