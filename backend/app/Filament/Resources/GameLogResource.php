<?php

namespace App\Filament\Resources;

use App\Filament\Resources\GameLogResource\Pages;
use App\Models\GameLog;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Oynanan TÜM maçların hamle+zar kaydı (salt-okunur). Kayıtları oyun motoru/istemci yazar;
 * elle eklenmez/düzenlenmez. Detay sayfası iki oyuncunun turlarını birleştirip oyun-oyun
 * adım adım metin logu (renk / zar / hamle) gösterir.
 */
class GameLogResource extends Resource
{
    protected static ?string $model = GameLog::class;

    protected static ?string $navigationIcon = 'heroicon-o-clipboard-document-list';

    protected static ?string $navigationLabel = 'Maç Kayıtları';

    protected static ?string $modelLabel = 'maç kaydı';

    protected static ?string $pluralModelLabel = 'Maç Kayıtları';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 2;

    protected static ?string $recordTitleAttribute = 'uid';

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit($record): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('uid')->label('Maç ID')->searchable()->copyable(),
                Tables\Columns\TextColumn::make('mode')->label('Tür')->badge()
                    ->formatStateUsing(fn ($state) => match ($state) {
                        'pvb' => 'Bilgisayar',
                        'online' => 'Online',
                        'local' => 'Yerel',
                        default => $state,
                    })
                    ->color(fn ($state) => match ($state) {
                        'online' => 'success',
                        'pvb' => 'info',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('p1_name')->label('Oyuncu 1')->default('—')->searchable(),
                Tables\Columns\TextColumn::make('p2_name')->label('Oyuncu 2')->default('—')->searchable(),
                Tables\Columns\TextColumn::make('target')->label('Uzunluk')
                    ->formatStateUsing(fn ($state) => $state > 1 ? $state.' puan' : 'Tek oyun'),
                Tables\Columns\TextColumn::make('winner')->label('Kazanan')
                    ->formatStateUsing(fn ($state) => match ($state) {
                        'white' => 'Beyaz',
                        'black' => 'Siyah',
                        default => '—',
                    }),
                Tables\Columns\TextColumn::make('status')->label('Durum')->badge()
                    ->formatStateUsing(fn ($state) => $state === 'finished' ? 'Bitti' : 'Sürüyor')
                    ->color(fn ($state) => $state === 'finished' ? 'success' : 'warning'),
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')
                    ->dateTime('d.m.Y H:i', 'Europe/Istanbul')->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('mode')->label('Tür')->options([
                    'pvb' => 'Bilgisayar',
                    'online' => 'Online',
                    'local' => 'Yerel',
                ]),
                Tables\Filters\SelectFilter::make('status')->label('Durum')->options([
                    'playing' => 'Sürüyor',
                    'finished' => 'Bitti',
                ]),
            ])
            ->actions([
                Tables\Actions\ViewAction::make()->label('İncele'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListGameLogs::route('/'),
            'view' => Pages\ViewGameLog::route('/{record}'),
        ];
    }
}
