<?php

namespace App\Filament\Resources\BoardDesignResource\Pages;

use App\Filament\Resources\BoardDesignResource;
use App\Models\BoardDesign;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListBoardDesigns extends ListRecords
{
    protected static string $resource = BoardDesignResource::class;

    public function mount(): void
    {
        // Koddaki (src/boardThemes.ts) yeni tahtalar için satır oluştur (idempotent).
        BoardDesign::syncBuiltins();
        parent::mount();
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()->label('Yeni Tahta Tasarla'),
        ];
    }
}
