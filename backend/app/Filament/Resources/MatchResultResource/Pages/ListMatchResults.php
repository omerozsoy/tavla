<?php

namespace App\Filament\Resources\MatchResultResource\Pages;

use App\Filament\Resources\MatchResultResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListMatchResults extends ListRecords
{
    protected static string $resource = MatchResultResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
