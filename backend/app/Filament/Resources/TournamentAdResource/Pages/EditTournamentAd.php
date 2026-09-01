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

    // Kaydettikten sonra: model saved() kancasi yeni gorselden baskin renk paletini
    // yeniden cikardi (updateQuietly). Formdaki renk swatch'lari eski kalmasin diye
    // 'palette' alanini kayittan tazele -> yeni resmin renkleri aninda gorunur.
    protected function afterSave(): void
    {
        $this->refreshFormData(['palette']);
    }
}
