<?php

namespace App\Filament\Resources;

use App\Filament\Resources\EventResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * Tavla Takvimi: Content modelinin type='event' kayitlari icin ayri yonetim sayfasi.
 */
class EventResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'takvim';

    protected static ?string $navigationIcon = 'heroicon-o-calendar-days';

    protected static ?string $navigationLabel = 'Tavla Takvimi';

    protected static ?string $modelLabel = 'etkinlik';

    protected static ?string $pluralModelLabel = 'Tavla Takvimi';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 1;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'event');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('event'),
            Forms\Components\TextInput::make('title')->label('Etkinlik adı')->required()->columnSpanFull(),
            Forms\Components\DateTimePicker::make('event_at')->label('Tarih & saat')->required(),
            Forms\Components\TextInput::make('organizer')->label('Düzenleyen'),
            Forms\Components\TextInput::make('place')->label('Yer'),
            Forms\Components\TextInput::make('province')->label('İl'),
            Forms\Components\TextInput::make('contact')->label('İletişim'),
            Forms\Components\Textarea::make('body')->label('Açıklama')->rows(4)->columnSpanFull(),
            Forms\Components\TextInput::make('image')->label('Görsel URL')->maxLength(500)->columnSpanFull(),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('event_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('event_at')->label('Tarih')->dateTime('d.m.Y H:i')->sortable(),
                Tables\Columns\TextColumn::make('title')->label('Etkinlik')->searchable()->limit(50),
                Tables\Columns\TextColumn::make('organizer')->label('Düzenleyen')->toggleable(),
                Tables\Columns\TextColumn::make('place')->label('Yer')->toggleable(),
                Tables\Columns\TextColumn::make('province')->label('İl')->searchable()->toggleable(),
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
            'index' => Pages\ListEvents::route('/'),
            'create' => Pages\CreateEvent::route('/create'),
            'edit' => Pages\EditEvent::route('/{record}/edit'),
        ];
    }
}
