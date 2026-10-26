<?php

namespace App\Filament\Resources\TournamentAnnouncementResource\Pages;

use App\Filament\Resources\TournamentAnnouncementResource;
use App\Models\Setting;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\CreateRecord;

class CreateTournamentAnnouncement extends CreateRecord
{
    protected static string $resource = TournamentAnnouncementResource::class;

    // Duyuru oluşturmadan SADECE standart metinleri kaydet (Turnuva/Duyuru metni zorunlu alanlarına
    // takılmadan). Form ham state'i $this->data'da -> doğrulama tetiklemeden Setting'e yazar.
    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('saveStandards')
                ->label('Standart metinleri kaydet')
                ->icon('heroicon-o-bookmark')
                ->color('gray')
                ->action(function () {
                    Setting::put('tournament_std_bracket', $this->data['std_bracket'] ?? '');
                    Setting::put('tournament_std_swiss', $this->data['std_swiss'] ?? '');
                    Notification::make()->title('Standart metinler kaydedildi')->success()->send();
                }),
        ];
    }

    // Standart metinler model kolonu değil -> Setting'e kaydet, veriden çıkar (mass-assign'a sızmasın).
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        Setting::put('tournament_std_bracket', $data['std_bracket'] ?? '');
        Setting::put('tournament_std_swiss', $data['std_swiss'] ?? '');
        unset($data['std_bracket'], $data['std_swiss']);

        return $data;
    }
}
