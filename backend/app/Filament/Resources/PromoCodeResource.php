<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PromoCodeResource\Pages;
use App\Models\PromoCode;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Indirim (promo) kodlari yonetimi. Coin sepeti odemesinde SUNUCU-OTORITER indirim.
 * Yuzde veya sabit (TL) indirim; son tarih, asgari sepet, kullanim limiti.
 * NOT: sabit indirim + asgari sepet TL girilir, KURUS saklanir (banka birimi).
 */
class PromoCodeResource extends Resource
{
    protected static ?string $model = PromoCode::class;

    protected static ?string $navigationIcon = 'heroicon-o-tag';

    protected static ?string $navigationLabel = 'Promo Kodları';

    protected static ?string $modelLabel = 'promo kodu';

    protected static ?string $pluralModelLabel = 'Promo Kodları';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 4;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('code')
                ->label('Kod')
                ->required()
                ->maxLength(40)
                ->dehydrateStateUsing(fn ($state) => strtoupper(trim((string) $state)))
                ->unique(ignoreRecord: true)
                ->helperText('Kullanıcılar büyük/küçük harf farkı olmadan girebilir.'),
            Forms\Components\Select::make('type')
                ->label('İndirim tipi')
                ->options(['percent' => 'Yüzde (%)', 'fixed' => 'Sabit (TL)'])
                ->default('percent')
                ->required()
                ->live(),
            Forms\Components\TextInput::make('value')
                ->label(fn (Get $get) => $get('type') === 'fixed' ? 'İndirim (TL)' : 'İndirim (%)')
                ->numeric()
                ->required()
                ->minValue(1)
                ->suffix(fn (Get $get) => $get('type') === 'fixed' ? '₺' : '%')
                // Sabit ise TL<->kurus donusumu; yuzde ise ham deger.
                ->formatStateUsing(fn ($state, ?PromoCode $record) => ($record?->type === 'fixed') ? ((int) $state) / 100 : $state)
                ->dehydrateStateUsing(fn ($state, Get $get) => $get('type') === 'fixed' ? (int) round(((float) $state) * 100) : (int) $state)
                ->helperText(fn (Get $get) => $get('type') === 'fixed' ? 'Sepetten düşülecek sabit TL tutarı.' : '1-100 arası yüzde.'),
            Forms\Components\TextInput::make('min_amount')
                ->label('Asgari sepet (TL)')
                ->numeric()
                ->default(0)
                ->formatStateUsing(fn ($state) => ((int) $state) / 100)
                ->dehydrateStateUsing(fn ($state) => (int) round(((float) $state) * 100))
                ->helperText('Bu tutarın altındaki sepette kod geçersiz. 0 = sınır yok.'),
            Forms\Components\TextInput::make('max_uses')
                ->label('Maksimum kullanım')
                ->numeric()
                ->minValue(1)
                ->helperText('Boş = sınırsız. Yalnız başarılı ödemeler sayılır.'),
            Forms\Components\Toggle::make('active')
                ->label('Aktif')
                ->default(true),
            Forms\Components\DateTimePicker::make('expires_at')
                ->label('Son kullanım tarihi')
                ->helperText('Boş = süresiz.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('code')->label('Kod')->searchable()->copyable()->weight('medium'),
                Tables\Columns\TextColumn::make('type')->label('Tip')
                    ->formatStateUsing(fn ($s) => $s === 'fixed' ? 'Sabit' : 'Yüzde')
                    ->badge(),
                Tables\Columns\TextColumn::make('value')->label('İndirim')
                    ->formatStateUsing(fn ($state, PromoCode $r) => $r->type === 'fixed'
                        ? number_format(((int) $state) / 100, 2).' ₺'
                        : '%'.(int) $state),
                Tables\Columns\TextColumn::make('min_amount')->label('Asgari')
                    ->formatStateUsing(fn ($s) => ((int) $s) > 0 ? number_format(((int) $s) / 100, 2).' ₺' : '—')
                    ->toggleable(),
                Tables\Columns\TextColumn::make('used_count')->label('Kullanım')
                    ->formatStateUsing(fn ($s, PromoCode $r) => (int) $s.($r->max_uses ? ' / '.(int) $r->max_uses : '')),
                Tables\Columns\IconColumn::make('active')->label('Aktif')->boolean(),
                Tables\Columns\TextColumn::make('expires_at')->label('Son tarih')->dateTime('d.m.Y H:i')->placeholder('Süresiz')->toggleable(),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('active')->label('Aktif'),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListPromoCodes::route('/'),
            'create' => Pages\CreatePromoCode::route('/create'),
            'edit'   => Pages\EditPromoCode::route('/{record}/edit'),
        ];
    }
}
