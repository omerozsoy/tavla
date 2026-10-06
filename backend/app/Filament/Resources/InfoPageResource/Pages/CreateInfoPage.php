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

    // Adres (slug): slugify + benzersizlik kontrolu. Ust baslik (section) ayri kolon -> URL duz kalir.
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $slug = Str::slug((string) ($data['slug'] ?? ''));

        if ($slug === '') {
            throw ValidationException::withMessages(['slug' => 'Geçerli bir adres girin (küçük harf/rakam/tire).']);
        }

        if (InfoPage::where('slug', $slug)->exists() || in_array($slug, InfoPage::LIVE_COMPONENT_SLUGS, true)) {
            throw ValidationException::withMessages(['slug' => 'Bu adres zaten kullanımda: /'.$slug]);
        }

        $data['slug'] = $slug;

        return $data;
    }
}
