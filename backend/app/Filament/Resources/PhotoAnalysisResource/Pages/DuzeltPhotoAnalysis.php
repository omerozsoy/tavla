<?php

namespace App\Filament\Resources\PhotoAnalysisResource\Pages;

use App\Filament\Resources\PhotoAnalysisResource;
use Filament\Resources\Pages\Concerns\InteractsWithRecord;
use Filament\Resources\Pages\Page;

/**
 * Admin foto düzeltme — panel İÇİNDE (iframe). Gerçek temalı React Board (/foto-duzelt/<id>) iframe'de
 * açılır; admin Filament panelinden ÇIKMAZ (kullanıcı direktifi: tüm düzeltme admin panelde, ön yüz yok).
 * Board React, Filament PHP → iframe köprüsü. Kaydet sonrası React top-window'u admin listesine döndürür.
 */
class DuzeltPhotoAnalysis extends Page
{
    use InteractsWithRecord;

    protected static string $resource = PhotoAnalysisResource::class;

    protected static string $view = 'filament.photo-duzelt';

    public function mount(int|string $record): void
    {
        $this->record = $this->resolveRecord($record);
    }

    public function getTitle(): string
    {
        return 'Foto Düzelt #'.$this->getRecord()->id;
    }
}
