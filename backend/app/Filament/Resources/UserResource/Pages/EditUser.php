<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;

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
        $record->forceFill($data)->save();

        return $record;
    }
}
