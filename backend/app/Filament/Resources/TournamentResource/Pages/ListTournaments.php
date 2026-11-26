<?php

namespace App\Filament\Resources\TournamentResource\Pages;

use App\Filament\Resources\TournamentResource;
use App\Models\Tournament;
use App\Models\TournamentSchedule;
use Filament\Actions;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;

class ListTournaments extends ListRecords
{
    protected static string $resource = TournamentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
            // TavlaTV'nin otomatik kurduğu (periyodik) AÇIK turnuvalara tek tıkla ödül uygula:
            // ödül tablosunu temizle + havuzu aç + sabit şampiyon ödülü (Dışarda Swiss hariç).
            // Periyodik = adı bir şablon adıyla "{şablon} — tarih" önekli (şablon_id kolonu yok).
            Actions\Action::make('applyPeriodicPrizes')
                ->label('Periyodik ödül uygula')
                ->icon('heroicon-o-gift')
                ->color('warning')
                ->requiresConfirmation()
                ->modalHeading('Periyodik turnuvalara ödül uygula')
                ->modalDescription('Açık periyodik (otomatik kurulan) turnuvalara uygulanır: ödül tablosu temizlenir, Otomatik Ödül Havuzu açılır ve sabit şampiyon ödülü yazılır. Dışarda Swiss hariç (0). Elle/grup turnuvalarına DOKUNMAZ.')
                ->form([
                    Forms\Components\TextInput::make('prize_coins')
                        ->label('Sabit şampiyon ödülü (coin)')
                        ->helperText('Her periyodik turnuvanın 1.’liğine eklenir. 0 = yok.')
                        ->numeric()->integer()->minValue(0)->default(1000)->required(),
                ])
                ->action(function (array $data) {
                    $amount = (int) ($data['prize_coins'] ?? 1000);
                    $names = TournamentSchedule::pluck('name')->all();
                    $n = 0;
                    foreach (Tournament::where('status', 'open')->get() as $t) {
                        $isPeriodic = false;
                        foreach ($names as $nm) {
                            if (str_starts_with($t->name, $nm.' — ')) {
                                $isPeriodic = true;
                                break;
                            }
                        }
                        if (! $isPeriodic) {
                            continue;
                        }
                        $t->prizes = [];
                        $t->pool_enabled = true;
                        $t->prize_coins = $t->type === 'swiss_outdoor' ? 0 : $amount;
                        $t->save();
                        $n++;
                    }
                    Notification::make()
                        ->title("{$n} periyodik turnuvaya ödül uygulandı")
                        ->body('Ödül tablosu temizlendi, havuz açıldı, sabit ödül '.$amount.' coin (Dışarda Swiss hariç).')
                        ->success()
                        ->send();
                }),
        ];
    }
}
