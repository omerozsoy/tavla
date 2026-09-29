<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CoinPackageResource\Pages;
use App\Models\CoinPackage;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

/**
 * Coin (jeton) paketleri — "TL öde -> coin al". Fiziksel Urunler'den AYRI (stok/kargo/renk yok).
 * Fiyat formda TL girilir, KURUS saklanir (banka birimi). Odemede SUNUCU-OTORITER: PaymentController
 * bu tablodan okur; frontend fiyati /api/shop/coin-packages ile CANLI ceker -> panelde degistir,
 * sitede aninda yansir (deploy/rebuild gerekmez).
 */
class CoinPackageResource extends Resource
{
    protected static ?string $model = CoinPackage::class;

    protected static ?string $navigationIcon = 'heroicon-o-banknotes';

    protected static ?string $navigationLabel = 'Coin Paketleri';

    protected static ?string $modelLabel = 'coin paketi';

    protected static ?string $pluralModelLabel = 'Coin Paketleri';

    protected static ?string $navigationGroup = 'Mağaza';

    protected static ?int $navigationSort = 2; // Urunler (1) hemen altinda

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')
                ->label('Paket adı')
                ->required()
                ->maxLength(60)
                ->placeholder('ör. Kese')
                ->live(onBlur: true)
                ->afterStateUpdated(function ($state, Get $get, Forms\Set $set) {
                    if (blank($get('slug'))) {
                        $set('slug', Str::slug((string) $state));
                    }
                }),
            Forms\Components\TextInput::make('slug')
                ->label('Slug (kalıcı anahtar)')
                ->required()
                ->maxLength(40)
                ->unique(ignoreRecord: true)
                ->dehydrateStateUsing(fn ($state) => Str::slug((string) $state))
                ->helperText('Sepet/ödeme kimliği. Boş bırakırsan addan üretilir. Yayındaki bir paketin slug\'ını DEĞİŞTİRME (eski sepetler kırılır).'),

            Forms\Components\Section::make('Fiyat & İçerik')
                ->schema([
                    Forms\Components\TextInput::make('price')
                        ->label('Fiyat (TL)')
                        ->numeric()
                        ->minValue(0)
                        ->step(0.01)
                        ->suffix('₺')
                        ->required()
                        // TL <-> kurus (banka birimi).
                        ->formatStateUsing(fn ($state) => $state !== null ? ((int) $state) / 100 : null)
                        ->dehydrateStateUsing(fn ($state) => $state !== null && $state !== '' ? (int) round(((float) $state) * 100) : null),
                    Forms\Components\TextInput::make('coins')
                        ->label('Verilen coin')
                        ->numeric()
                        ->minValue(1)
                        ->required()
                        ->suffix('coin'),
                    Forms\Components\TextInput::make('discount')
                        ->label('Avantaj rozeti (%)')
                        ->numeric()
                        ->minValue(0)
                        ->maxValue(100)
                        ->default(0)
                        ->helperText('Sadece görsel rozet (coin başı indirim); ödemeyi etkilemez.'),
                ])
                ->columns(3),

            Forms\Components\Toggle::make('popular')
                ->label('"EN POPÜLER" rozeti')
                ->default(false),
            Forms\Components\Toggle::make('published')
                ->label('Yayında')
                ->default(true),
            Forms\Components\TextInput::make('sort')
                ->label('Sıra')
                ->numeric()
                ->default(0)
                ->helperText('Küçük sayı önce.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('name')->label('Paket')->searchable()->weight('medium'),
                Tables\Columns\TextColumn::make('slug')->label('Slug')->color('gray')->toggleable(),
                Tables\Columns\TextColumn::make('price')->label('Fiyat')
                    ->formatStateUsing(fn ($state) => number_format(((int) $state) / 100, 2).' ₺'),
                Tables\Columns\TextColumn::make('coins')->label('Coin')
                    ->formatStateUsing(fn ($state) => number_format((int) $state, 0, ',', '.')),
                Tables\Columns\TextColumn::make('discount')->label('Avantaj')
                    ->formatStateUsing(fn ($state) => (int) $state > 0 ? '%'.(int) $state : '—'),
                Tables\Columns\IconColumn::make('popular')->label('Popüler')->boolean(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable()->toggleable(),
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
            'index'  => Pages\ListCoinPackages::route('/'),
            'create' => Pages\CreateCoinPackage::route('/create'),
            'edit'   => Pages\EditCoinPackage::route('/{record}/edit'),
        ];
    }
}
