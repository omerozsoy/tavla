<?php

namespace App\Filament\Resources\TournamentScheduleResource\Pages;

use App\Filament\Resources\TournamentScheduleResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditTournamentSchedule extends EditRecord
{
    protected static string $resource = TournamentScheduleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
