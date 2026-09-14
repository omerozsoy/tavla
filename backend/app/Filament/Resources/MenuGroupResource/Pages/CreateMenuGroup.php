<?php

namespace App\Filament\Resources\MenuGroupResource\Pages;

use App\Filament\Resources\MenuGroupResource;
use App\Models\MenuGroup;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Str;

class CreateMenuGroup extends CreateRecord
{
    protected static string $resource = MenuGroupResource::class;

    // Yeni grup: benzersiz 'key' (baslik slug'indan) + sirayi en sona koy.
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $base = Str::slug((string) ($data['label_tr'] ?? '')) ?: 'grup';
        $key = $base;
        $i = 2;
        while (MenuGroup::where('key', $key)->exists()) {
            $key = $base.'-'.$i++;
        }
        $data['key'] = $key;
        $data['sort'] = (int) (MenuGroup::max('sort') ?? -1) + 1;

        return $data;
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
