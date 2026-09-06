<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">Servis Durumu</x-slot>
        <x-slot name="description">Çalışan tüm servisler (validator · gnubg · veritabanı · queue) + otorite/PR/luck modu</x-slot>

        @php($s = $this->status())

        <div wire:poll.30s class="space-y-3">
            @foreach ($s['services'] as $svc)
                @php($color = $svc['up'] === true ? '#16a34a' : ($svc['up'] === false ? '#dc2626' : '#9ca3af'))
                @php($label = ! $svc['configured']
                    ? 'Yapılandırılmamış'
                    : ($svc['up'] === true ? 'ÇALIŞIYOR' : ($svc['up'] === false ? 'ERİŞİLEMİYOR' : 'Boşta')))
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-2 dark:border-gray-800">
                    <div class="flex items-center gap-2">
                        {{-- yeşil/kırmızı/gri lamba --}}
                        <span style="display:inline-block;width:14px;height:14px;border-radius:9999px;background:{{ $color }};box-shadow:0 0 8px {{ $color }}"></span>
                        <span class="font-medium">{{ $svc['name'] }}</span>
                        <span class="text-sm font-semibold" style="color:{{ $color }}">{{ $label }}</span>
                        @if (! empty($svc['detail']))
                            <span class="text-xs text-gray-400">— {{ $svc['detail'] }}</span>
                        @endif
                    </div>
                    @if (! empty($svc['restart']))
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
                    @endif
                </div>

                @if ($svc['key'] === 'validator' && $svc['up'] === false && $svc['configured'] && $s['validator_required'])
                    <p class="text-sm font-medium" style="color:#dc2626">
                        ⚠ Fail-closed: validator erişilemezken authoritative maçlarda hamleler REDDEDİLİR.
                    </p>
                @endif
            @endforeach

            <div class="grid grid-cols-1 gap-2 pt-1 text-sm sm:grid-cols-3">
                <div class="flex items-center gap-2">
                    <span class="text-gray-500">Sunucu-Otorite:</span>
                    <span class="font-medium">{{ $s['authoritative'] ? 'AÇIK' : 'Kapalı' }}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-500">PR Modu:</span>
                    <span class="font-medium">
                        {{ $s['pr_mode'] === 'authoritative' ? 'AUTHORITATIVE' : ($s['pr_mode'] === 'shadow' ? 'SHADOW' : 'Kapalı') }}
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-gray-500">gnubg PR/Luck:</span>
                    <span class="font-medium">
                        {{ $s['gnubg_pr_mode'] === 'authoritative' ? 'AUTHORITATIVE' : ($s['gnubg_pr_mode'] === 'shadow' ? 'SHADOW' : 'Kapalı') }}
                    </span>
                </div>
            </div>
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
