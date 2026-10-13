<x-filament-panels::page>
    <div class="text-sm text-gray-500 dark:text-gray-400">
        Buradaki değişiklikler <strong>yalnızca gammontv.com</strong> menüsünü etkiler.
        Grup ismini boş bırakırsan tavlatv'nin İngilizce etiketi kullanılır. Bir sayfayı kapatırsan
        gammontv menüsünde görünmez (tavlatv'de görünmeye devam eder).
    </div>

    <form wire:submit="save" class="space-y-6">
        {{ $this->form }}

        <div class="flex justify-end">
            <x-filament::button type="submit" icon="heroicon-m-check">
                Kaydet
            </x-filament::button>
        </div>
    </form>
</x-filament-panels::page>
