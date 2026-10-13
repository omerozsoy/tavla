<?php

namespace App\Filament\Resources\EntryPopupResource\Pages;

use App\Filament\Resources\EntryPopupResource;
use App\Models\Setting;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;

class ListEntryPopups extends ListRecords
{
    protected static string $resource = EntryPopupResource::class;

    protected function getHeaderActions(): array
    {
        // ANA KAPATMA: tek dugmeyle giris popup'ini site genelinde ac/kapa (kayitlar silinmez;
        // EntryPopupController::index Setting'e bakip kapaliysa null doner -> popup hic acilmaz).
        // Etiket/renk mevcut duruma gore; aksiyon sonrasi getHeaderActions tekrar calisip guncellenir.
        $enabled = Setting::bool('entry_popup_enabled', true);

        return [
            Actions\Action::make('togglePopup')
                ->label($enabled ? 'Popup\'ı Tamamen Kapat' : 'Popup\'ı Aç')
                ->icon($enabled ? 'heroicon-o-eye-slash' : 'heroicon-o-eye')
                ->color($enabled ? 'danger' : 'success')
                ->requiresConfirmation()
                ->modalHeading($enabled ? 'Giriş popup\'ını kapat' : 'Giriş popup\'ını aç')
                ->modalDescription($enabled
                    ? 'Siteye girişte açılan tam ekran popup HİÇ gösterilmeyecek. Kayıtlar silinmez; istediğinde tekrar açabilirsin.'
                    : 'Giriş popup\'ı tekrar gösterilmeye başlanacak.')
                ->modalSubmitActionLabel($enabled ? 'Kapat' : 'Aç')
                ->action(function () use ($enabled) {
                    Setting::put('entry_popup_enabled', $enabled ? 0 : 1);
                    Notification::make()
                        ->title($enabled ? 'Giriş popup\'ı KAPATILDI (sitede açılmıyor)' : 'Giriş popup\'ı açıldı')
                        ->success()
                        ->send();
                }),
            Actions\CreateAction::make(),
        ];
    }

    // Popup kapalıyken liste üstünde net uyarı göster (admin durumu görsün).
    public function getSubheading(): ?string
    {
        return Setting::bool('entry_popup_enabled', true)
            ? null
            : '⚠ Giriş popup\'ı şu an KAPALI — siteye girişte hiçbir popup açılmıyor. Yukarıdaki "Popup\'ı Aç" ile geri açabilirsin.';
    }
}
