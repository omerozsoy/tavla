<?php

namespace App\Filament\Resources\MenuItemResource\Pages;

use App\Filament\Resources\MenuItemResource;
use App\Models\MenuItem;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListMenuItems extends ListRecords
{
    protected static string $resource = MenuItemResource::class;

    public function mount(): void
    {
        // Katalogdaki (config/menu.php) eksik anahtarlar icin satir olustur (idempotent).
        MenuItem::syncCatalog();
        parent::mount();
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('sync')
                ->label('Menüyü Yenile')
                ->icon('heroicon-o-arrow-path')
                ->color('gray')
                ->action(function () {
                    MenuItem::syncCatalog();
                    $this->redirect(static::getUrl());
                }),
        ];
    }
}
