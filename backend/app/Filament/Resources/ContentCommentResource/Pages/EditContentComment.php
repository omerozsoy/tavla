<?php

namespace App\Filament\Resources\ContentCommentResource\Pages;

use App\Filament\Resources\ContentCommentResource;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;

class EditContentComment extends EditRecord
{
    protected static string $resource = ContentCommentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            // Onayla: yorumu yayina al (approved).
            Actions\Action::make('approve')->label('Onayla ve Yayınla')
                ->icon('heroicon-o-check-circle')->color('success')
                ->visible(fn () => $this->record->status !== 'approved')
                ->action(function () {
                    $this->record->update(['status' => 'approved', 'approved_at' => now()]);
                    $this->refreshFormData(['status']);
                    Notification::make()->title('Yorum yayına alındı')->success()->send();
                }),
            Actions\Action::make('reject')->label('Reddet')
                ->icon('heroicon-o-x-circle')->color('danger')
                ->requiresConfirmation()
                ->visible(fn () => $this->record->status !== 'rejected')
                ->action(function () {
                    $this->record->update(['status' => 'rejected']);
                    $this->refreshFormData(['status']);
                    Notification::make()->title('Yorum reddedildi')->warning()->send();
                }),
            Actions\DeleteAction::make()->label('Sil'),
        ];
    }
}
