<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductResource\Pages;
use App\Models\Product;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

/**
 * Fiziksel magaza urunleri (Tavla, zar, kitap, zar kulesi vb.). Panelden yonetilir.
 * Odeme tipi urun bazinda: coin | money (TL) | both. Renk = YALNIZCA gorsel varyant
 * (ayni stok/fiyat). Fiyatlar formda TL girilir, KURUS saklanir (banka birimi).
 */
class ProductResource extends Resource
{
    protected static ?string $model = Product::class;

    protected static ?string $navigationIcon = 'heroicon-o-shopping-bag';

    protected static ?string $navigationLabel = 'Ürünler';

    protected static ?string $modelLabel = 'ürün';

    protected static ?string $pluralModelLabel = 'Ürünler';

    protected static ?string $navigationGroup = 'Mağaza';

    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')
                ->label('Ürün adı')
                ->required()
                ->maxLength(120)
                ->live(onBlur: true)
                // Slug bosken addan otomatik uret (yeni kayit).
                ->afterStateUpdated(function ($state, Get $get, Forms\Set $set) {
                    if (blank($get('slug'))) {
                        $set('slug', Str::slug((string) $state));
                    }
                }),
            Forms\Components\TextInput::make('slug')
                ->label('Slug (URL anahtarı)')
                ->required()
                ->maxLength(140)
                ->unique(ignoreRecord: true)
                ->dehydrateStateUsing(fn ($state) => Str::slug((string) $state))
                ->helperText('Boş bırakırsan addan üretilir.'),
            Forms\Components\Select::make('category_id')
                ->label('Kategori')
                ->relationship('category', 'name', fn ($query) => $query->orderBy('sort'))
                ->searchable()
                ->preload()
                ->required()
                // Formdan hizli yeni kategori ekleme (ad + otomatik slug).
                ->createOptionForm([
                    Forms\Components\TextInput::make('name')->label('Kategori adı')->required()->maxLength(60),
                ])
                ->createOptionUsing(fn (array $data) => \App\Models\ProductCategory::create([
                    'name' => $data['name'],
                    'slug' => Str::slug($data['name']),
                    'sort' => (int) (\App\Models\ProductCategory::max('sort') ?? 0) + 1,
                ])->id),
            Forms\Components\Textarea::make('description')
                ->label('Açıklama')
                ->rows(4)
                ->maxLength(2000)
                ->columnSpanFull(),

            Forms\Components\FileUpload::make('images')
                ->label('Görseller (galeri)')
                ->image()
                ->multiple()
                ->reorderable()
                ->disk('uploads')
                ->directory('urunler')
                ->visibility('public')
                ->maxFiles(8)
                ->helperText('İlk görsel kapak olarak kullanılır.')
                ->columnSpanFull(),

            // Renk = gorsel varyant. Ayni stok/fiyat; kullanici yalnizca rengini secer.
            Forms\Components\Repeater::make('colors')
                ->label('Renk seçenekleri (görsel)')
                ->helperText('Renkler aynı ürünün varyantıdır; stok ve fiyat tüm renklerde aynıdır. Boş bırakırsan ürünün rengi tek olur.')
                ->schema([
                    Forms\Components\TextInput::make('name')
                        ->label('Renk adı')
                        ->required()
                        ->maxLength(40)
                        ->placeholder('ör. Ceviz, Siyah, Kırmızı'),
                    Forms\Components\ColorPicker::make('hex')
                        ->label('Renk')
                        ->required(),
                ])
                ->columns(2)
                ->reorderable()
                ->defaultItems(0)
                ->addActionLabel('Renk ekle')
                ->itemLabel(fn (array $state): ?string => $state['name'] ?? null)
                ->columnSpanFull(),

            Forms\Components\Section::make('Fiyatlandırma & Stok')
                ->schema([
                    Forms\Components\Select::make('payment_type')
                        ->label('Ödeme tipi')
                        ->options([
                            'money' => 'Gerçek para (TL)',
                            'coin'  => 'Coin',
                            'both'  => 'İkisi de (TL veya coin)',
                        ])
                        ->default('money')
                        ->required()
                        ->live(),
                    Forms\Components\TextInput::make('money_price')
                        ->label('Fiyat (TL)')
                        ->numeric()
                        ->minValue(0)
                        ->suffix('₺')
                        ->visible(fn (Get $get) => in_array($get('payment_type'), ['money', 'both'], true))
                        ->required(fn (Get $get) => in_array($get('payment_type'), ['money', 'both'], true))
                        // TL <-> kurus donusumu (banka birimi).
                        ->formatStateUsing(fn ($state) => $state !== null ? ((int) $state) / 100 : null)
                        ->dehydrateStateUsing(fn ($state) => $state !== null && $state !== '' ? (int) round(((float) $state) * 100) : null),
                    Forms\Components\TextInput::make('coin_price')
                        ->label('Fiyat (coin)')
                        ->numeric()
                        ->minValue(0)
                        ->visible(fn (Get $get) => in_array($get('payment_type'), ['coin', 'both'], true))
                        ->required(fn (Get $get) => in_array($get('payment_type'), ['coin', 'both'], true)),
                    Forms\Components\TextInput::make('stock')
                        ->label('Stok adedi')
                        ->numeric()
                        ->minValue(0)
                        ->default(0)
                        ->required()
                        ->helperText('0 = tükendi (satın alınamaz).'),
                ])
                ->columns(2),

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
                Tables\Columns\ImageColumn::make('images.0')->label('Görsel')->disk('uploads')->square(),
                Tables\Columns\TextColumn::make('name')->label('Ürün')->searchable()->weight('medium'),
                Tables\Columns\TextColumn::make('category.name')->label('Kategori')
                    ->badge()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('payment_type')->label('Ödeme')
                    ->formatStateUsing(fn ($s) => match ($s) {
                        'coin' => 'Coin', 'both' => 'TL / Coin', default => 'TL',
                    })
                    ->badge(),
                Tables\Columns\TextColumn::make('money_price')->label('TL')
                    ->formatStateUsing(fn ($s) => $s ? number_format(((int) $s) / 100, 2).' ₺' : '—'),
                Tables\Columns\TextColumn::make('coin_price')->label('Coin')
                    ->formatStateUsing(fn ($s) => $s ? (int) $s : '—'),
                Tables\Columns\TextColumn::make('stock')->label('Stok')
                    ->badge()
                    ->color(fn ($state) => (int) $state > 0 ? 'success' : 'danger'),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable()->toggleable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('category_id')->label('Kategori')
                    ->relationship('category', 'name'),
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
            'index'  => Pages\ListProducts::route('/'),
            'create' => Pages\CreateProduct::route('/create'),
            'edit'   => Pages\EditProduct::route('/{record}/edit'),
        ];
    }
}
