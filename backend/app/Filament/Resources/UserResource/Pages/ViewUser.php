<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Support\AccountClosure;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;

class ViewUser extends ViewRecord
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\EditAction::make(),
            // Profil sayfasında "Hesabı Kapat / Yeniden Aç" (adminlere görünür — panel zaten admin-only).
            Actions\Action::make('closeAccount')
                ->label('Hesabı Kapat')
                ->icon('heroicon-m-lock-closed')
                ->color('danger')
                ->visible(fn (User $record) => ! $record->isBanned())
                ->modalHeading('Hesabı Kapat / Siteden Yasakla')
                ->modalSubmitActionLabel('Hesabı Kapat')
                ->form(UserResource::closeFormSchema())
                ->action(fn (User $record, array $data) => AccountClosure::close(
                    $record, (int) auth()->id(), $data['reason'], $data['note'] ?? null
                )),
            Actions\Action::make('reopenAccount')
                ->label('Hesabı Yeniden Aç')
                ->icon('heroicon-m-lock-open')
                ->color('success')
                ->visible(fn (User $record) => $record->isBanned())
                ->modalHeading('Hesabı Yeniden Aç')
                ->modalSubmitActionLabel('Yeniden Aç')
                ->form(UserResource::reopenFormSchema())
                ->action(fn (User $record, array $data) => AccountClosure::reopen(
                    $record, (int) auth()->id(), $data['reason']
                )),
        ];
    }
}
