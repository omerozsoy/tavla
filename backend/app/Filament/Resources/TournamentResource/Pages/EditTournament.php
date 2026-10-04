<?php

namespace App\Filament\Resources\TournamentResource\Pages;

use App\Filament\Resources\TournamentResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditTournament extends EditRecord
{
    protected static string $resource = TournamentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make()
                ->before(fn ($record) => \App\Support\TournamentModeration::cancelWithRefund($record, fn () => null)), // A-22
        ];
    }

    private array $prizeBefore = [];

    protected function beforeSave(): void
    {
        $this->prizeBefore = [(int) $this->record->getOriginal('prize_coins'), $this->record->getOriginal('prizes')];
    }

    // A-32: ödül havuzu/ödül tablosu değişikliği kayda geçer (ödül ödemesi "turnuva ödülü" olarak
    // görünür; panelden yükseltilen havuz izsiz coin üretimi olmasın).
    protected function afterSave(): void
    {
        $after = [(int) $this->record->prize_coins, $this->record->prizes];
        if (json_encode($after) !== json_encode($this->prizeBefore)) {
            \App\Support\Shield::audit(auth()->id(), 'filament_tournament_prize',
                sprintf('tournament=%d prize_coins %d->%d', $this->record->id, $this->prizeBefore[0] ?? 0, $after[0]), 3);
        }
    }
}
