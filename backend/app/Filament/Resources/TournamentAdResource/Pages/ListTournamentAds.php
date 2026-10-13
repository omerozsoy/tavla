<?php

namespace App\Filament\Resources\TournamentAdResource\Pages;

use App\Filament\Resources\TournamentAdResource;
use App\Models\Setting;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;

class ListTournamentAds extends ListRecords
{
    protected static string $resource = TournamentAdResource::class;

    protected function getHeaderActions(): array
    {
        // ANA KAPATMA: tek dugmeyle tum turnuva reklamlarini site genelinde ac/kapa (kayitlar
        // silinmez; TournamentAdController::index Setting'e bakip kapaliysa bos doner). Etiket/renk
        // mevcut duruma gore; aksiyon sonrasi getHeaderActions tekrar calisip guncellenir.
        $enabled = Setting::bool('tournament_ads_enabled', true);

        return [
            Actions\Action::make('toggleAds')
                ->label($enabled ? 'Reklamları Tamamen Kapat' : 'Reklamları Aç')
                ->icon($enabled ? 'heroicon-o-eye-slash' : 'heroicon-o-eye')
                ->color($enabled ? 'danger' : 'success')
                ->requiresConfirmation()
                ->modalHeading($enabled ? 'Turnuva reklamlarını kapat' : 'Turnuva reklamlarını aç')
                ->modalDescription($enabled
                    ? 'Ana sayfadaki turnuva reklam banner\'ları sitede HİÇ gösterilmeyecek. Kayıtlar silinmez; istediğinde tekrar açabilirsin.'
                    : 'Turnuva reklam banner\'ları tekrar gösterilmeye başlanacak.')
                ->modalSubmitActionLabel($enabled ? 'Kapat' : 'Aç')
                ->action(function () use ($enabled) {
                    Setting::put('tournament_ads_enabled', $enabled ? 0 : 1);
                    Notification::make()
                        ->title($enabled ? 'Turnuva reklamları KAPATILDI (sitede görünmüyor)' : 'Turnuva reklamları açıldı')
                        ->success()
                        ->send();
                }),
            Actions\CreateAction::make(),
        ];
    }

    // Reklamlar kapalıyken liste üstünde net uyarı göster (admin durumu görsün).
    public function getSubheading(): ?string
    {
        return Setting::bool('tournament_ads_enabled', true)
            ? null
            : '⚠ Turnuva reklamları şu an KAPALI — sitede hiçbir banner gösterilmiyor. Yukarıdaki "Reklamları Aç" ile geri açabilirsin.';
    }
}
