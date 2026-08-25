<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Http\Controllers\PanelController;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';

    protected static ?string $navigationLabel = 'Üyeler';

    protected static ?string $modelLabel = 'üye';

    protected static ?string $pluralModelLabel = 'Üyeler';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 0;

    protected static ?string $recordTitleAttribute = 'nickname';

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Kimlik')->columns(2)->schema([
                Forms\Components\TextInput::make('nickname')->label('Takma ad')->required(),
                Forms\Components\TextInput::make('email')->label('E-posta')->email()->required(),
                Forms\Components\TextInput::make('first_name')->label('Ad'),
                Forms\Components\TextInput::make('last_name')->label('Soyad'),
                Forms\Components\Select::make('country')->label('Ülke')
                    ->options(array_combine(\App\Support\Geo::COUNTRIES, \App\Support\Geo::COUNTRIES))
                    ->searchable(),
                Forms\Components\Select::make('province')->label('İl')
                    ->options(array_combine(EventResource::PROVINCES, EventResource::PROVINCES))
                    ->searchable(),
                // Sifre: yalnizca doldurulursa degisir (model 'hashed' cast'i ile hash'lenir)
                Forms\Components\TextInput::make('password')->label('Yeni şifre')
                    ->password()->dehydrated(fn ($state) => filled($state))
                    ->required(fn (string $operation) => $operation === 'create')
                    ->helperText('Boş bırakılırsa değişmez'),
            ]),
            Forms\Components\Section::make('Oyun / Puan')->columns(3)->schema([
                Forms\Components\TextInput::make('rating')->label('Rating (puan)')->numeric()
                    ->minValue(100)->maxValue(4000)->default(1500)
                    ->helperText(fn ($state) => 'Seviye: '.PanelController::levelLabel((int) ($state ?: 1500))),
                Forms\Components\Select::make('level_min')->label('Ünvan Ata (kısayol)')
                    ->options(array_flip(PanelController::LEVELS))
                    ->dehydrated(false)
                    ->helperText('Seçince rating o kademenin alt eşiğine ayarlanır')
                    ->live()
                    ->afterStateUpdated(fn ($state, Forms\Set $set) => $state !== null ? $set('rating', max(100, (int) $state)) : null),
                Forms\Components\TextInput::make('coins')->label('Coin')->numeric()->default(0),
                Forms\Components\TextInput::make('wins')->label('Galibiyet')->numeric()->default(0),
                Forms\Components\TextInput::make('losses')->label('Mağlubiyet')->numeric()->default(0),
                Forms\Components\TextInput::make('games_played')->label('Oynanan')->numeric()->default(0),
            ]),
            Forms\Components\Section::make('Üyelik & Yetki')->columns(2)->schema([
                Forms\Components\Select::make('plan')->label('Plan')->options([
                    'free' => 'Ücretsiz',
                    'star' => 'Premium',
                ])->default('free'),
                Forms\Components\DateTimePicker::make('plan_until')->label('Plan bitişi'),
                Forms\Components\Toggle::make('is_admin')->label('Yönetici'),
                Forms\Components\DateTimePicker::make('banned_at')->label('Yasak tarihi (boş = aktif)'),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('nickname')->label('Takma ad')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('email')->label('E-posta')->searchable()->toggleable(),
                Tables\Columns\TextColumn::make('rating')->label('Puan')->sortable(),
                Tables\Columns\TextColumn::make('rating')->label('Ünvan')
                    ->formatStateUsing(fn ($state) => PanelController::levelLabel((int) ($state ?: 1500)))
                    ->badge()->color('warning'),
                Tables\Columns\TextColumn::make('coins')->label('Coin')->sortable()
                    ->formatStateUsing(fn ($state) => number_format((int) $state, 0, ',', '.')),
                Tables\Columns\TextColumn::make('wins')->label('G/M')
                    ->formatStateUsing(fn ($state, $record) => ($record->wins ?? 0).'/'.($record->losses ?? 0)),
                Tables\Columns\TextColumn::make('plan_active')->label('Plan')->badge()
                    ->color(fn ($state) => $state === 'free' ? 'gray' : 'success')
                    ->formatStateUsing(fn ($state) => $state === 'free' ? 'Ücretsiz' : 'Premium'),
                Tables\Columns\IconColumn::make('is_admin')->label('Admin')->boolean(),
                Tables\Columns\IconColumn::make('banned_at')->label('Yasaklı')
                    ->boolean()->trueColor('danger')->falseColor('gray')
                    ->getStateUsing(fn ($record) => $record->banned_at !== null),
                Tables\Columns\TextColumn::make('created_at')->label('Kayıt')->dateTime('d.m.Y')->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('plan')->label('Plan')->options([
                    'free' => 'Ücretsiz', 'star' => 'Premium',
                ]),
                Tables\Filters\TernaryFilter::make('is_admin')->label('Yönetici'),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\Action::make('ban')
                    ->label(fn ($record) => $record->banned_at ? 'Yasağı Kaldır' : 'Yasakla')
                    ->icon('heroicon-m-no-symbol')
                    ->color(fn ($record) => $record->banned_at ? 'gray' : 'danger')
                    ->requiresConfirmation()
                    ->action(function ($record) {
                        $record->banned_at = $record->banned_at ? null : now();
                        if ($record->banned_at) {
                            $record->tokens()->delete();
                        }
                        $record->save();
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}
