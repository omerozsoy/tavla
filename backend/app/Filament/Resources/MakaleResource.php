<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MakaleResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Makaleler: Content type='makale' (elle düzenlenebilir yazılı içerik; liste + detay sayfası). */
class MakaleResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'makaleler';

    protected static ?string $navigationIcon = 'heroicon-o-book-open';

    protected static ?string $navigationLabel = 'Makaleler';

    protected static ?string $modelLabel = 'makale';

    protected static ?string $pluralModelLabel = 'Makaleler';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 4; // İçerik grubunda Haberler'den (5) ÖNCE = üstte

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'makale');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('makale'),
            Forms\Components\TextInput::make('title')->label('Başlık')->required()->columnSpanFull(),
            Forms\Components\TextInput::make('slug')->label('URL adresi (slug)')
                ->helperText('SEO adresi: /makaleler/<slug>. Kısa ve anahtar-kelimeli olsun (ör. tavla-nasil-oynanir). Boş bırakılırsa başlıktan üretilir.')
                ->maxLength(200)->columnSpanFull(),
            Forms\Components\DateTimePicker::make('event_at')->label('Yayın tarihi'),
            Forms\Components\RichEditor::make('body')->label('İçerik')
                ->toolbarButtons([
                    'bold', 'italic', 'underline', 'strike',
                    'h2', 'h3',
                    'bulletList', 'orderedList',
                    'link', 'blockquote',
                    'attachFiles', // metin içine resim ekle
                    'redo', 'undo',
                ])
                ->fileAttachmentsDisk('uploads')
                ->fileAttachmentsDirectory('makale')
                ->fileAttachmentsVisibility('public')
                ->helperText('Makale metni — kalın/başlık/liste/link ile biçimlendirebilir, ataç ikonu ile metnin içine resim ekleyebilirsin.')
                ->columnSpanFull(),
            Forms\Components\FileUpload::make('image')->label('Kapak fotoğrafı')
                ->image()->disk('uploads')->directory('makale')->visibility('public')
                ->imageEditor()->maxSize(4096)
                ->helperText('Makaleye kapak fotoğrafı yükle (liste ve detayda gösterilir).')
                ->columnSpanFull(),
            Forms\Components\FileUpload::make('gallery')->label('Resim galerisi')
                ->image()->multiple()->reorderable()->appendFiles()
                ->disk('uploads')->directory('makale')->visibility('public')
                ->maxSize(4096)->panelLayout('grid')
                ->helperText('Birden fazla fotoğraf ekleyebilirsin. Makale detayında galeri olarak gösterilir.')
                ->columnSpanFull(),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('event_at', 'desc')
            ->columns([
                Tables\Columns\ImageColumn::make('image')->label('Görsel')
                    ->getStateUsing(fn ($record) => self::img($record->image)),
                Tables\Columns\TextColumn::make('title')->label('Başlık')->searchable()->limit(60),
                Tables\Columns\TextColumn::make('event_at')->label('Tarih')->dateTime('d.m.Y')->sortable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ]);
    }

    // ImageColumn için TAM URL üret. Filament kök-göreli yolu (/uploads/…) geçerli URL saymaz;
    // disk vermeyince varsayılan 'public' diskine düşüp storage/app/public altında arar ve null döner
    // (resim kırık görünür). url() ile tam URL dönünce filter_var(FILTER_VALIDATE_URL) geçer, doğrudan kullanılır.
    private static function img(?string $v): ?string
    {
        if (! $v) {
            return null;
        }

        if (preg_match('#^(https?://|data:)#', $v)) {
            return $v;
        }

        return url(str_starts_with($v, '/') ? $v : '/uploads/'.$v);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMakale::route('/'),
            'create' => Pages\CreateMakale::route('/create'),
            'edit' => Pages\EditMakale::route('/{record}/edit'),
        ];
    }
}
