<?php

namespace App\Filament\Resources;

use App\Filament\Resources\OtelResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * Oteller: Content type='otel'. Etkinliklerin yapildigi mekanlar (3-5 sabit otel).
 * Resim(ler) buraya bir kez yuklenir; etkinlik olustururken sadece otel secilir,
 * etkinlik takviminde otelin resmi + adi gosterilir.
 */
class OtelResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'oteller';

    protected static ?string $navigationIcon = 'heroicon-o-building-office-2';

    protected static ?string $navigationLabel = 'Oteller';

    protected static ?string $modelLabel = 'otel';

    protected static ?string $pluralModelLabel = 'Oteller';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 9;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'otel');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('otel'),
            Forms\Components\TextInput::make('title')->label('Otel adı')->required()->columnSpanFull(),
            // Otel gorseli: etkinlik takviminde bu resim gosterilir. public/uploads/otel altina yuklenir.
            Forms\Components\FileUpload::make('image')->label('Otel görseli')
                ->image()->disk('uploads')->directory('otel')->visibility('public')
                ->imageEditor()->maxSize(5120)
                ->helperText('Etkinlik takviminde bu görsel gösterilir. En fazla 5 MB.')
                ->columnSpanFull(),
            // Ulke once secilir; il listesi ulkeye gore degisir (Turkiye 81 / KKTC 6).
            Forms\Components\Select::make('country')->label('Ülke')
                ->options(EventResource::COUNTRIES)->default('Türkiye')->required()->live()
                ->afterStateUpdated(fn (Forms\Set $set) => $set('province', null)),
            Forms\Components\Select::make('province')->label('İl')
                ->options(fn (Forms\Get $get) => EventResource::provinceOptions($get('country')))
                ->searchable(),
            Forms\Components\TextInput::make('place')->label('Adres')->columnSpanFull(),
            // Web sitesi ve telefon ayri alanlar. Web -> links.website, telefon -> contact.
            Forms\Components\TextInput::make('links.website')->label('Web sitesi')
                ->url()->prefixIcon('heroicon-o-globe-alt')->placeholder('https://ornek.com'),
            Forms\Components\TextInput::make('contact')->label('Telefon')
                ->tel()->prefixIcon('heroicon-o-phone')->placeholder('0392 111 1111'),
            Forms\Components\Textarea::make('body')->label('Açıklama')->rows(4)->columnSpanFull(),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\ImageColumn::make('image')->label('Görsel')->disk('uploads')->height(40),
                Tables\Columns\TextColumn::make('title')->label('Otel')->searchable()->limit(60),
                Tables\Columns\TextColumn::make('country')->label('Ülke')->toggleable(),
                Tables\Columns\TextColumn::make('province')->label('İl')->searchable()->toggleable(),
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
            'index' => Pages\ListOtels::route('/'),
            'create' => Pages\CreateOtel::route('/create'),
            'edit' => Pages\EditOtel::route('/{record}/edit'),
        ];
    }
}
