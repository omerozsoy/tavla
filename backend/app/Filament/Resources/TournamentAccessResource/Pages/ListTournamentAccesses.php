<?php

namespace App\Filament\Resources\TournamentAccessResource\Pages;

use App\Filament\Resources\TournamentAccessResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListTournamentAccesses extends ListRecords
{
    protected static string $resource = TournamentAccessResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
