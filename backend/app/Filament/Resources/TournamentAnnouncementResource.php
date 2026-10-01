<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TournamentAnnouncementResource\Pages;
use App\Models\TournamentAnnouncement;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

// "Turnuva Duyuru" paneli: admin bir turnuva secip duyuru metni yazar. Duyuru turnuva
// lobisinde (detay sayfasi) oyunculara gosterilir; yeni duyuruda istemci zil sesi calar.
class TournamentAnnouncementResource extends Resource
{
    protected static ?string $model = TournamentAnnouncement::class;

    protected static ?string $navigationIcon = 'heroicon-o-megaphone';

    protected static ?string $navigationLabel = 'Turnuva Duyuru';

    protected static ?string $modelLabel = 'turnuva duyurusu';

    protected static ?string $pluralModelLabel = 'Turnuva Duyuruları';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Select::make('tournament_id')
                ->label('Turnuva')
                ->relationship('tournament', 'name')
                ->searchable()
                ->preload()
                ->required(),
            Forms\Components\Textarea::make('message')
                ->label('Duyuru metni')
                ->placeholder('Örn: Turnuva başlıyor! Lütfen masalarınıza geçin.')
                ->rows(3)
                ->maxLength(500)
                ->required(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('tournament.name')
                    ->label('Turnuva')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('message')
                    ->label('Duyuru')
                    ->wrap()
                    ->limit(80),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Zaman')
                    ->dateTime('d.m.Y H:i')
                    ->sortable(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\DeleteBulkAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTournamentAnnouncements::route('/'),
            'create' => Pages\CreateTournamentAnnouncement::route('/create'),
            'edit' => Pages\EditTournamentAnnouncement::route('/{record}/edit'),
        ];
    }
}
