<?php

namespace App\Filament\Resources;

use App\Filament\Concerns\ManagesCosmeticItems;
use App\Filament\Resources\CheckerDesignResource\Pages;
use App\Models\CosmeticItem;
use Filament\Resources\Resource;

/** Pul Tasarımı: grup / fiyat / satış yönetimi (Ayarlar'ın en altı, Tavla Tasarımı'ndan sonra). */
class CheckerDesignResource extends Resource
{
    use ManagesCosmeticItems;

    protected static string $kind = 'checker';

    protected static ?string $model = CosmeticItem::class;

    protected static ?string $navigationIcon = 'heroicon-o-stop-circle';

    protected static ?string $navigationLabel = 'Pul Tasarımı';

    protected static ?string $modelLabel = 'pul tasarımı';

    protected static ?string $pluralModelLabel = 'Pul Tasarımı';

    protected static ?string $slug = 'pul-tasarimi';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 101;

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCheckerDesigns::route('/'),
        ];
    }
}
