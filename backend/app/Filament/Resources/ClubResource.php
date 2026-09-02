<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ClubResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Kulüpler: Content type='club'. İl bazli rehber. */
class ClubResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'kulupler';

    protected static ?string $navigationIcon = 'heroicon-o-building-office-2';

    protected static ?string $navigationLabel = 'Kulüpler';

    protected static ?string $modelLabel = 'kulüp';

    protected static ?string $pluralModelLabel = 'Kulüpler';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 6;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'club');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('club'),
            Forms\Components\TextInput::make('title')->label('Kulüp adı')->required()->columnSpanFull(),
            Forms\Components\FileUpload::make('image')->label('Logo')
                ->image()->disk('uploads')->directory('kulup')->visibility('public')
                ->imageEditor()->circleCropper()->maxSize(2048)
                ->helperText('Kulüp logosu — rehberde ismin solunda görünür. Kare/yuvarlak öneririz.')
                ->columnSpanFull(),
            Forms\Components\Select::make('province')->label('İl')
                ->options(array_combine(EventResource::PROVINCES, EventResource::PROVINCES))
                ->searchable()->required(),
            Forms\Components\TextInput::make('place')->label('Adres')->columnSpanFull(),
            Forms\Components\Repeater::make('contacts')->label('İletişim (kişiler)')
                ->schema([
                    Forms\Components\TextInput::make('name')->label('Kişi adı')->required(),
                    Forms\Components\TextInput::make('phone')->label('Cep telefonu')
                        ->tel()->mask('999 9999999')->placeholder('532 1111111')->required(),
                ])
                ->columns(2)->addActionLabel('Kişi ekle')->reorderable(false)->columnSpanFull(),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('province')
            ->columns([
                Tables\Columns\ImageColumn::make('image')->label('Logo')->disk('uploads')->circular(),
                Tables\Columns\TextColumn::make('province')->label('İl')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('title')->label('Kulüp')->searchable(),
                Tables\Columns\TextColumn::make('place')->label('Adres')->limit(40)->toggleable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('province')->label('İl')
                    ->options(array_combine(EventResource::PROVINCES, EventResource::PROVINCES)),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListClubs::route('/'),
            'create' => Pages\CreateClub::route('/create'),
            'edit' => Pages\EditClub::route('/{record}/edit'),
        ];
    }
}
