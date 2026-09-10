<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CookieEntryResource\Pages;
use App\Models\CookieEntry;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Çerez Politikası sayfasındaki "Kullanılan Çerezler" tablosu. Her satır bir çerez /
 * benzeri teknoloji. Frontend Çerez Politikası'nda canlı tablo olarak gösterir.
 */
class CookieEntryResource extends Resource
{
    protected static ?string $model = CookieEntry::class;

    protected static ?string $slug = 'cerez-tablosu';

    protected static ?string $navigationIcon = 'heroicon-o-table-cells';

    protected static ?string $navigationLabel = 'Çerez Tablosu';

    protected static ?string $modelLabel = 'çerez';

    protected static ?string $pluralModelLabel = 'Çerez Tablosu';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')->label('Çerez / Depolama adı')
                ->required()->maxLength(120)
                ->helperText('Örn: tavla.token, XSRF-TOKEN'),
            Forms\Components\TextInput::make('provider')->label('Sağlayıcı')
                ->maxLength(120)->placeholder('Birinci taraf (site) / Google'),
            Forms\Components\Textarea::make('purpose')->label('Amaç')
                ->maxLength(400)->rows(2)->columnSpanFull(),
            Forms\Components\Select::make('category')->label('Kategori')
                ->options([
                    'necessary' => 'Zorunlu',
                    'functional' => 'İşlevsel',
                    'analytics' => 'Analitik',
                    'marketing' => 'Pazarlama',
                ])->default('necessary')->required()->native(false),
            Forms\Components\TextInput::make('duration')->label('Süre')
                ->maxLength(80)->placeholder('Kalıcı / Oturum / 1 yıl'),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0),
            Forms\Components\Toggle::make('active')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('name')->label('Ad')->searchable(),
                Tables\Columns\TextColumn::make('provider')->label('Sağlayıcı')->placeholder('—'),
                Tables\Columns\TextColumn::make('category')->label('Kategori')
                    ->formatStateUsing(fn (string $state) => match ($state) {
                        'necessary' => 'Zorunlu',
                        'functional' => 'İşlevsel',
                        'analytics' => 'Analitik',
                        'marketing' => 'Pazarlama',
                        default => $state,
                    })->badge(),
                Tables\Columns\TextColumn::make('duration')->label('Süre')->placeholder('—'),
                Tables\Columns\IconColumn::make('active')->label('Yayında')->boolean(),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCookieEntries::route('/'),
            'create' => Pages\CreateCookieEntry::route('/create'),
            'edit' => Pages\EditCookieEntry::route('/{record}/edit'),
        ];
    }
}
