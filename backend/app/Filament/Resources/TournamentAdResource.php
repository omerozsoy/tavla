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
                ->helperText('Sol panelde yazı varsa görsel SAĞ yarıda; yoksa tam genişlikte gösterilir. Dikey ortaya önemli öğe koy (kırpılabilir). Yüksek çözünürlük önerilir. En fazla 5 MB.')
                ->required()
                ->columnSpanFull(),
            // Düzenleyen (organizatör) logosu: sol panelde başlığın üstünde küçük gösterilir.
            Forms\Components\FileUpload::make('logo')->label('Düzenleyen logosu')
                ->image()->disk('uploads')->directory('banner/logo')->visibility('public')
                ->maxSize(2048)
                ->helperText('Opsiyonel. Sol panelde başlığın üstünde küçük gösterilir. Şeffaf PNG önerilir. En fazla 2 MB.')
                ->columnSpanFull(),
            Forms\Components\Select::make('tournament_id')
                ->label('Bağlı turnuva')
                ->relationship('tournament', 'name')
                ->searchable()
                ->preload()
                ->helperText('Banner’a tıklayınca bu turnuvanın detay sayfası açılır.')
                ->required(),

            // Christie's tarzı split hero: SOL panelde bu yazılar, SAĞDA görsel gösterilir.
            // Tümü boş bırakılırsa panel çıkmaz, görsel tam genişlikte çıplak gösterilir.
            Forms\Components\Fieldset::make('Sol panel yazıları (opsiyonel — Christie’s tarzı)')
                ->schema([
                    Forms\Components\TextInput::make('kicker')->label('Üst etiket')
                        ->maxLength(80)->placeholder('ör. ÖNE ÇIKAN TURNUVA')
                        ->helperText('Küçük, büyük harf gösterilir.'),
                    Forms\Components\TextInput::make('cta')->label('Buton yazısı')
                        ->maxLength(60)->placeholder('ör. Keşfet'),
                    Forms\Components\TextInput::make('title')->label('Başlık')
                        ->maxLength(160)->placeholder('ör. 5. Grand Pasha Open')
                        ->helperText('Büyük serif başlık.')
                        ->columnSpanFull(),
                    Forms\Components\TextInput::make('subtitle')->label('Alt metin')
                        ->maxLength(240)->placeholder('ör. Kıbrıs’ın en büyük backgammon turnuvası')
                        ->columnSpanFull(),
                    Forms\Components\TextInput::make('meta')->label('Meta (tarih · yer)')
                        ->maxLength(120)->placeholder('ör. 1–3 Kasım 2026 · Kıbrıs')
                        ->helperText('Butonun üstünde küçük satır (takvim ikonuyla).')
                        ->columnSpanFull(),
                    Forms\Components\ColorPicker::make('panel_color')->label('Sol panel rengi')
                        ->helperText('Boş = varsayılan krem. İstersen aşağıdaki resim renklerinden birine tıkla. Sadece renk — yazı için "Üst etiket" alanını kullan.')
                        // Yalnizca hex renk (#rgb / #rgba / #rrggbb / #rrggbbaa). Yanlislikla yazilan
                        // metin DB'ye gidip 500 vermesin diye form-icinde dostane hata verir.
                        ->regex('/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/')
                        ->validationMessages(['regex' => 'Geçerli bir renk seç (ör. #c8552b). Buraya yazı yazma; metin için "Üst etiket" alanını kullan.'])
                        ->live(),
                    Forms\Components\ViewField::make('palette')
                        ->label('Resimden baskın renkler')
                        ->view('filament.palette-swatches')
                        ->dehydrated(false)
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
