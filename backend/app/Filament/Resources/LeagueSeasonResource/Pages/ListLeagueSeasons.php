<?php

namespace App\Filament\Resources\LeagueSeasonResource\Pages;

use App\Filament\Resources\LeagueSeasonResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListLeagueSeasons extends ListRecords
{
    protected static string $resource = LeagueSeasonResource::class;

    protected function getHeaderActions(): array
    {
        return [Actions\CreateAction::make()->label('Yeni Sezon')];
    }
}
