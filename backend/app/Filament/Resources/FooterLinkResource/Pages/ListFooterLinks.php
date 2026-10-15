<?php

namespace App\Filament\Resources\FooterLinkResource\Pages;

use App\Filament\Resources\FooterLinkResource;
use App\Models\FooterLink;
use Filament\Resources\Pages\ListRecords;

class ListFooterLinks extends ListRecords
{
    protected static string $resource = FooterLinkResource::class;

    // Ekran açılırken CMS (Bilgi Sayfaları) footer sayfalarını satır olarak senkronla -> sabit
    // linklerle aynı tabloda yönetilir. Tek senkron noktası (bkz FooterLink::syncCmsRows).
    public function mount(): void
    {
        parent::mount();
        FooterLink::syncCmsRows();
    }

    // Sabit set: "Yeni" aksiyonu yok (reorder + inline düzenleme).
    protected function getHeaderActions(): array
    {
        return [];
    }
}
