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
 * Ana sayfanin en ustunde SLIDER (carousel) olarak donen banner gorselleri.
 * Her banner bir turnuvaya baglanir; ziyaretci tiklayinca o turnuvanin detayina gider.
 * Tablo 'sort' ile surukle-birak siralanir; yayindaki bannerlar sirayla doner.
 */
class TournamentAdResource extends Resource
{
    protected static ?string $model = TournamentAd::class;

    protected static ?string $navigationIcon = 'heroicon-o-photo';

    protected static ?string $navigationLabel = 'Banner';

    protected static ?string $modelLabel = 'banner';

    protected static ?string $pluralModelLabel = 'Bannerlar';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form->schema([
            // Banner gorseli: bilgisayardan resim sec (public/uploads/banner altina yuklenir)
            Forms\Components\FileUpload::make('image')->label('Banner görseli')
                ->image()->disk('uploads')->directory('banner')->visibility('public')
                ->imageEditor()->maxSize(5120)
                ->helperText('Tam genişlikte hero olarak gösterilir; geniş, yüksek çözünürlüklü görsel önerilir (örn. 2000×760). En fazla 5 MB.')
                ->required()
                ->columnSpanFull(),
            Forms\Components\Select::make('tournament_id')
                ->label('Bağlı turnuva')
                ->relationship('tournament', 'name')
                ->searchable()
                ->preload()
                ->helperText('Banner’a tıklayınca bu turnuvanın detay sayfası açılır.')
                ->required(),

            // Görselin ÜSTÜNE bindirilen metin (Christie's tarzı). Tümü boş bırakılırsa
            // görsel çıplak gösterilir (yazı görselin içinde hazır demektir).
            Forms\Components\Fieldset::make('Görsel üstü yazı (opsiyonel)')
                ->schema([
                    Forms\Components\TextInput::make('kicker')->label('Üst etiket')
                        ->maxLength(80)->placeholder('ör. TURNUVA')
                        ->helperText('Küçük, büyük harf gösterilir.'),
                    Forms\Components\TextInput::make('cta')->label('Buton yazısı')
                        ->maxLength(60)->placeholder('ör. Keşfet'),
                    Forms\Components\TextInput::make('title')->label('Başlık')
                        ->maxLength(160)->placeholder('ör. 5. Grand Pasha Open')
                        ->columnSpanFull(),
                    Forms\Components\TextInput::make('subtitle')->label('Alt metin')
                        ->maxLength(240)->placeholder('ör. 1–3 Kasım 2026 · Kıbrıs')
                        ->columnSpanFull(),
                ])
                ->columns(2)
                ->columnSpanFull(),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0)
                ->helperText('Küçük sayı önce gösterilir. Listede sürükleyerek de sıralayabilirsin.'),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true)
                ->helperText('Yalnızca yayındaki bannerlar slider’da döner.'),
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
                Tables\Columns\TextColumn::make('title')->label('Başlık')
                    ->placeholder('—')->limit(40)->searchable()->toggleable(),
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
