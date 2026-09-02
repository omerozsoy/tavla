<?php

namespace App\Filament\Resources;

use App\Filament\Resources\KurumResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Kurumlar: Content type='kurum'. Sponsor / iş ortağı listesi. */
class KurumResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'kurumlar';

    protected static ?string $navigationIcon = 'heroicon-o-building-office';

    protected static ?string $navigationLabel = 'Kurumlar';

    protected static ?string $modelLabel = 'kurum';

    protected static ?string $pluralModelLabel = 'Kurumlar';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 8;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'kurum');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('kurum'),
            Forms\Components\TextInput::make('title')->label('Kurum adı')->required()->columnSpanFull(),
            Forms\Components\FileUpload::make('image')->label('Logo')
                ->image()->disk('uploads')->directory('kurum')->visibility('public')
                ->maxSize(2048)
                ->helperText('Şeffaf PNG önerilir. En fazla 2 MB.')
                ->columnSpanFull(),
            Forms\Components\TextInput::make('contact')->label('Web sitesi (URL)')
                ->url()->prefixIcon('heroicon-o-globe-alt')
                ->placeholder('https://ornek.com')->columnSpanFull(),
            // Sosyal medya: links.instagram / links.youtube (json). Bos birakilabilir.
            Forms\Components\TextInput::make('links.instagram')->label('Instagram')
                ->url()->prefixIcon('heroicon-o-camera')
                ->placeholder('https://instagram.com/kullanici'),
            Forms\Components\TextInput::make('links.youtube')->label('YouTube')
                ->url()->prefixIcon('heroicon-o-play-circle')
                ->placeholder('https://youtube.com/@kanal'),
            Forms\Components\Repeater::make('contacts')->label('Yetkili kişi(ler)')
                ->schema([
                    Forms\Components\TextInput::make('name')->label('Ad Soyad')->required(),
                    Forms\Components\TextInput::make('phone')->label('Cep telefonu')
                        ->tel()->mask('999 9999999')->placeholder('532 1111111')->required(),
                ])
                ->columns(2)->addActionLabel('Yetkili kişi ekle')->reorderable(false)->columnSpanFull(),
            Forms\Components\Textarea::make('body')->label('Açıklama')->rows(6)->columnSpanFull(),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\ImageColumn::make('image')->label('Logo')->disk('uploads')->height(32),
                Tables\Columns\TextColumn::make('title')->label('Kurum')->searchable()->limit(60),
                Tables\Columns\TextColumn::make('contact')->label('Web sitesi')->limit(40)->toggleable(),
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
            'index' => Pages\ListKurums::route('/'),
            'create' => Pages\CreateKurum::route('/create'),
            'edit' => Pages\EditKurum::route('/{record}/edit'),
        ];
    }
}
