<?php

namespace App\Filament\Resources\TournamentAdResource\Pages;

use App\Filament\Resources\TournamentAdResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListTournamentAds extends ListRecords
{
    protected static string $resource = TournamentAdResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
