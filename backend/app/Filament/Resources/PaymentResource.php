<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PaymentResource\Pages;
use App\Models\Payment;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class PaymentResource extends Resource
{
    protected static ?string $model = Payment::class;

    protected static ?string $navigationIcon = 'heroicon-o-credit-card';

    protected static ?string $navigationLabel = 'Ödeme Kayıtları';

    protected static ?string $modelLabel = 'ödeme';

    protected static ?string $pluralModelLabel = 'Ödeme Kayıtları';

    protected static ?string $navigationGroup = 'Finans';

    protected static ?int $navigationSort = 1;

    // Kayitlar sadece okunur (banka callback'i olusturur; elle eklenmez/silinmez).
    public static function canCreate(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('user.nickname')->label('Üye')->searchable()->default('—'),
                Tables\Columns\TextColumn::make('plan')->label('Plan')->badge(),
                Tables\Columns\TextColumn::make('period')->label('Dönem')
                    ->formatStateUsing(fn ($state) => $state === 'yearly' ? 'Yıllık' : 'Aylık'),
                Tables\Columns\TextColumn::make('amount')->label('Tutar')->sortable()
                    ->formatStateUsing(fn ($state) => number_format(((int) $state) / 100, 2, ',', '.').' ₺'),
                Tables\Columns\TextColumn::make('status')->label('Durum')->badge()
                    ->color(fn ($state) => match ($state) {
                        'paid' => 'success',
                        'failed' => 'danger',
                        default => 'gray',
                    })
                    ->formatStateUsing(fn ($state) => match ($state) {
                        'paid' => 'Ödendi',
                        'failed' => 'Başarısız',
                        'pending' => 'Bekliyor',
                        default => $state,
                    }),
                Tables\Columns\TextColumn::make('order_id')->label('Sipariş')->searchable()->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')->dateTime('d.m.Y H:i')->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')->options([
                    'paid' => 'Ödendi',
                    'failed' => 'Başarısız',
                    'pending' => 'Bekliyor',
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPayments::route('/'),
        ];
    }
}
