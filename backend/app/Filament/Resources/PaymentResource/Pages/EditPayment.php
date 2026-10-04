<?php

namespace App\Filament\Resources\PaymentResource\Pages;

use App\Filament\Resources\PaymentResource;
use Filament\Resources\Pages\EditRecord;

class EditPayment extends EditRecord
{
    protected static string $resource = PaymentResource::class;

    private ?string $statusBefore = null;

    protected function beforeSave(): void
    {
        $this->statusBefore = (string) $this->record->getOriginal('status');
    }

    // A-32: havale ödemesinin durumunu (paid/pending/failed) kimin değiştirdiği kayda geçer.
    protected function afterSave(): void
    {
        $now = (string) $this->record->status;
        if ($this->statusBefore !== null && $now !== $this->statusBefore) {
            \App\Support\Shield::audit(auth()->id(), 'filament_payment_status',
                sprintf('payment=%d order=%s %s->%s', $this->record->id, $this->record->order_id, $this->statusBefore, $now), 3);
        }
    }
}
