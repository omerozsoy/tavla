<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TeamMatchResource\Pages;
use App\Models\Team;
use App\Models\TeamMatch;
use App\Support\TeamLeague\TeamException;
use App\Support\TeamLeague\TeamMatchRuntime;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Takımlar Ligi — ADMIN karşılaşma moderasyonu (§12): gerekçeli iptal + sonuç düzeltme (ortalama/ödül
 * yeniden hesap TeamMatchRuntime'da). Create/edit kapalı; yalnız moderasyon aksiyonları.
 */
class TeamMatchResource extends Resource
{
    protected static ?string $model = TeamMatch::class;

    protected static ?string $navigationIcon = 'heroicon-o-trophy';

    protected static ?string $navigationGroup = 'Takımlar Ligi';

    protected static ?string $navigationLabel = 'Karşılaşmalar';

    protected static ?string $modelLabel = 'karşılaşma';

    protected static ?string $pluralModelLabel = 'Karşılaşmalar';

    public static function canCreate(): bool
    {
        return false;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('ID')->sortable(),
                Tables\Columns\TextColumn::make('home_team_id')->label('Ev')
                    ->formatStateUsing(fn ($state) => self::tag($state)),
                Tables\Columns\TextColumn::make('away_team_id')->label('Deplasman')
                    ->formatStateUsing(fn ($state) => self::tag($state)),
                Tables\Columns\TextColumn::make('scheduled_at')->label('Başlangıç')->dateTime('d.m.Y H:i')->sortable(),
                Tables\Columns\TextColumn::make('status')->label('Durum')->badge()
                    ->color(fn (string $state) => match ($state) {
                        'finished' => 'success', 'cancelled' => 'gray', 'live' => 'warning', default => 'primary',
                    }),
                Tables\Columns\TextColumn::make('score')->label('Skor')
                    ->state(fn (TeamMatch $r) => rtrim(rtrim((string) $r->home_score, '0'), '.').' - '.rtrim(rtrim((string) $r->away_score, '0'), '.')),
                Tables\Columns\TextColumn::make('result')->label('Sonuç')->badge()->placeholder('—'),
                Tables\Columns\TextColumn::make('month_key')->label('Ay')->placeholder('—'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')->options([
                    'proposed' => 'Teklif', 'scheduled' => 'Takvimde', 'live' => 'Canlı',
                    'finished' => 'Bitti', 'cancelled' => 'İptal',
                ]),
            ])
            ->actions([
                Tables\Actions\Action::make('cancel')->label('İptal Et')
                    ->icon('heroicon-o-x-circle')->color('danger')
                    ->visible(fn (TeamMatch $r) => $r->status !== 'finished' && $r->status !== 'cancelled')
                    ->form([
                        Forms\Components\Textarea::make('reason')->label('Gerekçe')->required()->maxLength(160),
                    ])
                    ->action(fn (TeamMatch $r, array $data) => self::run(
                        fn () => app(TeamMatchRuntime::class)->adminCancel($r, (int) auth()->id(), $data['reason']),
                        'Karşılaşma iptal edildi.'
                    )),
                Tables\Actions\Action::make('correct')->label('Sonucu Düzelt')
                    ->icon('heroicon-o-pencil-square')->color('warning')
                    ->visible(fn (TeamMatch $r) => in_array($r->status, ['finished', 'live', 'scheduled'], true))
                    ->form([
                        Forms\Components\Select::make('result')->label('Takım sonucu')->required()->native(false)
                            ->options([
                                'home_win' => 'Ev kazandı', 'away_win' => 'Deplasman kazandı',
                                'draw' => 'Beraberlik', 'double_forfeit' => 'Çift hükmen (iki tarafa 0)',
                            ]),
                        Forms\Components\TextInput::make('home_score')->label('Ev skoru')->numeric()->default(0)->minValue(0)->maxValue(5)->step(0.5)->required(),
                        Forms\Components\TextInput::make('away_score')->label('Deplasman skoru')->numeric()->default(0)->minValue(0)->maxValue(5)->step(0.5)->required(),
                        Forms\Components\Textarea::make('reason')->label('Gerekçe')->required()->maxLength(255),
                    ])
                    ->action(fn (TeamMatch $r, array $data) => self::run(
                        fn () => app(TeamMatchRuntime::class)->adminCorrectResult($r, $data, (int) auth()->id(), $data['reason']),
                        'Sonuç düzeltildi; sıralama/ödüller yeniden hesaplandı.'
                    )),
            ]);
    }

    private static function tag($teamId): string
    {
        return Team::whereKey($teamId)->value('tag') ?? ('#'.$teamId);
    }

    private static function run(callable $fn, string $success): void
    {
        try {
            $fn();
            Notification::make()->title($success)->success()->send();
        } catch (TeamException $e) {
            Notification::make()->title('İşlem başarısız')->body($e->errorCode)->danger()->send();
        } catch (\Throwable $e) {
            Notification::make()->title('Hata')->body($e->getMessage())->danger()->send();
        }
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTeamMatches::route('/'),
        ];
    }
}
