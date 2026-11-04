<?php

namespace App\Filament\Resources\TeamResource\Pages;

use App\Filament\Resources\TeamResource;
use App\Models\User;
use App\Support\TeamLeague\TeamException;
use App\Support\TeamLeague\TeamService;
use Filament\Actions;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;

class ListTeams extends ListRecords
{
    protected static string $resource = TeamResource::class;

    protected function getHeaderActions(): array
    {
        return [
            // Admin §12 ek: takımı seçilen kurucu adına kur (Premium/coin/rating şartı YOK).
            Actions\Action::make('adminCreate')
                ->label('Takım Kur')
                ->icon('heroicon-o-plus')
                ->modalHeading('Yeni takım kur')
                ->form([
                    Forms\Components\Select::make('founder_id')
                        ->label('Kurucu (kullanıcı)')
                        ->searchable()
                        ->required()
                        ->getSearchResultsUsing(fn (string $search) => User::query()
                            ->where('nickname', 'like', "%{$search}%")
                            ->limit(30)->pluck('nickname', 'id'))
                        ->getOptionLabelUsing(fn ($value) => User::whereKey($value)->value('nickname')),
                    Forms\Components\TextInput::make('name')->label('Ad')->required()->minLength(3)->maxLength(30),
                    Forms\Components\TextInput::make('tag')->label('Etiket')->required()->minLength(2)->maxLength(5),
                    Forms\Components\TextInput::make('description')->label('Açıklama')->maxLength(500),
                ])
                ->action(function (array $data): void {
                    try {
                        $founder = User::findOrFail($data['founder_id']);
                        $team = app(TeamService::class)->adminCreateTeam($founder, $data);
                        Notification::make()->title('Takım kuruldu: '.$team->name)->success()->send();
                    } catch (TeamException $e) {
                        Notification::make()->title('İşlem başarısız')->body($e->errorCode)->danger()->send();
                    } catch (\Throwable $e) {
                        Notification::make()->title('Hata')->body($e->getMessage())->danger()->send();
                    }
                }),
        ];
    }
}
