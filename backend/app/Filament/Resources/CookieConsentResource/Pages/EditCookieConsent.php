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

    // Bu kaynakta 'index' (liste) sayfası YOK. Filament EditRecord varsayılan
    // breadcrumb'ı kaynağın index rotasına link üretmeye çalışır → o rota tanımsız
    // olduğu için 500 (Route [...cerez-banner.index] not defined). Tekil ayar
    // ekranında breadcrumb izine gerek yok; boş döndürerek index referansını kaldır.
    public function getBreadcrumbs(): array
    {
        return [];
    }
}
