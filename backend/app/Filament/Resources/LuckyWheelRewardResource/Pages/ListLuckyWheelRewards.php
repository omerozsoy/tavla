<?php

namespace App\Filament\Resources\LuckyWheelRewardResource\Pages;

use App\Filament\Resources\LuckyWheelRewardResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListLuckyWheelRewards extends ListRecords
{
    protected static string $resource = LuckyWheelRewardResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()->label('Yeni Ödül Ekle'),
        ];
    }
}
