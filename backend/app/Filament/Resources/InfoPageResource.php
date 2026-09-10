<?php

namespace App\Filament\Resources;

use App\Filament\Resources\InfoPageResource\Pages;
use App\Models\InfoPage;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Bilgi Sayfalari: yalnizca DUZENLENEBILIR sekmeler (Hakkinda + Hizmetler).
 *  Rutbeler/Puanlama/Basarilarim/Adil Zar canli bilesendir (frontend), panelde yok. */
class InfoPageResource extends Resource
{
    protected static ?string $model = InfoPage::class;

    // Yalnizca duzenlenebilir metin sayfalari; canli bilesen sekmeleri gizli.
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->whereIn('slug', ['about', 'services']);
    }

    protected static ?string $slug = 'bilgi-sayfalari';

    protected static ?string $navigationIcon = 'heroicon-o-information-circle';

    protected static ?string $navigationLabel = 'Bilgi Sayfaları';

    protected static ?string $modelLabel = 'bilgi sayfası';

    protected static ?string $pluralModelLabel = 'Bilgi Sayfaları';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 1;

    // Sabit 6 sayfa; panelden yeni eklenmez/silinmez.
    public static function canCreate(): bool
    {
        return false;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('title')
                ->label('Sekme başlığı')
                ->helperText('Bilgi sayfasındaki sekme etiketi ve sayfa başlığı olarak kullanılır.')
                ->required()
                ->columnSpanFull(),
            Forms\Components\RichEditor::make('body')
                ->label('İçerik')
                ->toolbarButtons([
                    'bold', 'italic', 'underline', 'strike',
                    'h2', 'h3',
                    'bulletList', 'orderedList',
                    'link', 'blockquote',
                    'attachFiles', // metin içine resim ekle
                    'redo', 'undo',
                ])
                // Satır içi resimler public/uploads/bilgi altına -> <img src="/uploads/bilgi/..">
                ->fileAttachmentsDisk('uploads')
                ->fileAttachmentsDirectory('bilgi')
                ->fileAttachmentsVisibility('public')
                ->helperText('Biçimlendirilmiş metin — /bilgi/<sayfa> içeriği olarak gösterilir. Ataç ikonu ile metnin içine resim ekleyebilirsin.')
                ->columnSpanFull(),
            Forms\Components\FileUpload::make('gallery')->label('Resim galerisi (varsayılan)')
                ->image()->multiple()->reorderable()->appendFiles()
                ->disk('uploads')->directory('bilgi')->visibility('public')
                ->maxSize(4096)->panelLayout('grid')
                ->helperText('Varsayılan galeri. İçeriğin altında gösterilir; tıklayınca büyür (lightbox). İpucu: metinde <resimgalerisi> yazarsan tam o noktada çıkar (yoksa en altta).')
                ->columnSpanFull(),
            Forms\Components\Repeater::make('galleries')
                ->label('İsimli galeriler')
                ->helperText('Birden fazla galeri oluşturabilirsin; her birine bir ad ver. İçerik metninde <ad> yazdığın yere o galeri gelir. Örn: ad "turnuvalar" → metinde <turnuvalar>.')
                ->schema([
                    Forms\Components\TextInput::make('name')
                        ->label('Galeri adı (etiket)')
                        ->required()
                        ->maxLength(40)
                        ->helperText('Sadece harf/rakam/tire kullan (örn: turnuvalar). Metinde <turnuvalar> ile çağır.'),
                    Forms\Components\FileUpload::make('images')
                        ->label('Resimler')
                        ->image()->multiple()->reorderable()->appendFiles()
                        ->disk('uploads')->directory('bilgi')->visibility('public')
                        ->maxSize(4096)->panelLayout('grid'),
                ])
                ->itemLabel(fn (array $state): ?string => ! empty($state['name']) ? ('<'.$state['name'].'>') : null)
                ->addActionLabel('Galeri ekle')
                ->reorderable()
                ->collapsible()
                ->defaultItems(0)
                ->columnSpanFull(),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('title')->label('Başlık')->searchable(),
                Tables\Columns\TextColumn::make('slug')->label('Adres')
                    ->formatStateUsing(fn ($state) => '/bilgi/'.self::urlSlug($state))
                    ->badge(),
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
            ]);
    }

    // Admin gosteriminde DB slug'ini Turkce URL slug'ina cevir (frontend ile ayni harita).
    private static function urlSlug(string $slug): string
    {
        return [
            'about' => 'hakkinda',
            'services' => 'hizmetler',
            'ranks' => 'rutbeler',
            'scoring' => 'puanlama',
            'badges' => 'basarilarim',
            'fair' => 'adil-zar',
        ][$slug] ?? $slug;
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListInfoPages::route('/'),
            'edit' => Pages\EditInfoPage::route('/{record}/edit'),
        ];
    }
}
