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
            // Üye listesine dön (detay sayfasından hızlı geri dönüş).
            Actions\Action::make('back')
                ->label('Geri Dön')
                ->icon('heroicon-m-arrow-left')
                ->color('gray')
                ->url(fn () => UserResource::getUrl('index')),
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
                ->action(fn (User $record, array $data) => UserResource::closeAccountSafely($record, $data)),
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
            // Konuşma yasağı (sohbet susturma) — profilden doğrudan uygula; durum "Hesap Durumu" sekmesinde görünür.
            Actions\Action::make('chatMute')
                ->label(fn (User $record) => $record->chat_muted_until && $record->chat_muted_until->isFuture()
                    ? 'Konuşma Yasağı (aktif)' : 'Konuşma Yasağı')
                ->icon('heroicon-m-chat-bubble-left-ellipsis')
                ->color('warning')
                ->modalHeading('Konuşma Yasağı (sohbet susturma)')
                ->modalSubmitActionLabel('Uygula')
                ->form(UserResource::chatMuteFormSchema())
                ->action(fn (User $record, array $data) => UserResource::applyChatMute($record, $data)),
        ];
    }
}
