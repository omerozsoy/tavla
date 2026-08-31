<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TournamentAdResource\Pages;
use App\Models\TournamentAd;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Ana sayfanin en ustunde YAN YANA gosterilen (en fazla 3) turnuva reklam gorselleri.
 * Her gorsel bir turnuvaya baglanir; ziyaretci tiklayinca o turnuvanin detayina gider.
 * Tablo 'sort' ile surukle-birak siralanir; ilk 3 yayindaki kayit ana sayfada cikar.
 */
class TournamentAdResource extends Resource
{
    protected static ?string $model = TournamentAd::class;

    protected static ?string $navigationIcon = 'heroicon-o-megaphone';

    protected static ?string $navigationLabel = 'Turnuva Reklam';

    protected static ?string $modelLabel = 'turnuva reklamı';

    protected static ?string $pluralModelLabel = 'Turnuva Reklam';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form->schema([
            // Gorsel: bilgisayardan resim sec (public/uploads/turnuva-reklam altina yuklenir)
            Forms\Components\FileUpload::make('image')->label('Reklam görseli')
                ->image()->disk('uploads')->directory('turnuva-reklam')->visibility('public')
                ->imageEditor()->maxSize(5120)
                ->helperText('Yan yana 3 görsel gösterilir; benzer en–boy oranı (örn. 16:9) önerilir. En fazla 5 MB.')
                ->required()
                ->columnSpanFull(),
            Forms\Components\Select::make('tournament_id')
                ->label('Bağlı turnuva')
                ->relationship('tournament', 'name')
                ->searchable()
                ->preload()
                ->helperText('Görsele tıklayınca bu turnuvanın detay sayfası açılır.')
                ->required(),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0)
                ->helperText('Küçük sayı solda. Listede sürükleyerek de sıralayabilirsin.'),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true)
                ->helperText('Yalnızca yayındaki ilk 3 reklam ana sayfada görünür.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable(),
                Tables\Columns\ImageColumn::make('image')->label('Görsel')->disk('uploads'),
                Tables\Columns\TextColumn::make('tournament.name')->label('Turnuva')
                    ->placeholder('—')->searchable()->sortable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTournamentAds::route('/'),
            'create' => Pages\CreateTournamentAd::route('/create'),
            'edit' => Pages\EditTournamentAd::route('/{record}/edit'),
        ];
    }
}
