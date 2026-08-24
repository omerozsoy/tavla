<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ContentResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ContentResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $navigationIcon = 'heroicon-o-document-text';

    protected static ?string $navigationLabel = 'İçerikler';

    protected static ?string $modelLabel = 'içerik';

    protected static ?string $pluralModelLabel = 'İçerikler';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 2;

    // Genel icerik turleri (Tavla Takvimi=event ayri sayfada; haber/video komutla gelir).
    private const TYPES = [
        'blog' => 'Blog',
        'service' => 'Hizmet',
        'club' => 'Kulüp',
        'ad' => 'Reklam',
        'news' => 'Haber',
    ];

    public static function getEloquentQuery(): Builder
    {
        // Etkinlik (Tavla Takvimi) ve magazin videolari bu listede gorunmez.
        return parent::getEloquentQuery()->whereNotIn('type', ['event', 'magazine', 'quiz']);
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Select::make('type')->label('Tür')
                ->options(self::TYPES)->required()->default('blog'),
            Forms\Components\TextInput::make('title')->label('Başlık')->required()->columnSpanFull(),
            Forms\Components\Textarea::make('body')->label('İçerik')->rows(6)->columnSpanFull(),
            Forms\Components\TextInput::make('province')->label('İl (kulüp)'),
            Forms\Components\TextInput::make('place')->label('Adres/Yer'),
            Forms\Components\TextInput::make('contact')->label('İletişim'),
            Forms\Components\TextInput::make('image')->label('Görsel URL')->maxLength(500)->columnSpanFull(),
            Forms\Components\DateTimePicker::make('event_at')->label('Tarih (blog/haber: yayın)'),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('type')->label('Tür')->badge()
                    ->formatStateUsing(fn ($state) => self::TYPES[$state] ?? $state),
                Tables\Columns\ImageColumn::make('image')->label('Görsel'),
                Tables\Columns\TextColumn::make('title')->label('Başlık')->searchable()->limit(50),
                Tables\Columns\TextColumn::make('province')->label('İl')->toggleable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
                Tables\Columns\TextColumn::make('event_at')->label('Tarih')->dateTime('d.m.Y')->sortable()->toggleable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('type')->label('Tür')->options(self::TYPES),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListContents::route('/'),
            'create' => Pages\CreateContent::route('/create'),
            'edit' => Pages\EditContent::route('/{record}/edit'),
        ];
    }
}
