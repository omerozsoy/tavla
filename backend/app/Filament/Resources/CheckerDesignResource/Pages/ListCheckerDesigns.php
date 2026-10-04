<?php

namespace App\Filament\Resources\CheckerDesignResource\Pages;

use App\Filament\Resources\CheckerDesignResource;
use App\Models\CosmeticItem;
use Filament\Resources\Pages\ListRecords;

class ListCheckerDesigns extends ListRecords
{
    protected static string $resource = CheckerDesignResource::class;

    public function mount(): void
    {
        CosmeticItem::syncCatalog(); // koddaki yeni öğeler için satır (idempotent)
        parent::mount();
    }
}
