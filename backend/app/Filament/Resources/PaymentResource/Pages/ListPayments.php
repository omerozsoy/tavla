<?php

namespace App\Filament\Resources\PaymentResource\Pages;

use App\Filament\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\Setting;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListPayments extends ListRecords
{
    protected static string $resource = PaymentResource::class;

    // Liste açılınca "son görülen ödeme" damgalanır -> menüdeki kırmızı yeni-ödeme rozeti sıfırlanır.
    public function mount(): void
    {
        parent::mount();
        Setting::put('admin_seen_payment_id', (int) Payment::query()->max('id'));
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
