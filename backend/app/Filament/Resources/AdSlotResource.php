<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AdSlotResource\Pages;
use App\Models\AdSlot;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Ana sayfada paneller arasina yerlestirilen yatay REKLAM seritleri.
 * 3 konum (slot): Ust (banner alti), Orta (takvim/turnuva blogu alti), Alt (footer ustu).
 * Her reklam masaustu + opsiyonel mobil gorsel + hedef link tutar. 'sort' ile siralanir;
 * ayni slotta birden fazla varsa kucuk sayi once (ana sayfada slot basina ilki gosterilir).
 */
class AdSlotResource extends Resource
{
    protected static ?string $model = AdSlot::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-group';

    protected static ?string $navigationLabel = 'Reklam Alanları';

    protected static ?string $modelLabel = 'reklam';

    protected static ?string $pluralModelLabel = 'Reklam Alanları';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 4;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Select::make('slot')->label('Konum (slot)')
                ->options([
                    'top' => 'Üst — banner altı (Turnuvalar/Haberler üstü)',
                    'middle' => 'Orta — takvim/turnuva bloğu altı',
                    'bottom' => 'Alt — liderlik panelleri altı (footer üstü)',
                ])
                ->required()
                ->native(false)
                ->helperText('Reklam ana sayfada bu konumda gösterilir.'),

            // Masaustu gorsel: 1120x180 (2x: 2240x360). public/uploads/reklam altina yuklenir.
            Forms\Components\FileUpload::make('image')->label('Masaüstü görsel (1120×180)')
                ->image()->disk('uploads')->directory('reklam')->visibility('public')
                ->imageEditor()->maxSize(5120)
                ->helperText('Önerilen: 1120×180 px (2× retina: 2240×360). Tam genişlikte gösterilir. En fazla 5 MB.')
                ->required()
                ->columnSpanFull(),

            // Mobil gorsel: 720x300 (2x: 1440x600). Opsiyonel — yoksa masaustu gorseli kucultulur.
            Forms\Components\FileUpload::make('image_mobile')->label('Mobil görsel (720×300)')
                ->image()->disk('uploads')->directory('reklam')->visibility('public')
                ->imageEditor()->maxSize(4096)
                ->helperText('Opsiyonel. Önerilen: 720×300 px (2×: 1440×600). Boşsa mobilde masaüstü görseli küçültülerek gösterilir. En fazla 4 MB.')
                ->columnSpanFull(),

            Forms\Components\TextInput::make('link')->label('Hedef link (URL)')
                ->url()->maxLength(500)
                ->placeholder('https://ornek.com')
                ->helperText('Opsiyonel. Reklama tıklayınca bu adres yeni sekmede açılır. Boşsa reklam tıklanamaz.')
                ->columnSpanFull(),

            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0)
                ->helperText('Aynı konumda birden fazla reklam varsa küçük sayı önce gösterilir.'),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true)
                ->helperText('Yalnızca yayındaki reklamlar ana sayfada gösterilir.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('slot')->label('Konum')
                    ->formatStateUsing(fn (string $state) => match ($state) {
                        'top' => 'Üst',
                        'middle' => 'Orta',
                        'bottom' => 'Alt',
                        default => $state,
                    })
                    ->badge()->sortable(),
                Tables\Columns\ImageColumn::make('image')->label('Görsel')->disk('uploads'),
                Tables\Columns\TextColumn::make('link')->label('Link')
                    ->placeholder('—')->limit(40)->url(fn ($state) => $state)->openUrlInNewTab(),
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable(),
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
            'index' => Pages\ListAdSlots::route('/'),
            'create' => Pages\CreateAdSlot::route('/create'),
            'edit' => Pages\EditAdSlot::route('/{record}/edit'),
        ];
    }
}
