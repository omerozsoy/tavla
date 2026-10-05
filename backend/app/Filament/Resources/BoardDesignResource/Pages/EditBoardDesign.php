<?php

namespace App\Filament\Resources\BoardDesignResource\Pages;

use App\Filament\Resources\BoardDesignResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditBoardDesign extends EditRecord
{
    protected static string $resource = BoardDesignResource::class;

    protected function mutateFormDataBeforeSave(array $data): array
    {
        // Yerleşik tahta: ad/renk/doku koda aittir — formdan gelse bile yazılmaz.
        if (! $this->record->is_custom) {
            unset($data['name'], $data['colors'], $data['surface'], $data['checker_style'], $data['point_image_odd'], $data['point_image_even'], $data['point_image_fit']);
        } elseif (isset($data['colors'])) {
            $data['colors'] = array_map(fn ($v) => strtolower((string) $v), $data['colors']);
        }
        if ($this->record->isFree()) {
            unset($data['group'], $data['price'], $data['active']);
        }

        return $data;
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make()->visible(fn () => $this->record->is_custom && BoardDesignResource::ownerCount($this->record, true) === 0),
        ];
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
