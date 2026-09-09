<?php

namespace App\Filament\Resources;

use App\Filament\Resources\InfoPageResource\Pages;
use App\Models\InfoPage;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/** Bilgi Sayfalari: /bilgi/<slug> sekmeleri. Sabit 6 sayfa; yalnizca duzenlenir. */
class InfoPageResource extends Resource
{
    protected static ?string $model = InfoPage::class;

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
                    'redo', 'undo',
                ])
                ->helperText('Biçimlendirilmiş metin — /bilgi/<sayfa> içeriği olarak gösterilir.')
                ->columnSpanFull(),
            Forms\Components\FileUpload::make('gallery')->label('Resim galerisi')
                ->image()->multiple()->reorderable()->appendFiles()
                ->disk('uploads')->directory('bilgi')->visibility('public')
                ->maxSize(4096)->panelLayout('grid')
                ->helperText('İçeriğin altında küçük küçük gösterilir; tıklayınca büyür (galeri). Sürükleyerek sıralayabilirsin.')
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
