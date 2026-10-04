<?php

namespace App\Filament\Resources\BoardDesignResource\Pages;

use App\Filament\Resources\BoardDesignResource;
use App\Models\BoardDesign;
use Filament\Resources\Pages\CreateRecord;

class CreateBoardDesign extends CreateRecord
{
    protected static string $resource = BoardDesignResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['is_custom'] = true; // admin'in oluşturduğu her tahta özel tahtadır
        $data['sort'] = 1000 + (int) BoardDesign::where('is_custom', true)->count();
        $data['colors'] = array_map(fn ($v) => strtolower((string) $v), $data['colors'] ?? []);

        return $data;
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
