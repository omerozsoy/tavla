<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductCategoryResource\Pages;
use App\Models\ProductCategory;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

/**
 * Panelden yonetilen urun kategorileri (Tavla, Zar, Kitap, Zar Kulesi, Diger...).
 * Urunler bu listeden kategori secer; magaza filtresi de buradan gelir. Sira surukle-birak.
 */
class ProductCategoryResource extends Resource
{
    protected static ?string $model = ProductCategory::class;

    protected static ?string $navigationIcon = 'heroicon-o-squares-2x2';

    protected static ?string $navigationLabel = 'Kategoriler';

    protected static ?string $modelLabel = 'kategori';

    protected static ?string $pluralModelLabel = 'Kategoriler';

    protected static ?string $navigationGroup = 'Mağaza';

    protected static ?int $navigationSort = 0;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')
                ->label('Kategori adı')
                ->required()
                ->maxLength(60)
                ->live(onBlur: true)
                ->afterStateUpdated(function ($state, Forms\Get $get, Forms\Set $set) {
                    if (blank($get('slug'))) {
                        $set('slug', Str::slug((string) $state));
                    }
                }),
            Forms\Components\TextInput::make('slug')
                ->label('Slug (anahtar)')
                ->required()
                ->maxLength(70)
                ->unique(ignoreRecord: true)
                ->dehydrateStateUsing(fn ($state) => Str::slug((string) $state))
                ->helperText('Boş bırakırsan addan üretilir.'),
            Forms\Components\TextInput::make('sort')
                ->label('Sıra')
                ->numeric()
                ->default(0)
                ->helperText('Küçük sayı önce.'),
            Forms\Components\Toggle::make('published')
                ->label('Yayında')
                ->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('name')->label('Kategori')->searchable()->weight('medium'),
                Tables\Columns\TextColumn::make('slug')->label('Slug')->color('gray')->toggleable(),
                Tables\Columns\TextColumn::make('products_count')->label('Ürün')->counts('products')->badge(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('published')->label('Yayında'),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListProductCategories::route('/'),
            'create' => Pages\CreateProductCategory::route('/create'),
            'edit'   => Pages\EditProductCategory::route('/{record}/edit'),
        ];
    }
}
