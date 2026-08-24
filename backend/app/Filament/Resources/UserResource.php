<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Filament\Resources\UserResource\RelationManagers;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('first_name')
                    ->required(),
                Forms\Components\TextInput::make('last_name')
                    ->required(),
                Forms\Components\TextInput::make('country'),
                Forms\Components\TextInput::make('nickname')
                    ->required(),
                Forms\Components\TextInput::make('email')
                    ->email()
                    ->required(),
                Forms\Components\DateTimePicker::make('email_verified_at'),
                Forms\Components\TextInput::make('password')
                    ->password()
                    ->required(),
                Forms\Components\Textarea::make('game_state')
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('rating')
                    ->required()
                    ->numeric()
                    ->default(1500),
                Forms\Components\Textarea::make('avatar')
                    ->columnSpanFull(),
                Forms\Components\DatePicker::make('birth_date'),
                Forms\Components\TextInput::make('wins')
                    ->required()
                    ->numeric()
                    ->default(0),
                Forms\Components\TextInput::make('losses')
                    ->required()
                    ->numeric()
                    ->default(0),
                Forms\Components\TextInput::make('games_played')
                    ->required()
                    ->numeric()
                    ->default(0),
                Forms\Components\TextInput::make('coins')
                    ->required()
                    ->numeric()
                    ->default(0),
                Forms\Components\Textarea::make('unlocks')
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('avatar_frame'),
                Forms\Components\DateTimePicker::make('last_seen'),
                Forms\Components\DatePicker::make('last_daily'),
                Forms\Components\DateTimePicker::make('last_reward'),
                Forms\Components\Toggle::make('is_admin')
                    ->required(),
                Forms\Components\DateTimePicker::make('banned_at'),
                Forms\Components\Textarea::make('badges')
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('plan')
                    ->required(),
                Forms\Components\DateTimePicker::make('plan_until'),
                Forms\Components\Toggle::make('trial_used')
                    ->required(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('first_name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('last_name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('country')
                    ->searchable(),
                Tables\Columns\TextColumn::make('nickname')
                    ->searchable(),
                Tables\Columns\TextColumn::make('email')
                    ->searchable(),
                Tables\Columns\TextColumn::make('email_verified_at')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('rating')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('birth_date')
                    ->date()
                    ->sortable(),
                Tables\Columns\TextColumn::make('wins')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('losses')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('games_played')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('coins')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('avatar_frame')
                    ->searchable(),
                Tables\Columns\TextColumn::make('last_seen')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\TextColumn::make('last_daily')
                    ->date()
                    ->sortable(),
                Tables\Columns\TextColumn::make('last_reward')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_admin')
                    ->boolean(),
                Tables\Columns\TextColumn::make('banned_at')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\TextColumn::make('plan')
                    ->searchable(),
                Tables\Columns\TextColumn::make('plan_until')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\IconColumn::make('trial_used')
                    ->boolean(),
            ])
            ->filters([
                //
            ])
            ->actions([
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
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}
