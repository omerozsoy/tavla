<?php

namespace App\Filament\Resources\LuckyWheelRewardResource\Pages;

use App\Filament\Resources\LuckyWheelRewardResource;
use App\Models\LuckyWheelReward;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\DB;

class ListLuckyWheelRewards extends ListRecords
{
    protected static string $resource = LuckyWheelRewardResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('shuffle')
                ->label('Çarkı Karıştır')
                ->icon('heroicon-o-arrow-path')
                ->color('warning')
                ->requiresConfirmation()
                ->modalHeading('Çarkı karıştır')
                ->modalDescription('Tüm ödüllerin dilim sırası (sort) rastgele yeniden dağıtılacak. Kazanma ihtimalleri (weight/yüzde) DEĞİŞMEZ; yalnızca çarktaki görünüm sırası değişir.')
                ->modalSubmitActionLabel('Karıştır')
                ->action(function (): void {
                    $rewards = LuckyWheelReward::query()->get();
                    $n = $rewards->count();
                    if ($n === 0) {
                        Notification::make()
                            ->title('Karıştırılacak ödül yok')
                            ->warning()
                            ->send();

                        return;
                    }

                    // 0..n-1 permütasyonu -> çakışmasız benzersiz sıra numaraları.
                    $orders = range(0, $n - 1);
                    shuffle($orders);

                    DB::transaction(function () use ($rewards, $orders): void {
                        foreach ($rewards->values() as $i => $reward) {
                            $reward->update(['sort' => $orders[$i]]);
                        }
                    });

                    Notification::make()
                        ->title('Çark karıştırıldı')
                        ->body($n.' ödülün dilim sırası rastgele değişti.')
                        ->success()
                        ->send();
                }),
            Actions\CreateAction::make()->label('Yeni Ödül Ekle'),
        ];
    }
}
