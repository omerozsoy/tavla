<?php

namespace App\Filament\Resources\TournamentScheduleResource\Pages;

use App\Filament\Resources\TournamentScheduleResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListTournamentSchedules extends ListRecords
{
    protected static string $resource = TournamentScheduleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
