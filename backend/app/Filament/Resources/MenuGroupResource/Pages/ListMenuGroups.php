<?php

namespace App\Filament\Resources\MenuGroupResource\Pages;

use App\Filament\Resources\MenuGroupResource;
use App\Models\MenuGroup;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListMenuGroups extends ListRecords
{
    protected static string $resource = MenuGroupResource::class;

    public function mount(): void
    {
        // Varsayilan gruplar (config/menu.php 'groups') icin satir olustur (idempotent).
        MenuGroup::syncCatalog();
        parent::mount();
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()->label('Yeni Grup'),
        ];
    }
}
