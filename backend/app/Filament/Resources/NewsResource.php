<?php

namespace App\Filament\Resources;

use App\Filament\Resources\NewsResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Haberler: Content type='news' (RSS'ten de gelir, elle de duzenlenebilir). */
class NewsResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'haberler';

    protected static ?string $navigationIcon = 'heroicon-o-newspaper';

    protected static ?string $navigationLabel = 'Haberler';

    protected static ?string $modelLabel = 'haber';

    protected static ?string $pluralModelLabel = 'Haberler';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 5;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'news');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('news'),
            Forms\Components\TextInput::make('title')->label('Başlık')->required()->columnSpanFull(),
            Forms\Components\DateTimePicker::make('event_at')->label('Yayın tarihi'),
            Forms\Components\Textarea::make('body')->label('İçerik')->rows(10)->columnSpanFull(),
            Forms\Components\FileUpload::make('image')->label('Kapak fotoğrafı')
                ->image()->disk('uploads')->directory('haber')->visibility('public')
                ->imageEditor()->maxSize(4096)
                ->helperText('Habere kapak fotoğrafı yükle. İçe aktarılan haberlerde otomatik doludur.')
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

    // Ciplak yol -> /uploads/ ; tam URL veya /... oldugu gibi
    private static function img(?string $v): ?string
    {
        if (! $v) {
            return null;
        }
        return preg_match('#^(https?:|/)#', $v) ? $v : '/uploads/'.$v;
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListNews::route('/'),
            'create' => Pages\CreateNews::route('/create'),
            'edit' => Pages\EditNews::route('/{record}/edit'),
        ];
    }
}
