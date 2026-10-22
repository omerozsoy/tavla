<x-filament-panels::page>
    @php
        $s = $this->stats();
        $rows = $this->sharedIps();
        $fmt = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('d.m.Y H:i') : '—';
        $suspect = collect($rows)->filter(fn ($r) => ($r['inter']['count'] ?? 0) > 0)->count();
    @endphp

    <div wire:poll.60s class="space-y-6">

        {{-- Bilgi notu: sinyal, kanıt değil --}}
        <div class="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-4 text-sm text-amber-700 dark:text-amber-300">
            <b>Sinyaldir, kanıt değildir.</b> Aynı ev/ofis/kafe/okul ağı veya mobil operatör (NAT) IP'si doğal
            olarak birden çok kişi tarafından paylaşılır. Bu liste <b>çoklu-hesap şüphesi</b> için inceleme
            başlangıcıdır. Kaynak: son ~2 günün canlı oturum/presence verisi (shield_presence + sessions).
        </div>

        {{-- Üst kartlar --}}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">Paylaşılan IP</div>
                <div class="text-2xl font-bold">{{ $s['ips'] }}</div>
            </div>
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">İlgili hesap</div>
                <div class="text-2xl font-bold">{{ $s['accounts'] }}</div>
            </div>
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">Tek IP'de en çok hesap</div>
                <div class="text-2xl font-bold">{{ $s['maxPerIp'] }}</div>
            </div>
            <div class="rounded-xl p-4 ring-1 {{ $suspect > 0 ? 'bg-red-500/10 ring-red-500/40' : 'bg-white dark:bg-gray-900 ring-gray-200 dark:ring-white/10' }}">
                <div class="text-xs {{ $suspect > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500' }}">⚠ Hile şüphesi (kendi aralarında maç)</div>
                <div class="text-2xl font-bold {{ $suspect > 0 ? 'text-red-600 dark:text-red-400' : '' }}">{{ $suspect }}</div>
            </div>
        </div>

        @if (empty($rows))
            <div class="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 p-6 text-center text-emerald-700 dark:text-emerald-300">
                Aynı IP'den giren birden fazla hesap bulunamadı (son ~2 gün).
            </div>
        @else
            <div class="space-y-4">
                @foreach ($rows as $row)
                    @php $cheat = ($row['inter']['count'] ?? 0) > 0; @endphp
                    <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 overflow-hidden {{ $cheat ? 'ring-red-500/50' : 'ring-gray-200 dark:ring-white/10' }}">
                        {{-- IP başlığı --}}
                        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/10 {{ $cheat ? 'bg-red-500/10' : 'bg-gray-50 dark:bg-white/5' }}">
                            <div class="flex items-center gap-2 flex-wrap">
                                <x-filament::icon icon="heroicon-m-globe-alt" class="h-5 w-5 text-gray-400" />
                                <span class="font-mono font-semibold">{{ $row['ip'] }}</span>
                                <span class="inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                                    {{ $row['count'] }} hesap
                                </span>
                                @if ($cheat)
                                    <span class="inline-flex items-center gap-1 rounded-full bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs font-bold">
                                        ⚠ kendi aralarında {{ $row['inter']['count'] }} maç
                                    </span>
                                @endif
                            </div>
                            <span class="text-xs text-gray-500">son: {{ $fmt($row['last_seen']) }}</span>
                        </div>

                        {{-- HİLE: kendi aralarında maçlar (çift başına adet · stake · galibiyet dağılımı) --}}
                        @if ($cheat)
                            <div class="px-4 py-3 bg-red-500/5 border-b border-red-500/20 space-y-1.5">
                                <div class="text-xs font-semibold text-red-600 dark:text-red-400">Bu IP'deki hesaplar BİRBİRİYLE maç yapmış — danışıklı / coin transfer / boost şüphesi:</div>
                                @foreach ($row['inter']['pairs'] as $p)
                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                                        <span class="font-medium">{{ $p['aName'] }}</span>
                                        <span class="text-gray-400">↔</span>
                                        <span class="font-medium">{{ $p['bName'] }}</span>
                                        <span class="text-xs text-gray-500">— <b>{{ $p['n'] }}</b> maç</span>
                                        <span class="text-xs text-gray-500">· galibiyet {{ $p['awins'] }}-{{ $p['bwins'] }}</span>
                                        @if (($p['stake'] ?? 0) > 0)
                                            <span class="text-xs text-amber-600 dark:text-amber-400">· toplam {{ number_format($p['stake']) }} coin bahis</span>
                                        @endif
                                    </div>
                                @endforeach
                            </div>
                        @endif

                        {{-- Hesap listesi --}}
                        <div class="divide-y divide-gray-100 dark:divide-white/5">
                            @foreach ($row['users'] as $u)
                                <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium truncate">{{ $u['name'] }}</span>
                                            <span class="text-xs text-gray-400">#{{ $u['id'] }}</span>
                                            @if ($u['rating'])
                                                <span class="text-xs text-gray-400">· {{ $u['rating'] }}</span>
                                            @endif
                                            @if ($u['banned'])
                                                <span class="inline-flex items-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-0.5 text-[11px] font-medium">engelli</span>
                                            @endif
                                        </div>
                                        <div class="text-xs text-gray-500 truncate">
                                            {{ $u['email'] ?: '—' }}
                                            · kayıt: {{ $fmt($u['created_at']) }}
                                            · görülme: {{ $fmt($u['last_seen']) }}
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        @if ($u['url'])
                                            <a href="{{ $u['url'] }}" class="text-primary-600 dark:text-primary-400 text-xs font-medium hover:underline">İncele</a>
                                        @endif
                                        @if ($u['banned'])
                                            <x-filament::button size="xs" color="gray" wire:click="unblock({{ $u['id'] }})">Engeli kaldır</x-filament::button>
                                        @else
                                            <x-filament::button size="xs" color="danger" wire:click="block({{ $u['id'] }})"
                                                wire:confirm="{{ $u['name'] }} hesabını engellemek istiyor musun?">Engelle</x-filament::button>
                                        @endif
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endforeach
            </div>
        @endif
    </div>
</x-filament-panels::page>
