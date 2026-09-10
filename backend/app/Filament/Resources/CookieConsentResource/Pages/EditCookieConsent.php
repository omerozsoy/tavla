<?php

namespace App\Filament\Resources\CookieConsentResource\Pages;

use App\Filament\Resources\CookieConsentResource;
use Filament\Resources\Pages\EditRecord;

class EditCookieConsent extends EditRecord
{
    protected static string $resource = CookieConsentResource::class;

    // Tekil ayar: silme/başka kayda geçiş yok.
    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('edit', ['record' => $this->getRecord()]);
    }
}
