<?php

namespace App\Filament\Resources\TournamentAnnouncementResource\Pages;

use App\Filament\Resources\TournamentAnnouncementResource;
use App\Models\Setting;
use Filament\Resources\Pages\CreateRecord;

class CreateTournamentAnnouncement extends CreateRecord
{
    protected static string $resource = TournamentAnnouncementResource::class;

    // Standart metinler model kolonu değil -> Setting'e kaydet, veriden çıkar (mass-assign'a sızmasın).
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        Setting::put('tournament_std_bracket', $data['std_bracket'] ?? '');
        Setting::put('tournament_std_swiss', $data['std_swiss'] ?? '');
        unset($data['std_bracket'], $data['std_swiss']);

        return $data;
    }
}
