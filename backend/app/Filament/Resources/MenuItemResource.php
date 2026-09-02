<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MenuItemResource\Pages;
use App\Models\MenuItem;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * SOL MENU DUZENLEME. Satirlari SURUKLE-BIRAK ile sirala (sort), "Görünen ad" alanina
 * Turkce yaz (diger diller otomatik cevrilir) ve "Menüde" anahtariyla goster/gizle.
 * Katalog config/menu.php'den gelir; frontend /api/menu-config ile okur.
 *
 * Not: Sabit katalog -> ekleme/silme yok. Yeni sayfa pages.ts + config/menu.php ile gelir
 * (sayfa acilinca eksik anahtarlar otomatik eklenir).
 */
class MenuItemResource extends Resource
{
    protected static ?string $model = MenuItem::class;

    protected static ?string $navigationIcon = 'heroicon-o-bars-3';

    protected static ?string $navigationLabel = 'Sol Menü';

    protected static ?string $modelLabel = 'menü öğesi';

    protected static ?string $pluralModelLabel = 'Sol Menü';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 1;

    public static function canCreate(): bool
    {
        return false; // katalog sabit — ekleme yok
    }

    public static function table(Table $table): Table
    {
        $groupLabels = [
            'play' => 'Oyna',
            'compete' => 'Rekabet',
            'account' => 'Hesap',
            'content' => 'İçerik',
            'tools' => 'Araçlar',
            'info' => 'Bilgi',
        ];

        return $table
            ->reorderable('sort')   // surukle-birak -> sort gunceller
            ->defaultSort('sort')
            ->paginated(false)      // tum menu tek sayfada, siralama net gorunur
            ->columns([
                Tables\Columns\TextColumn::make('default_name')
                    ->label('Sayfa')
                    ->getStateUsing(fn (MenuItem $r) => $r->defaultLabel())
                    ->description(fn (MenuItem $r) => $groupLabels[$r->group] ?? $r->group)
                    ->weight('bold'),
                Tables\Columns\TextInputColumn::make('label_tr')
                    ->label('Görünen ad (boş = otomatik)')
                    ->placeholder(fn (MenuItem $r) => $r->defaultLabel()),
                Tables\Columns\TextColumn::make('label_en')
                    ->label('Çeviriler')
                    ->getStateUsing(fn (MenuItem $r) => collect([
                        'EN' => $r->label_en, 'ES' => $r->label_es, 'DE' => $r->label_de, 'FR' => $r->label_fr,
                    ])->filter()->map(fn ($v, $k) => "$k: $v")->implode('  ·  ') ?: '—')
                    ->color('gray')
                    ->wrap()
                    ->toggleable(),
                Tables\Columns\ToggleColumn::make('visible')
                    ->label('Menüde'),
            ])
            ->actions([]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMenuItems::route('/'),
        ];
    }
}
