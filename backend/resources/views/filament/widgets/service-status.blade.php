<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">Servis Durumu</x-slot>
        <x-slot name="description">Hakem (validator) · Maç türleri · gnubg havuzları (Canlı YZ · PR · Mat) · Altyapı</x-slot>

        {{-- Gruplama/sayım status()'ta yapılır (blade @php BLOK'u sunucu Blade derleyicisinde
             $down'u yutup 500 veriyordu). Burada yalnız eski-güvenli inline @php(...) ile okunur. --}}
        @php($s = $this->status())
        @php($groups = $s['groups'])
        @php($down = $s['down'])
        @php($total = $s['total'])
        @php($okN = $s['okN'])

        <div wire:poll.30s class="space-y-2" style="font-size:15px">
            {{-- ÜST ÖZET: tek satır — kaç ayakta + sorun + mod --}}
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="inline-flex items-center gap-1.5 font-semibold">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:{{ $down->isEmpty() ? '#16a34a' : '#dc2626' }}"></span>
                    {{ $okN }}/{{ $total }} ayakta
                </span>
                @if ($down->isNotEmpty())
                    <span class="font-semibold text-red-600 dark:text-red-400">{{ $down->count() }} sorun</span>
                @endif
                <span class="text-gray-500">PR: <b>{{ $s['gnubg_pr_mode'] === 'authoritative' ? 'OTORİTER' : ($s['gnubg_pr_mode'] === 'shadow' ? 'gölge' : 'kapalı') }}</b></span>
                <span class="text-gray-500">Otorite: <b>{{ $s['authoritative'] ? 'açık' : 'kapalı' }}</b></span>
            </div>

            {{-- SORUNLAR (yalnız kırmızılar): detay burada, hover gerektirmez --}}
            @if ($down->isNotEmpty())
                <div class="rounded-md border border-red-200 bg-red-50 px-2 py-1 dark:border-red-900/50 dark:bg-red-950/30">
                    @foreach ($down as $svc)
                        <div class="text-red-700 dark:text-red-300" style="font-size:14px;line-height:1.4">
                            <b>{{ $svc['name'] }}</b>@if(!empty($svc['detail'])) — {{ $svc['detail'] }}@endif
                            @if ($svc['key'] === 'validator' && $svc['configured'] && $s['validator_required'])
                                <span class="font-semibold">· Fail-closed: hamleler REDDEDİLİR!</span>
                            @endif
                        </div>
                    @endforeach
                </div>
            @endif

            {{-- GRUPLAR: ultra-kompakt auto-fill ızgara (genişliğe göre otomatik sütun) —
                 her servis = 7px lamba + ad; durum RENKTEN okunur (✓/✕ kaldırıldı); detay hover'da. --}}
            @foreach ($groups as $gname => $items)
                <div>
                    <div class="font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500" style="font-size:12px;margin-bottom:3px">{{ $gname }}</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px">
                        @foreach ($items as $svc)
                            @php($color = $svc['up'] === true ? '#16a34a' : ($svc['up'] === false ? '#dc2626' : '#9ca3af'))
                            <div class="flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-white/5"
                                 style="padding:3px 7px;min-width:0"
                                 title="{{ $svc['name'] }}@if(!empty($svc['detail'])) — {{ $svc['detail'] }}@endif">
                                <span style="display:inline-block;width:7px;height:7px;flex:none;border-radius:9999px;background:{{ $color }}"></span>
                                <span class="truncate text-gray-700 dark:text-gray-200" style="font-size:14px">{{ $svc['name'] }}</span>
                                @if (! empty($svc['restart']))
                                    <button type="button"
                                            class="ml-auto shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                                            wire:click="restartService('{{ $svc['key'] }}')"
                                            wire:confirm="{{ $svc['name'] }} yeniden başlatılsın mı?"
                                            wire:loading.attr="disabled"
                                            title="Yeniden Başlat">
                                        <x-filament::icon icon="heroicon-m-arrow-path" class="h-3 w-3" />
                                    </button>
                                @endif
                            </div>
                        @endforeach
                    </div>
                </div>
            @endforeach
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
