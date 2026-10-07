<?php

namespace App\Filament\Resources;

use App\Filament\Resources\FooterLinkResource\Pages;
use App\Models\FooterLink;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * FOOTER BAĞLANTILARI — bir kolonun İÇİNDEKİ linklerin sırasını/görünürlüğünü/başlığını yönet.
 * ÖNCE üstten bir KOLON seç (filtre), sonra satırları SÜRÜKLE-BIRAK ile sırala. "Başlık" alanına
 * Türkçe yaz (diğer diller otomatik; boş = varsayılan). "Göster" ile linki footer'da aç/kapa.
 * Kolonların kendi sırası/başlığı ayrı: "Footer Kolonları". Yeni link eklenmez/silinmez (sabit set).
 */
class FooterLinkResource extends Resource
{
    protected static ?string $model = FooterLink::class;

    protected static ?string $navigationIcon = 'heroicon-o-link';

    protected static ?string $navigationLabel = 'Footer Bağlantıları';

    protected static ?string $modelLabel = 'footer bağlantısı';

    protected static ?string $pluralModelLabel = 'Footer Bağlantıları';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 4;

    // Sabit set: panelden yeni link eklenmez/silinmez (yalnız sıra/başlık/görünürlük).
    public static function canCreate(): bool
    {
        return false;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]); // inline (tablo içi) düzenlenir
    }

    public static function table(Table $table): Table
    {
        $columnOptions = collect(FooterLink::ITEMS)
            ->pluck('column')->unique()
            ->mapWithKeys(fn ($c) => [$c => (\App\Models\FooterColumn::DEFAULTS[$c] ?? $c)])
            ->all();

        return $table
            ->reorderable('sort')   // sürükle-bırak -> kolon içi link sırası (önce kolon filtrele)
            ->defaultSort('sort')
            ->paginated(false)
            ->columns([
                Tables\Columns\TextColumn::make('item_key')
                    ->label('Bağlantı')
                    ->formatStateUsing(fn (FooterLink $r) => $r->defaultLabel())
                    ->description(fn (FooterLink $r) => $r->item_key),
                Tables\Columns\TextColumn::make('column_key')
                    ->label('Kolon')
                    ->badge()
                    ->color('gray')
                    ->formatStateUsing(fn (string $state) => \App\Models\FooterColumn::DEFAULTS[$state] ?? $state),
                Tables\Columns\TextInputColumn::make('label_tr')
                    ->label('Başlık (boş = varsayılan)')
                    ->placeholder(fn (FooterLink $r) => $r->defaultLabel()),
                Tables\Columns\ToggleColumn::make('visible')
                    ->label('Footer’da göster')
                    ->tooltip('Kapalıysa bu bağlantı footer’da görünmez.'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('column_key')
                    ->label('Kolon')
                    ->options($columnOptions),
            ])
            ->actions([]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListFooterLinks::route('/'),
        ];
    }
}
