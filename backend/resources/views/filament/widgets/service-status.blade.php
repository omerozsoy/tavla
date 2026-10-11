<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">Servis Durumu</x-slot>
        <x-slot name="description">Hakem (validator) · Maç türleri · gnubg havuzları (Canlı YZ · PR · Mat) · Altyapı</x-slot>

        @php($s = $this->status())
        @php
            // Grupla (servisler zaten grup sırasına göre geliyor).
            $groups = [];
            foreach ($s['services'] as $svc) {
                $groups[$svc['group'] ?? 'Diğer'][] = $svc;
            }
            // Sorunlular (kırmızı) — grid üstünde özetlenir; üstte toplam sağlık.
            $down = collect($s['services'])->filter(fn ($x) => ($x['up'] ?? null) === false);
            $total = count($s['services']);
            $okN = collect($s['services'])->filter(fn ($x) => ($x['up'] ?? null) === true)->count();
        @endphp

        <div wire:poll.30s class="space-y-3 text-[13px]">
            {{-- ÜST ÖZET: tek bakışta kaç servis ayakta + sorun sayısı --}}
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span class="inline-flex items-center gap-1.5 font-semibold">
                    <span style="display:inline-block;width:9px;height:9px;border-radius:9999px;background:{{ $down->isEmpty() ? '#16a34a' : '#dc2626' }}"></span>
                    {{ $okN }}/{{ $total }} ayakta
                </span>
                @if ($down->isNotEmpty())
                    <span class="font-semibold text-red-600 dark:text-red-400">{{ $down->count() }} sorun</span>
                @endif
                <span class="text-gray-500">PR: <b>{{ $s['gnubg_pr_mode'] === 'authoritative' ? 'OTORİTER' : ($s['gnubg_pr_mode'] === 'shadow' ? 'gölge' : 'kapalı') }}</b></span>
                <span class="text-gray-500">Otorite: <b>{{ $s['authoritative'] ? 'açık' : 'kapalı' }}</b></span>
            </div>

            {{-- SORUNLAR (yalnız kırmızılar): detay burada görünür, hover gerektirmez --}}
            @if ($down->isNotEmpty())
                <div class="rounded-lg border border-red-200 bg-red-50 p-2 dark:border-red-900/50 dark:bg-red-950/30">
                    @foreach ($down as $svc)
                        <div class="text-[12px] text-red-700 dark:text-red-300">
                            <b>{{ $svc['name'] }}</b>@if(!empty($svc['detail'])) — {{ $svc['detail'] }}@endif
                            @if ($svc['key'] === 'validator' && $svc['configured'] && $s['validator_required'])
                                <span class="font-semibold">· Fail-closed: hamleler REDDEDİLİR!</span>
                            @endif
                        </div>
                    @endforeach
                </div>
            @endif

            {{-- GRUPLAR: kompakt çip ızgarası (her servis = küçük lamba + ad + ✓/✕/—) --}}
            @foreach ($groups as $gname => $items)
                <div>
                    <div class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $gname }}</div>
                    <div class="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
                        @foreach ($items as $svc)
                            @php($color = $svc['up'] === true ? '#16a34a' : ($svc['up'] === false ? '#dc2626' : '#9ca3af'))
                            @php($sym = $svc['up'] === true ? '✓' : ($svc['up'] === false ? '✕' : '—'))
                            <div class="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50/60 px-2 py-1 dark:border-gray-800 dark:bg-white/5"
                                 title="{{ $svc['name'] }}@if(!empty($svc['detail'])) — {{ $svc['detail'] }}@endif">
                                <span style="display:inline-block;width:8px;height:8px;flex:none;border-radius:9999px;background:{{ $color }}"></span>
                                <span class="truncate font-medium text-gray-700 dark:text-gray-200">{{ $svc['name'] }}</span>
                                <span class="ml-auto shrink-0 font-bold" style="color:{{ $color }}">{{ $sym }}</span>
                                @if (! empty($svc['restart']))
                                    <button type="button"
                                            class="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                                            wire:click="restartService('{{ $svc['key'] }}')"
                                            wire:confirm="{{ $svc['name'] }} yeniden başlatılsın mı?"
                                            wire:loading.attr="disabled"
                                            title="Yeniden Başlat">
                                        <x-filament::icon icon="heroicon-m-arrow-path" class="h-3.5 w-3.5" />
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
