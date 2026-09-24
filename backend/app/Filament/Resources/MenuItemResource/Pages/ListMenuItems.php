<?php

namespace App\Filament\Resources\MenuItemResource\Pages;

use App\Filament\Resources\MenuItemResource;
use App\Models\MenuGroup;
use App\Models\MenuItem;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListMenuItems extends ListRecords
{
    protected static string $resource = MenuItemResource::class;

    public function mount(): void
    {
        // Katalogdaki (config/menu.php) eksik anahtar/gruplar icin satir olustur (idempotent).
        MenuItem::syncCatalog();
        MenuGroup::syncCatalog(); // "Grup" secenekleri dolu gelsin
        parent::mount();
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()
                ->label('Özel Menü Öğesi Ekle')
                ->icon('heroicon-m-plus'),
            Actions\Action::make('sync')
                ->label('Menüyü Yenile')
                ->icon('heroicon-o-arrow-path')
                ->color('gray')
                ->action(function () {
                    MenuItem::syncCatalog();
                    MenuGroup::syncCatalog();
                    $this->redirect(static::getUrl());
                }),
        ];
    }
}
