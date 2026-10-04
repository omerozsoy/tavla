<?php

namespace App\Filament\Resources\AvatarDesignResource\Pages;

use App\Filament\Resources\AvatarDesignResource;
use App\Models\CosmeticItem;
use Filament\Resources\Pages\ListRecords;

class ListAvatarDesigns extends ListRecords
{
    protected static string $resource = AvatarDesignResource::class;

    public function mount(): void
    {
        CosmeticItem::syncCatalog(); // koddaki yeni öğeler için satır (idempotent)
        parent::mount();
    }
}
