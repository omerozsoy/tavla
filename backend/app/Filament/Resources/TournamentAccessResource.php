<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TournamentAccessResource\Pages;
use App\Models\TournamentAccess;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * CANLI TURNUVA SİSTEMİ: dernek/grup erişimleri (isim + şifre). Buradan tanımlanan şifreyle giren grup,
 * /canli-turnuva-sistemi sayfasındaki formdan turnuva kurabilir. Şifre DÜZ METİN (admin paylaşsın).
 */
class TournamentAccessResource extends Resource
{
    protected static ?string $model = TournamentAccess::class;

    protected static ?string $navigationIcon = 'heroicon-o-key';

    protected static ?string $navigationLabel = 'Canlı Turnuva Sistemi';

    protected static ?string $modelLabel = 'dernek/grup erişimi';

    protected static ?string $pluralModelLabel = 'Canlı Turnuva Sistemi';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 4;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')
                ->label('Dernek / Grup adı')
                ->helperText('Giriş yapan kim? Kurulan turnuvada "düzenleyen" olarak görünür.')
                ->required()
                ->maxLength(120),
            Forms\Components\TextInput::make('password')
                ->label('Şifre')
                ->helperText('Bu grubun /canli-turnuva-sistemi sayfasında gireceği şifre. Gruba sen paylaşırsın.')
                ->required()
                ->maxLength(60)
                ->autocomplete(false),
            Forms\Components\Toggle::make('active')
                ->label('Aktif (giriş açık)')
                ->helperText('Kapatınca bu şifreyle giriş YAPILAMAZ (silmeden duraklatma).')
                ->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')->label('Dernek / Grup')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('password')->label('Şifre')->searchable(),
                Tables\Columns\IconColumn::make('active')->label('Aktif')->boolean(),
                Tables\Columns\TextColumn::make('created_count')->label('Kurulan turnuva')->sortable(),
                Tables\Columns\TextColumn::make('last_used_at')->label('Son kullanım')->dateTime('d.m.Y H:i')->placeholder('—')->sortable(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTournamentAccesses::route('/'),
            'create' => Pages\CreateTournamentAccess::route('/create'),
            'edit' => Pages\EditTournamentAccess::route('/{record}/edit'),
        ];
    }
}
