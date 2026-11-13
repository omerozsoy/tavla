<?php

namespace App\Filament\Resources\TournamentAccessResource\Pages;

use App\Filament\Resources\TournamentAccessResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditTournamentAccess extends EditRecord
{
    protected static string $resource = TournamentAccessResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
