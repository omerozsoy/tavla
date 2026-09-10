<?php

namespace App\Filament\Resources;

use App\Filament\Resources\EntryPopupResource\Pages;
use App\Models\EntryPopup;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * "Giriş Kare Banner": siteye İLK girildiğinde ekran ortasında gösterilen KARE reklam pop-up'ı.
 * Yayındaki (görselli) ilk kayıt gösterilir. Gösterim sıklığı (oturumda bir / günde bir / her
 * ziyaret) ve hedef kitle (herkes / misafir / üye) buradan seçilir; link opsiyoneldir.
 */
class EntryPopupResource extends Resource
{
    protected static ?string $model = EntryPopup::class;

    protected static ?string $navigationIcon = 'heroicon-o-photo';

    protected static ?string $navigationLabel = 'Giriş Kare Banner';

    protected static ?string $modelLabel = 'giriş banner';

    protected static ?string $pluralModelLabel = 'Giriş Kare Banner';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 5;

    public static function form(Form $form): Form
    {
        return $form->schema([
            // Kare gorsel: onerilen 600x600 (2x: 1200x1200). public/uploads/reklam altina yuklenir.
            Forms\Components\FileUpload::make('image')->label('Kare görsel (600×600)')
                ->image()->disk('uploads')->directory('reklam')->visibility('public')
                ->imageEditor()->imageEditorAspectRatios(['1:1'])->maxSize(5120)
                ->helperText('Önerilen: 600×600 px kare (2× retina: 1200×1200). En fazla 5 MB.')
                ->required()
                ->columnSpanFull(),

            Forms\Components\FileUpload::make('image_mobile')->label('Mobil görsel (opsiyonel)')
                ->image()->disk('uploads')->directory('reklam')->visibility('public')
                ->imageEditor()->maxSize(4096)
                ->helperText('Opsiyonel. Boşsa mobilde kare görsel küçültülerek gösterilir. En fazla 4 MB.')
                ->columnSpanFull(),

            Forms\Components\TextInput::make('link')->label('Hedef link (URL)')
                ->url()->maxLength(500)
                ->placeholder('https://ornek.com')
                ->helperText('Opsiyonel. Banner’a tıklayınca bu adres yeni sekmede açılır. Boşsa tıklanamaz.')
                ->columnSpanFull(),

            Forms\Components\Select::make('frequency')->label('Gösterim sıklığı')
                ->options([
                    'session' => 'Oturumda bir (sekme kapanana kadar bir kez)',
                    'daily' => 'Günde bir',
                    'always' => 'Her ziyarette',
                ])
                ->default('session')->required()->native(false)
                ->helperText('Aynı ziyaretçiye ne sıklıkta gösterilsin.'),

            Forms\Components\Select::make('audience')->label('Kimlere gösterilsin')
                ->options([
                    'all' => 'Herkes',
                    'guest' => 'Yalnız giriş yapmayan (misafir)',
                    'member' => 'Yalnız üyeler (giriş yapmış)',
                ])
                ->default('all')->required()->native(false),

            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0)
                ->helperText('Birden fazla banner varsa küçük sayı önce gösterilir (yalnız ilki gösterilir).'),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true)
                ->helperText('Yalnızca yayındaki banner gösterilir.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\ImageColumn::make('image')->label('Görsel')->disk('uploads'),
                Tables\Columns\TextColumn::make('frequency')->label('Sıklık')
                    ->formatStateUsing(fn (string $state) => match ($state) {
                        'session' => 'Oturumda bir',
                        'daily' => 'Günde bir',
                        'always' => 'Her ziyaret',
                        default => $state,
                    })->badge(),
                Tables\Columns\TextColumn::make('audience')->label('Kitle')
                    ->formatStateUsing(fn (string $state) => match ($state) {
                        'all' => 'Herkes',
                        'guest' => 'Misafir',
                        'member' => 'Üye',
                        default => $state,
                    })->badge(),
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
            'index' => Pages\ListEntryPopups::route('/'),
            'create' => Pages\CreateEntryPopup::route('/create'),
            'edit' => Pages\EditEntryPopup::route('/{record}/edit'),
        ];
    }
}
