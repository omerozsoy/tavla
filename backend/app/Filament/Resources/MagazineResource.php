<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MagazineResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * Tavla Magazin videolari (type='magazine'). Import komutu ile YouTube playlist'ten
 * gelir; burada SIRALAMA (surukle-birak) + baslik/seri/yayin duzenlenir. Tablo
 * 'sort' kolonuna gore reorderable -> ContentController magazini 'sort' ile listeler.
 */
class MagazineResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $navigationIcon = 'heroicon-o-play-circle';

    protected static ?string $navigationLabel = 'Tavla Magazin';

    protected static ?string $modelLabel = 'video';

    protected static ?string $pluralModelLabel = 'Tavla Magazin';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 6;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'magazine');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('title')->label('Başlık')->required()->columnSpanFull(),
            Forms\Components\TextInput::make('organizer')->label('Seri / Bölüm')
                ->default('Videolar')->helperText('Boş bırakılırsa video "Videolar" başlığı altında görünür.'),
            Forms\Components\TextInput::make('video_id')->label('YouTube Video ID')
                ->helperText('Örn. dQw4w9WgXcQ (izleme bağlantısındaki v= değeri)')->required(),
            Forms\Components\TextInput::make('image')->label('Kapak URL')->maxLength(500)->columnSpanFull(),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0)
                ->helperText('Küçük sayı üstte. Listede sürükleyerek de sıralayabilirsin.'),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            // Surukle-birak siralama: 'sort' kolonunu gunceller (ContentController bunu kullanir)
            ->reorderable('sort')
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable(),
                Tables\Columns\ImageColumn::make('image')->label('Kapak'),
                Tables\Columns\TextColumn::make('title')->label('Başlık')->searchable()->limit(60),
                Tables\Columns\TextColumn::make('organizer')->label('Seri')->searchable()->toggleable(),
                Tables\Columns\TextColumn::make('video_id')->label('Video ID')->toggleable(),
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
            'index' => Pages\ListMagazines::route('/'),
            'create' => Pages\CreateMagazine::route('/create'),
            'edit' => Pages\EditMagazine::route('/{record}/edit'),
        ];
    }
}
