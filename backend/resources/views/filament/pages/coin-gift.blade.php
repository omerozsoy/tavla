<x-filament-panels::page>
    <form wire:submit="gift" class="space-y-6">
        {{ $this->form }}

        <div class="flex justify-end gap-3">
            <x-filament::button type="button" color="gray" icon="heroicon-m-users" wire:click="preview">
                Kaç kişi? (önizle)
            </x-filament::button>
            <x-filament::button type="submit" icon="heroicon-m-gift"
                wire:confirm="Seçili kitleye coin dağıtılsın mı? Bu işlem geri alınamaz.">
                Coin Hediye Et
            </x-filament::button>
        </div>
    </form>
</x-filament-panels::page>
