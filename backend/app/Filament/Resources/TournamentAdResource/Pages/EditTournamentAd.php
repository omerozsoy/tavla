<?php

namespace App\Filament\Resources\TournamentAdResource\Pages;

use App\Filament\Resources\TournamentAdResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditTournamentAd extends EditRecord
{
    protected static string $resource = TournamentAdResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
