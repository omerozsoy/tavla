<?php

namespace App\Filament\Resources\LuckyWheelRewardResource\Pages;

use App\Filament\Resources\LuckyWheelRewardResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditLuckyWheelReward extends EditRecord
{
    protected static string $resource = LuckyWheelRewardResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make()->label('Sil'),
        ];
    }
}
