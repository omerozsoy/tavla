<?php

namespace App\Filament\Resources\ChatReportResource\Pages;

use App\Filament\Resources\ChatReportResource;
use App\Models\ChatReport;
use Filament\Actions;
use Filament\Forms;
use Filament\Resources\Pages\EditRecord;

class EditChatReport extends EditRecord
{
    protected static string $resource = ChatReportResource::class;

    protected function getHeaderActions(): array
    {
        return [
            // Şikayet edilene konuşma yasağı ver: iki tarafa da bilgi mesajı gider, küfürlü kelimeler
            // Yasaklılar listesine işlenir, şikayet "Çözüldü" olur.
            Actions\Action::make('ban')->label('Konuşma Yasağı Ver')
                ->icon('heroicon-o-no-symbol')->color('danger')
                ->form([
                    Forms\Components\Select::make('minutes')->label('Süre')->required()
                        ->options(ChatReportResource::BAN_DURATIONS)->default('1440')->native(false),
                ])
                ->modalHeading('Konuşma yasağı ver')
                ->modalDescription(fn () => (($this->record->reported_name ?? null) ?: 'Şikayet edilen')
                    .' oyuncusuna yasak uygulanacak; hem şikayet edene hem edilene bilgi mesajı gönderilecek.')
                ->action(function (array $data) {
                    /** @var ChatReport $r */
                    $r = $this->record;
                    ChatReportResource::applyBanFromReport($r, (int) $data['minutes']);
                    $this->refreshFormData(['status', 'admin_note']);
                }),
            Actions\DeleteAction::make()->label('Sil'),
        ];
    }
}
