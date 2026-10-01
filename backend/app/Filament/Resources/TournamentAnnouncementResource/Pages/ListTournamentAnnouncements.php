<?php

namespace App\Filament\Resources\TournamentAnnouncementResource\Pages;

use App\Filament\Resources\TournamentAnnouncementResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListTournamentAnnouncements extends ListRecords
{
    protected static string $resource = TournamentAnnouncementResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
