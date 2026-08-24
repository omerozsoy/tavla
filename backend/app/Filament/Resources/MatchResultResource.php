<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MatchResultResource\Pages;
use App\Models\MatchResult;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class MatchResultResource extends Resource
{
    protected static ?string $model = MatchResult::class;

    protected static ?string $navigationIcon = 'heroicon-o-trophy';

    protected static ?string $navigationLabel = 'Maç Geçmişi';

    protected static ?string $modelLabel = 'maç';

    protected static ?string $pluralModelLabel = 'Maç Geçmişi';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 1;

    // Sonuclar oyun motorunca yazilir; elle eklenmez/duzenlenmez.
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
                Tables\Columns\TextColumn::make('user.nickname')->label('Oyuncu')->searchable()->default('—'),
                Tables\Columns\IconColumn::make('won')->label('Kazandı')->boolean(),
                Tables\Columns\TextColumn::make('match_length')->label('Uzunluk')
                    ->formatStateUsing(fn ($state) => $state ? $state.' puan' : 'Tek oyun'),
                Tables\Columns\TextColumn::make('opponent_rating')->label('Rakip P.')->sortable()->toggleable(),
                Tables\Columns\TextColumn::make('rating_after')->label('Puan')->sortable(),
                Tables\Columns\TextColumn::make('delta')->label('Δ')
                    ->formatStateUsing(fn ($state) => ($state > 0 ? '+' : '').(int) $state)
                    ->color(fn ($state) => $state > 0 ? 'success' : ($state < 0 ? 'danger' : 'gray')),
                Tables\Columns\TextColumn::make('pr')->label('PR')
                    ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((float) $state, 2))
                    ->toggleable(),
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')->dateTime('d.m.Y H:i')->sortable(),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('won')->label('Sonuç')
                    ->trueLabel('Galibiyet')->falseLabel('Mağlubiyet'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMatchResults::route('/'),
        ];
    }
}
