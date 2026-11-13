<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TournamentAnnouncementResource\Pages;
use App\Models\Setting;
use App\Models\Tournament;
use App\Models\TournamentAnnouncement;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use FilamentTiptapEditor\TiptapEditor;

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
            // Standart metinler ayrı "Duyuru Standart Metinleri" sayfasından (Ayarlar grubu) düzenlenir;
            // turnuva seçilince tipine göre aşağıdaki "Duyuru metni" alanına Setting'ten otomatik dolar.
            Forms\Components\Select::make('tournament_id')
                ->label('Turnuva')
                ->relationship('tournament', 'name')
                ->searchable()
                ->preload()
                ->required()
                ->live()
                ->afterStateUpdated(function ($state, Forms\Set $set) {
                    $type = Tournament::whereKey($state)->value('type');
                    if ($type === null) {
                        return;
                    }
                    // bracket -> std_bracket, aksi (swiss_triple vb.) -> std_swiss (tek kaynak: Setting)
                    $set('message', Setting::get($type === 'bracket' ? 'tournament_std_bracket' : 'tournament_std_swiss'));
                }),
            // Zengin metin (TipTap): kalın, italik, RENK, hizalama, liste, link... (makale/haber ile aynı).
            // HTML olarak saklanır; lobide güvenli-render edilir (RawHtml, admin-authored).
            TiptapEditor::make('message')
                ->label('Duyuru metni')
                ->profile('default')
                ->disk('uploads')->directory('tournament-announce')->visibility('public')
                ->helperText('Kalın/italik ve RENK için araç çubuğunu kullan (A harfi = metin rengi).')
                ->required()
                ->columnSpanFull(),
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
                    ->formatStateUsing(fn ($state) => trim(strip_tags((string) $state))) // HTML -> düz önizleme
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
