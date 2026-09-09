<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ServiceResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Hizmetler: Content type='service'. */
class ServiceResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'hizmetler';

    protected static ?string $navigationIcon = 'heroicon-o-briefcase';

    protected static ?string $navigationLabel = 'Hizmetler';

    protected static ?string $modelLabel = 'hizmet';

    protected static ?string $pluralModelLabel = 'Hizmetler';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 4;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'service');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('service'),
            Forms\Components\TextInput::make('title')->label('Başlık')->required()->columnSpanFull(),
            Forms\Components\RichEditor::make('body')
                ->label('Açıklama')
                ->toolbarButtons([
                    'bold', 'italic', 'underline', 'strike',
                    'h2', 'h3',
                    'bulletList', 'orderedList',
                    'link', 'blockquote',
                    'redo', 'undo',
                ])
                ->helperText('Biçimlendirilmiş metin — ön yüzde hizmet açıklaması olarak gösterilir.')
                ->columnSpanFull(),
            Forms\Components\FileUpload::make('gallery')->label('Resim galerisi')
                ->image()->multiple()->reorderable()->appendFiles()
                ->disk('uploads')->directory('hizmet')->visibility('public')
                ->maxSize(4096)->panelLayout('grid')
                ->helperText('Birden fazla fotoğraf ekleyebilirsin. Hizmet açıklamasının hemen altında küçük küçük gösterilir; tıklayınca büyür (galeri). Sürükleyerek sıralayabilirsin.')
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
                Tables\Columns\TextColumn::make('title')->label('Başlık')->searchable()->limit(60),
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
            'index' => Pages\ListServices::route('/'),
            'create' => Pages\CreateService::route('/create'),
            'edit' => Pages\EditService::route('/{record}/edit'),
        ];
    }
}
