<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductOrderResource\Pages;
use App\Models\ProductOrder;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Fiziksel urun siparisleri. Siparisler kullanicilar tarafindan olusturulur; panelde
 * yalnizca DURUM + kargo takip no + admin notu duzenlenir (siparis detaylari salt-okunur).
 * Coin siparisleri aninda 'paid'; money siparisleri odeme callback'inde 'paid' olur.
 */
class ProductOrderResource extends Resource
{
    protected static ?string $model = ProductOrder::class;

    protected static ?string $navigationIcon = 'heroicon-o-truck';

    protected static ?string $navigationLabel = 'Siparişler';

    protected static ?string $modelLabel = 'sipariş';

    protected static ?string $pluralModelLabel = 'Siparişler';

    protected static ?string $navigationGroup = 'Mağaza';

    protected static ?int $navigationSort = 2;

    // Yeni bekleyen (odenmis, kargolanmamis) siparis sayisi -> menu rozeti.
    public static function getNavigationBadge(): ?string
    {
        $n = ProductOrder::where('status', 'paid')->count();
        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function canCreate(): bool
    {
        return false; // siparisler yalnizca kullanici tarafindan olusturulur
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Sipariş')
                ->schema([
                    Forms\Components\TextInput::make('product_name')->label('Ürün')->disabled(),
                    Forms\Components\TextInput::make('color')->label('Renk')->disabled(),
                    Forms\Components\TextInput::make('qty')->label('Adet')->disabled(),
                    Forms\Components\Placeholder::make('bedel')
                        ->label('Bedel')
                        ->content(fn (?ProductOrder $r) => $r
                            ? ($r->payment_type === 'coin'
                                ? ((int) $r->coin_cost).' coin'
                                : number_format(((int) $r->amount) / 100, 2).' ₺')
                            : '—'),
                ])->columns(2),

            Forms\Components\Section::make('Alıcı & Kargo')
                ->schema([
                    Forms\Components\TextInput::make('ship_name')->label('Ad Soyad')->disabled(),
                    Forms\Components\TextInput::make('ship_phone')->label('Telefon')->disabled(),
                    Forms\Components\Textarea::make('ship_address')->label('Adres')->disabled()->columnSpanFull(),
                    Forms\Components\TextInput::make('ship_city')->label('Şehir')->disabled(),
                    Forms\Components\TextInput::make('ship_postal')->label('Posta kodu')->disabled(),
                    Forms\Components\Textarea::make('note')->label('Alıcı notu')->disabled()->columnSpanFull(),
                ])->columns(2),

            Forms\Components\Section::make('Yönetim')
                ->schema([
                    Forms\Components\Select::make('status')
                        ->label('Durum')
                        ->options(ProductOrder::STATUSES)
                        ->required(),
                    Forms\Components\TextInput::make('tracking')
                        ->label('Kargo takip no')
                        ->maxLength(120),
                    Forms\Components\Textarea::make('admin_note')
                        ->label('Admin notu (dahili)')
                        ->columnSpanFull(),
                ])->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('product_name')->label('Ürün')->searchable()
                    ->description(fn (ProductOrder $r) => $r->color ? 'Renk: '.$r->color : null),
                Tables\Columns\TextColumn::make('qty')->label('Adet'),
                Tables\Columns\TextColumn::make('user.name')->label('Alıcı')->searchable(),
                Tables\Columns\TextColumn::make('payment_type')->label('Ödeme')
                    ->formatStateUsing(fn ($state) => $state === 'coin' ? 'Coin' : 'TL')
                    ->badge(),
                Tables\Columns\TextColumn::make('bedel')->label('Bedel')
                    ->state(fn (ProductOrder $r) => $r->payment_type === 'coin'
                        ? ((int) $r->coin_cost).' coin'
                        : number_format(((int) $r->amount) / 100, 2).' ₺'),
                Tables\Columns\TextColumn::make('status')->label('Durum')
                    ->formatStateUsing(fn ($state) => ProductOrder::STATUSES[$state] ?? $state)
                    ->badge()
                    ->color(fn ($state) => match ($state) {
                        'pending'   => 'gray',
                        'paid'      => 'warning',
                        'shipped'   => 'info',
                        'delivered' => 'success',
                        'cancelled' => 'danger',
                        default     => 'gray',
                    }),
                Tables\Columns\TextColumn::make('tracking')->label('Takip no')->placeholder('—')->toggleable(),
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')->dateTime('d.m.Y H:i')->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')->options(ProductOrder::STATUSES),
                Tables\Filters\SelectFilter::make('payment_type')->label('Ödeme')
                    ->options(['coin' => 'Coin', 'money' => 'TL']),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Yönet'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListProductOrders::route('/'),
            'edit'  => Pages\EditProductOrder::route('/{record}/edit'),
        ];
    }
}
