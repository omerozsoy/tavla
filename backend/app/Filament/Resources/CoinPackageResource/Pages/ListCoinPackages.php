<?php

namespace App\Filament\Resources\CoinPackageResource\Pages;

use App\Filament\Resources\CoinPackageResource;
use App\Models\Setting;
use Filament\Actions;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;

class ListCoinPackages extends ListRecords
{
    protected static string $resource = CoinPackageResource::class;

    protected function getHeaderActions(): array
    {
        return [
            // Premium yillik fiyati (Setting: premium_yearly_price, KURUS). Sitede gosterilen VE
            // tahsil edilen tutar; subscribe + buyMembership + SPA ayni degeri okur.
            Actions\Action::make('premiumPrice')
                ->label('Premium Fiyatı')
                ->icon('heroicon-o-star')
                ->color('warning')
                ->modalHeading('Premium yıllık üyelik fiyatı')
                ->modalSubmitActionLabel('Kaydet')
                ->fillForm(fn (): array => [
                    'premium_yearly' => Setting::int('premium_yearly_price', 49900) / 100,
                ])
                ->form([
                    TextInput::make('premium_yearly')
                        ->label('Yıllık premium fiyatı (TL)')
                        ->numeric()
                        ->minValue(0)
                        ->step(0.01)
                        ->required()
                        ->suffix('₺')
                        ->helperText('Sitede gösterilen ve tahsil edilen yıllık premium üyelik fiyatı. Örn. 499'),
                ])
                ->action(function (array $data): void {
                    // TL -> kurus (banka birimi; coin fiyatlariyla ayni donusum).
                    Setting::put('premium_yearly_price', (int) round(((float) $data['premium_yearly']) * 100));
                    Notification::make()->title('Premium fiyatı güncellendi')->success()->send();
                }),
            Actions\CreateAction::make(),
        ];
    }
}
