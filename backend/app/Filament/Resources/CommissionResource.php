<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CommissionResource\Pages;
use App\Models\Commission;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Komisyon (rake) LEDGER'ı — bahisli maç settle'ında alınan platform payı (salt-okunur rapor).
 * Toplam sütun altında (Sum). Kayıtlar oyun motorunca yazılır; elle eklenmez/düzenlenmez.
 */
class CommissionResource extends Resource
{
    protected static ?string $model = Commission::class;

    protected static ?string $navigationIcon = 'heroicon-o-banknotes';

    protected static ?string $navigationLabel = 'Komisyonlar';

    protected static ?string $modelLabel = 'komisyon';

    protected static ?string $pluralModelLabel = 'Komisyonlar';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 3;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit($record): bool
    {
        return false;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]); // salt-okunur
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')->dateTime('d.m.Y H:i')->sortable(),
                Tables\Columns\TextColumn::make('room_code')->label('Oda')->searchable()->toggleable(),
                Tables\Columns\TextColumn::make('winner_id')->label('Kazanan #')->toggleable(),
                Tables\Columns\TextColumn::make('loser_id')->label('Kaybeden #')->toggleable(),
                Tables\Columns\TextColumn::make('stake')->label('Stake')
                    ->formatStateUsing(fn ($s) => number_format((int) $s).' GC')->sortable(),
                Tables\Columns\TextColumn::make('commission')->label('Komisyon')
                    ->formatStateUsing(fn ($s) => number_format((int) $s).' GC')->sortable()
                    ->color('success')
                    ->summarize(Tables\Columns\Summarizers\Sum::make()->label('Toplam komisyon')
                        ->formatStateUsing(fn ($s) => number_format((int) $s).' GC')),
                Tables\Columns\TextColumn::make('pct')->label('%')->formatStateUsing(fn ($s) => '%'.(int) $s),
            ])
            ->filters([
                Tables\Filters\Filter::make('created_at')
                    ->form([
                        \Filament\Forms\Components\DatePicker::make('from')->label('Başlangıç'),
                        \Filament\Forms\Components\DatePicker::make('until')->label('Bitiş'),
                    ])
                    ->query(function ($query, array $data) {
                        return $query
                            ->when($data['from'] ?? null, fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
                            ->when($data['until'] ?? null, fn ($q, $d) => $q->whereDate('created_at', '<=', $d));
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCommissions::route('/'),
        ];
    }
}
