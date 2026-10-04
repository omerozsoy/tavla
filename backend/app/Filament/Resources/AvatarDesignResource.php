<?php

namespace App\Filament\Resources;

use App\Filament\Concerns\ManagesCosmeticItems;
use App\Filament\Resources\AvatarDesignResource\Pages;
use App\Models\CosmeticItem;
use Filament\Resources\Resource;

/** Avatar Tasarımı: grup / fiyat / satış yönetimi (Ayarlar'ın en altı, Tavla Tasarımı'ndan sonra). */
class AvatarDesignResource extends Resource
{
    use ManagesCosmeticItems;

    protected static string $kind = 'frame';

    protected static ?string $model = CosmeticItem::class;

    protected static ?string $navigationIcon = 'heroicon-o-user-circle';

    protected static ?string $navigationLabel = 'Avatar Tasarımı';

    protected static ?string $modelLabel = 'avatar tasarımı';

    protected static ?string $pluralModelLabel = 'Avatar Tasarımı';

    protected static ?string $slug = 'avatar-tasarimi';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 100;

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAvatarDesigns::route('/'),
        ];
    }
}
