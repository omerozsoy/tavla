<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TournamentResource\Pages;
use App\Filament\Resources\TournamentResource\RelationManagers;
use App\Models\Tournament;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class TournamentResource extends Resource
{
    protected static ?string $model = Tournament::class;

    protected static ?string $navigationIcon = 'heroicon-o-flag';

    protected static ?string $navigationLabel = 'Turnuvalar';

    protected static ?string $modelLabel = 'turnuva';

    protected static ?string $pluralModelLabel = 'Turnuvalar';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->required(),
                Forms\Components\TextInput::make('size')
                    ->required()
                    ->numeric()
                    ->default(8),
                Forms\Components\Select::make('status')
                    ->label('Durum')
                    ->required()
                    ->options([
                        'open' => 'Kayıt açık',
                        'running' => 'Devam ediyor',
                        'finished' => 'Bitti',
                    ])
                    ->default('open'),
                Forms\Components\DateTimePicker::make('register_until')
                    ->label('Son katılım tarihi')
                    ->helperText('Bu tarih-saatten 1 dakika sonra turnuva otomatik başlar (en az 2 oyuncu varsa). Boş bırakırsan otomatik başlama olmaz.')
                    ->seconds(false)
                    ->native(false)
                    ->nullable(),
                Forms\Components\Select::make('creator_id')
                    ->label('Oluşturan')
                    ->relationship('creator', 'nickname')
                    ->searchable()
                    ->preload()
                    ->default(fn () => auth()->id()),
                Forms\Components\Textarea::make('players')
                    ->columnSpanFull(),
                Forms\Components\Textarea::make('bracket')
                    ->columnSpanFull(),
                Forms\Components\Select::make('champion_id')
                    ->label('Şampiyon')
                    ->relationship('champion', 'nickname')
                    ->searchable()
                    ->preload()
                    ->nullable(),
                Forms\Components\TextInput::make('prize_coins')
                    ->label('Ödül havuzu (coin)')
                    ->helperText('Giriş ücretleri burada birikir; turnuva bitince 1.’liğe eklenir. Elle de ekleyebilirsin.')
                    ->required()
                    ->numeric()
                    ->minValue(0)
                    ->default(0),

                // ---- Sıralamaya göre ödül tablosu (kaç kişiye + her sıraya ayrı ödül) ----
                Forms\Components\Repeater::make('prizes')
                    ->label('Ödül tablosu (sıraya göre)')
                    ->helperText('Her satır bir sıralamadır: 1. satır = 1.’lik, 2. satır = 2.’lik … Kaç kişiye ödül vereceğini satır sayısıyla belirlersin; sürükleyerek sırayı değiştirebilirsin. Turnuva bitince coin otomatik dağıtılır (1.=şampiyon, 2.=finalist, aynı turda elenenler rating’e göre).')
                    ->schema([
                        Forms\Components\TextInput::make('coins')
                            ->label('Coin')
                            ->numeric()
                            ->minValue(0)
                            ->default(0)
                            ->required(),
                        Forms\Components\TextInput::make('desc')
                            ->label('Açıklama (opsiyonel)')
                            ->placeholder('ör. Star üyelik 1 ay')
                            ->maxLength(120),
                    ])
                    ->columns(2)
                    ->reorderable()
                    ->cloneable()
                    ->defaultItems(0)
                    ->addActionLabel('Sıra ekle')
                    ->itemLabel(fn (array $state): ?string => isset($state['coins']) ? ($state['coins'].' coin') : null)
                    ->columnSpanFull(),

                Forms\Components\TextInput::make('prize_desc')
                    ->label('Genel ödül notu (opsiyonel)')
                    ->maxLength(120)
                    ->columnSpanFull(),
                Forms\Components\Toggle::make('prize_paid')
                    ->label('Ödül ödendi')
                    ->helperText('Turnuva bitince otomatik işaretlenir. Açıkken ödül tekrar ödenmez.'),
                Forms\Components\TextInput::make('entry_fee')
                    ->label('Giriş ücreti (coin)')
                    ->helperText('0 = ücretsiz. Toplanan ücretler ödül havuzuna eklenir.')
                    ->required()
                    ->numeric()
                    ->minValue(0)
                    ->default(0),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('size')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->searchable(),
                Tables\Columns\TextColumn::make('register_until')
                    ->label('Son katılım')
                    ->dateTime('d.m.Y H:i')
                    ->placeholder('—')
                    ->sortable(),
                Tables\Columns\TextColumn::make('creator.nickname')
                    ->label('Oluşturan')
                    ->placeholder('—')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('champion.nickname')
                    ->label('Şampiyon')
                    ->placeholder('—')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('prize_coins')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('prize_desc')
                    ->searchable(),
                Tables\Columns\IconColumn::make('prize_paid')
                    ->boolean(),
                Tables\Columns\TextColumn::make('entry_fee')
                    ->numeric()
                    ->sortable(),
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\Action::make('start')
                    ->label('Başlat')
                    ->icon('heroicon-o-play')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Turnuvayı başlat')
                    ->modalDescription('Eşleşme ağacı oluşturulup turnuva başlatılacak. Bu işlem geri alınamaz.')
                    // Yalnizca kayit acik ve en az 2 oyuncu varken gorunur
                    ->visible(fn (Tournament $record): bool => $record->status === 'open'
                        && count(array_filter($record->players ?? [], fn ($p) => $p !== null)) >= 2)
                    ->action(function (Tournament $record): void {
                        $record->startBracket();
                        \Filament\Notifications\Notification::make()
                            ->title('Turnuva başlatıldı')
                            ->success()
                            ->send();
                    }),
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTournaments::route('/'),
            'create' => Pages\CreateTournament::route('/create'),
            'edit' => Pages\EditTournament::route('/{record}/edit'),
        ];
    }
}
