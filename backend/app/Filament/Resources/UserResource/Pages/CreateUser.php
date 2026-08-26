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
        $model = new (static::getModel());
        $model->forceFill($data)->save();

        return $model;
    }
}
