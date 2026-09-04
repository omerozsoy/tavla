<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MatchResultResource\Pages;
use App\Models\MatchResult;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

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

    public static function canEdit($record): bool
    {
        return false;
    }

    /**
     * ONLINE MAÇ TEK SATIR: bir online maç iki match_results satırı üretir (her
     * oyuncunun kendi PR'ı ayrı kaydedilir). Aynı room_code'un iki satırından
     * yalnız kanonik olanı (en küçük id) göster; satır zaten Oyuncu+Rakip'i,
     * iki tarafın PR'ını ve skoru taşıdığı için bilgi kaybı yok. Oda kodsuz
     * (pvb / yerel / eski) satırlar olduğu gibi kalır. Filament'in ekleyeceği
     * filtre where'leri ile doğru AND önceliği için tek where grubuna sarılır.
     */
    public static function dedupeOnlineRows(Builder $query): Builder
    {
        return $query->where(function (Builder $outer) {
            $outer->where(function (Builder $q) {
                $q->whereNull('room_code')->orWhere('room_code', '=', '');
            })->orWhereIn('id', function ($sub) {
                $sub->selectRaw('MIN(id)')
                    ->from('match_results')
                    ->whereNotNull('room_code')
                    ->where('room_code', '!=', '')
                    ->groupBy('room_code');
            });
        });
    }

    // Oyun turu etiketi: 'coin' = Jeton/para maci (bahis > 0), aksi = N-puanlik mac.
    public static function matchTypeLabel(?string $type, $matchLength = null): string
    {
        if ($type === 'coin') {
            return 'Jeton (para)';
        }

        return ((int) $matchLength) > 1 ? ((int) $matchLength).' puanlık maç' : 'Tek oyun';
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->modifyQueryUsing(function (Builder $query) {
                // N+1 onle: her satir icin oyuncu + oda (bahis) tek sorguda gelsin.
                $query->with(['user', 'room']);
                static::dedupeOnlineRows($query);
            })
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('user.nickname')->label('Oyuncu')
                    ->searchable()->sortable()->default('—')
                    ->description(fn (MatchResult $r) => $r->user_id ? 'ID '.$r->user_id : null),
                Tables\Columns\TextColumn::make('opponent_name')->label('Rakip')
                    ->searchable()->default('—')
                    ->description(fn (MatchResult $r) => $r->opponent_rating ? 'Puan '.$r->opponent_rating : null),
                Tables\Columns\TextColumn::make('won')->label('Sonuç')->badge()
                    ->formatStateUsing(fn ($state) => $state ? 'Galibiyet' : 'Mağlubiyet')
                    ->color(fn ($state) => $state ? 'success' : 'danger'),
                Tables\Columns\TextColumn::make('score')->label('Skor')
                    ->state(fn (MatchResult $r) => ($r->score_self === null && $r->score_opp === null)
                        ? '—'
                        : ((int) $r->score_self).' - '.((int) $r->score_opp)),
                Tables\Columns\TextColumn::make('match_type')->label('Tür')->badge()
                    ->formatStateUsing(fn ($state, MatchResult $r) => static::matchTypeLabel($state, $r->match_length))
                    ->color(fn ($state) => $state === 'coin' ? 'warning' : 'info'),
                Tables\Columns\TextColumn::make('room.stake')->label('Bahis (coin)')
                    ->formatStateUsing(fn ($state) => $state ? number_format((int) $state).' coin' : '—')
                    ->color(fn ($state) => $state ? 'warning' : 'gray')
                    ->alignEnd(),
                Tables\Columns\TextColumn::make('pr')->label('PR')
                    ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((float) $state, 2))
                    ->color(fn ($state) => $state === null ? 'gray' : ($state <= 5 ? 'success' : ($state <= 10 ? 'warning' : 'danger')))
                    ->sortable(),
                Tables\Columns\TextColumn::make('opponent_pr')->label('Rakip PR')
                    ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((float) $state, 2))
                    ->toggleable(),
                Tables\Columns\TextColumn::make('luck')->label('Şans')
                    ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((float) $state, 2))
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('rating_after')->label('Puan')->sortable(),
                Tables\Columns\TextColumn::make('delta')->label('Δ')
                    ->formatStateUsing(fn ($state) => ($state > 0 ? '+' : '').(int) $state)
                    ->color(fn ($state) => $state > 0 ? 'success' : ($state < 0 ? 'danger' : 'gray')),
                Tables\Columns\TextColumn::make('coins_after')->label('Bakiye')
                    ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((int) $state))
                    ->toggleable(),
                Tables\Columns\TextColumn::make('room_code')->label('Oda')
                    ->copyable()->default('—')->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('created_at')->label('Tarih / Saat')
                    ->dateTime('d.m.Y H:i:s')->sortable(),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('won')->label('Sonuç')
                    ->trueLabel('Galibiyet')->falseLabel('Mağlubiyet'),
                Tables\Filters\SelectFilter::make('match_type')->label('Tür')->options([
                    'coin' => 'Jeton (para maçı)',
                    'match' => 'Puanlık maç',
                ]),
                Tables\Filters\Filter::make('created_at')
                    ->form([
                        \Filament\Forms\Components\DatePicker::make('from')->label('Başlangıç'),
                        \Filament\Forms\Components\DatePicker::make('until')->label('Bitiş'),
                    ])
                    ->query(fn (Builder $query, array $data) => $query
                        ->when($data['from'] ?? null, fn (Builder $q, $d) => $q->whereDate('created_at', '>=', $d))
                        ->when($data['until'] ?? null, fn (Builder $q, $d) => $q->whereDate('created_at', '<=', $d))),
            ])
            ->actions([
                Tables\Actions\ViewAction::make()->label('Detay'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMatchResults::route('/'),
            'view' => Pages\ViewMatchResult::route('/{record}'),
        ];
    }
}
