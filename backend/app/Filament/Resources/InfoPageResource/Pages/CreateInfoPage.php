<?php

namespace App\Filament\Resources\InfoPageResource\Pages;

use App\Filament\Resources\InfoPageResource;
use App\Models\InfoPage;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreateInfoPage extends CreateRecord
{
    protected static string $resource = InfoPageResource::class;

    // Adres (slug) = secili ust sayfa + girilen slug; slugify + benzersizlik kontrolu.
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $child = Str::slug((string) ($data['slug'] ?? ''));
        $parent = $data['parent'] ?? null;
        unset($data['parent']);

        if ($child === '') {
            throw ValidationException::withMessages(['slug' => 'Geçerli bir adres girin (küçük harf/rakam/tire).']);
        }

        $full = $parent ? trim($parent, '/').'/'.$child : $child;

        if (InfoPage::where('slug', $full)->exists() || in_array($full, InfoPage::LIVE_COMPONENT_SLUGS, true)) {
            throw ValidationException::withMessages(['slug' => 'Bu adres zaten kullanımda: /'.$full]);
        }

        $data['slug'] = $full;

        return $data;
    }
}
