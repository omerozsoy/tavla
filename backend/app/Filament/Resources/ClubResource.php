<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ClubResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Kulüpler: Content type='club'. İl bazli rehber. */
class ClubResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'kulupler';

    protected static ?string $navigationIcon = 'heroicon-o-building-office-2';

    protected static ?string $navigationLabel = 'Kulüpler';

    protected static ?string $modelLabel = 'kulüp';

    protected static ?string $pluralModelLabel = 'Kulüpler';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 6;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'club');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('club'),
            Forms\Components\TextInput::make('title')->label('Kulüp adı')->required()->columnSpanFull(),
            Forms\Components\FileUpload::make('image')->label('Logo')
                ->image()->disk('uploads')->directory('kulup')->visibility('public')
                ->imageEditor()->circleCropper()->maxSize(2048)
                ->helperText('Kulüp logosu — rehberde ismin solunda görünür. Kare/yuvarlak öneririz.')
                ->columnSpanFull(),
            Forms\Components\Select::make('province')->label('İl')
                ->options(array_combine(EventResource::PROVINCES, EventResource::PROVINCES))
                ->searchable()->required(),
            Forms\Components\TextInput::make('sort')->label('Sıra (il içinde)')
                ->numeric()->default(0)->minValue(0)->step(1)
                ->helperText('Küçük sayı üstte listelenir. Aynı il içindeki kulüpler bu sıraya göre dizilir (eşitse ada göre).'),
            Forms\Components\TextInput::make('place')->label('Adres')->columnSpanFull(),
            Forms\Components\Repeater::make('contacts')->label('İletişim (kişiler)')
                ->schema([
                    Forms\Components\TextInput::make('name')->label('Kişi adı')->required(),
                    Forms\Components\TextInput::make('phone')->label('Cep telefonu')
                        ->tel()->mask('999 9999999')->placeholder('532 1111111')->required(),
                ])
                ->columns(2)->addActionLabel('Kişi ekle')->reorderable(false)->columnSpanFull(),
            Forms\Components\TextInput::make('links.email')->label('E-posta')
                ->email()->prefixIcon('heroicon-o-envelope')->placeholder('kulup@ornek.com')->maxLength(200),
            Forms\Components\TextInput::make('links.website')->label('Web sayfası')
                ->url()->prefixIcon('heroicon-o-globe-alt')->placeholder('https://kulup.com')->maxLength(300),
            Forms\Components\TextInput::make('links.instagram')->label('Instagram')
                ->prefixIcon('heroicon-o-camera')->placeholder('https://instagram.com/kullanici')->maxLength(300),
            Forms\Components\TextInput::make('links.youtube')->label('YouTube')
                ->prefixIcon('heroicon-o-play')->placeholder('https://youtube.com/@kanal')->maxLength(300),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true)->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            // İl bazli grupla; her ilin içinde sürükle-bırak sıralama (sort kolonu).
            // ContentController kulüpleri province -> sort -> title ile listeler.
            ->groups([
                Tables\Grouping\Group::make('province')->label('İl')->collapsible(),
            ])
            ->defaultGroup('province')
            ->reorderable('sort')
            ->defaultSort('sort')
            // Suruke-birak reorder + gruplama sayfalamayla kalici olmuyordu -> tek sayfa.
            // Kulup sayisi az; tum kayitlar tek sayfada, drag guvenilir kaydeder.
            ->paginated(false)
            ->columns([
                // Hizli sira duzenleme: tabloda dogrudan yaz (kaydetmeden anlik). Kucuk = ustte.
                Tables\Columns\TextInputColumn::make('sort')->label('Sıra')
                    ->type('number')->rules(['integer', 'min:0'])->sortable(),
                Tables\Columns\ImageColumn::make('image')->label('Logo')->disk('uploads')->circular(),
                Tables\Columns\TextColumn::make('province')->label('İl')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('title')->label('Kulüp')->searchable(),
                Tables\Columns\TextColumn::make('place')->label('Adres')->limit(40)->toggleable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('province')->label('İl')
                    ->options(array_combine(EventResource::PROVINCES, EventResource::PROVINCES)),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListClubs::route('/'),
            'create' => Pages\CreateClub::route('/create'),
            'edit' => Pages\EditClub::route('/{record}/edit'),
        ];
    }
}
