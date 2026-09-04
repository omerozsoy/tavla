<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">Servis Durumu</x-slot>
        <x-slot name="description">Sunucu-otoriter maçların hakemi (Node validator) + otorite/PR modu</x-slot>

        @php($s = $this->status())
        @php($v = $s['validator'])
        @php($color = ! $v['configured'] ? '#9ca3af' : ($v['up'] ? '#16a34a' : '#dc2626'))
        @php($label = ! $v['configured'] ? 'Yapılandırılmamış' : ($v['up'] ? 'ÇALIŞIYOR' : 'ERİŞİLEMİYOR'))

        <div wire:poll.30s class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    {{-- YEŞİL/kırmızı/gri lamba --}}
                    <span style="display:inline-block;width:15px;height:15px;border-radius:9999px;background:{{ $color }};box-shadow:0 0 9px {{ $color }}"></span>
                    <span class="font-medium">Sunucu Hakem (Validator)</span>
                    <span class="text-sm font-semibold" style="color:{{ $color }}">{{ $label }}</span>
                </div>
                <x-filament::button
                    size="sm"
                    color="gray"
                    icon="heroicon-m-arrow-path"
                    wire:click="restart"
                    wire:confirm="Validator yeniden başlatılsın mı? (Süreç kapanır; Plesk/Passenger birkaç saniyede otomatik canlandırır.)"
                    wire:loading.attr="disabled"
                >
                    Yeniden Başlat
                </x-filament::button>
            </div>

            @if (! $v['up'] && $v['configured'] && $v['required'])
                <p class="text-sm font-medium" style="color:#dc2626">
                    ⚠ Fail-closed: validator erişilemezken authoritative maçlarda hamleler REDDEDİLİR.
                </p>
            @endif

            <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="flex items-center gap-2">
                    <span class="text-gray-500">Sunucu-Otorite:</span>
                    <span class="font-medium">{{ $s['authoritative'] ? 'AÇIK (tüm maçlar)' : 'Kapalı' }}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-500">PR Modu:</span>
                    <span class="font-medium">
                        {{ $s['pr_mode'] === 'authoritative' ? 'AUTHORITATIVE' : ($s['pr_mode'] === 'shadow' ? 'SHADOW (gölge)' : 'Kapalı (istemci)') }}
                    </span>
                </div>
            </div>
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
