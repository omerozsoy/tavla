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

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 3;

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
                Forms\Components\TextInput::make('status')
                    ->required(),
                Forms\Components\TextInput::make('creator_id')
                    ->numeric(),
                Forms\Components\Textarea::make('players')
                    ->columnSpanFull(),
                Forms\Components\Textarea::make('bracket')
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('champion_id')
                    ->numeric(),
                Forms\Components\TextInput::make('prize_coins')
                    ->required()
                    ->numeric()
                    ->default(0),
                Forms\Components\TextInput::make('prize_desc'),
                Forms\Components\Toggle::make('prize_paid')
                    ->required(),
                Forms\Components\TextInput::make('entry_fee')
                    ->required()
                    ->numeric()
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
                Tables\Columns\TextColumn::make('creator_id')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('champion_id')
                    ->numeric()
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
