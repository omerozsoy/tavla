<x-filament-panels::page>
    @php
        $s = $this->stats();
        $events = $this->events();
        $bans = $this->ipBans();

        // Olay türü → renk + ikon (saldırı şiddetine göre).
        $typeStyle = fn (string $type) => match ($type) {
            'brute_force'     => ['rose',   'heroicon-m-key'],
            'suspicious_path' => ['red',    'heroicon-m-bug-ant'],
            'admin_probe'     => ['orange', 'heroicon-m-lock-closed'],
            'banned_hit'      => ['amber',  'heroicon-m-no-symbol'],
            'rate_burst'      => ['violet', 'heroicon-m-bolt'],
            'error_burst'     => ['fuchsia','heroicon-m-exclamation-triangle'],
            default           => ['gray',   'heroicon-m-shield-exclamation'],
        };
        $sevRing = fn (int $sev) => $sev >= 3
            ? 'border-l-red-500'
            : ($sev === 2 ? 'border-l-amber-500' : 'border-l-gray-300 dark:border-l-gray-600');
    @endphp

    <div wire:poll.15s class="space-y-6">

        @unless ($this->ready())
            <div class="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-4 text-amber-700 dark:text-amber-300">
                Güvenlik Kalkanı tabloları henüz yok. Sunucuda <code>php artisan migrate</code> çalıştırın.
            </div>
        @endunless

        {{-- Başlık şeridi --}}
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 p-5 text-white shadow-lg">
            <div class="relative z-10 flex items-center gap-4">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                    <x-filament::icon icon="heroicon-o-shield-exclamation" class="h-7 w-7" />
                </div>
                <div>
                    <div class="text-lg font-semibold leading-tight">Saldırı İzleme</div>
                    <div class="text-sm text-white/80">Siteye kasıtlı zarar girişimleri — brute-force, tarama/exploit, yetkisiz panel. 15 sn’de bir yenilenir.</div>
                </div>
            </div>
            <x-filament::icon icon="heroicon-o-shield-check" class="pointer-events-none absolute -right-6 -bottom-8 h-40 w-40 text-white/10" />
        </div>

        {{-- Tehdit kartları --}}
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            @foreach ([
                ['Saldırı (1 saat)', $s['attacks1h'], 'heroicon-m-fire', 'rose'],
                ['Tehlike (24 saat)', $s['danger24'], 'heroicon-m-exclamation-triangle', 'red'],
                ['Yasaklı IP', $s['ipbans'], 'heroicon-m-no-symbol', 'orange'],
                ['Engelli üye', $s['bannedUsers'], 'heroicon-m-user-minus', 'gray'],
            ] as [$label, $val, $icon, $c])
                <div class="rounded-xl bg-white dark:bg-white/5 ring-1 ring-gray-950/5 dark:ring-white/10 p-4">
                    <div class="flex items-center justify-between">
                        <div class="text-xs text-gray-500 dark:text-gray-400">{{ $label }}</div>
                        <x-filament::icon :icon="$icon" @class([
                            'h-5 w-5',
                            'text-rose-500' => $c === 'rose',
                            'text-red-500' => $c === 'red',
                            'text-orange-500' => $c === 'orange',
                            'text-gray-400' => $c === 'gray',
                        ]) />
                    </div>
                    <div @class([
                        'mt-1 text-3xl font-bold tabular-nums',
                        'text-rose-600 dark:text-rose-400' => $c === 'rose' && $val > 0,
                        'text-red-600 dark:text-red-400' => $c === 'red' && $val > 0,
                        'text-orange-600 dark:text-orange-400' => $c === 'orange' && $val > 0,
                        'text-gray-700 dark:text-gray-200' => $val > 0 && $c === 'gray',
                        'text-gray-300 dark:text-gray-600' => $val === 0,
                    ])>{{ $val }}</div>
                </div>
            @endforeach
        </div>

        {{-- Aktif tehditler --}}
        <div class="rounded-2xl bg-white dark:bg-white/5 ring-1 ring-gray-950/5 dark:ring-white/10 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-950/5 dark:border-white/10 flex items-center justify-between gap-3">
                <span class="font-semibold flex items-center gap-2">
                    <x-filament::icon icon="heroicon-m-bolt" class="h-5 w-5 text-rose-500" />
                    Aktif Tehditler <span class="text-gray-400 text-sm font-normal">({{ count($events) }})</span>
                    @if ($this->onlyAttacks)
                        <span class="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">yalnızca saldırılar</span>
                    @endif
                </span>
                <x-filament::button size="xs" :color="$this->onlyAttacks ? 'gray' : 'danger'" wire:click="toggleAttacks">
                    {{ $this->onlyAttacks ? 'Tüm olayları göster' : 'Yalnızca saldırılar' }}
                </x-filament::button>
            </div>

            <div class="divide-y divide-gray-950/5 dark:divide-white/10">
                @forelse ($events as $e)
                    @php
                        [$col, $icon] = $typeStyle($e->type);
                        $who = $e->user_id
                            ? ($e->nickname ?: $e->first_name ?: $e->email ?: ('#'.$e->user_id))
                            : 'Misafir';
                    @endphp
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-l-4 {{ $sevRing($e->severity) }}">
                        {{-- Tür --}}
                        <div class="flex items-center gap-2 min-w-[150px]">
                            <span @class([
                                'flex h-8 w-8 items-center justify-center rounded-lg ring-1',
                                'bg-rose-500/10 ring-rose-500/20 text-rose-600 dark:text-rose-400' => $col === 'rose',
                                'bg-red-500/10 ring-red-500/20 text-red-600 dark:text-red-400' => $col === 'red',
                                'bg-orange-500/10 ring-orange-500/20 text-orange-600 dark:text-orange-400' => $col === 'orange',
                                'bg-amber-500/10 ring-amber-500/20 text-amber-600 dark:text-amber-400' => $col === 'amber',
                                'bg-violet-500/10 ring-violet-500/20 text-violet-600 dark:text-violet-400' => $col === 'violet',
                                'bg-fuchsia-500/10 ring-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400' => $col === 'fuchsia',
                                'bg-gray-500/10 ring-gray-500/20 text-gray-500' => $col === 'gray',
                            ])>
                                <x-filament::icon :icon="$icon" class="h-4 w-4" />
                            </span>
                            <div>
                                <div class="text-sm font-medium">{{ $this->eventLabel($e->type) }}</div>
                                <div class="text-[11px] text-gray-400">{{ \Illuminate\Support\Carbon::parse($e->created_at)->diffForHumans() }}</div>
                            </div>
                        </div>

                        {{-- Kim + IP --}}
                        <div class="min-w-[160px]">
                            <div class="flex items-center gap-1.5">
                                <span class="text-sm font-medium truncate max-w-[150px]">{{ $who }}</span>
                                @if ($e->is_admin)
                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">admin</span>
                                @elseif ($e->banned_at)
                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400">engelli</span>
                                @endif
                            </div>
                            <span class="inline-block mt-0.5 text-xs font-mono px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-600 dark:text-gray-300">{{ $e->ip ?: '—' }}</span>
                        </div>

                        {{-- İstek + açıklama --}}
                        <div class="flex-1 min-w-[180px]">
                            <div class="text-sm text-gray-700 dark:text-gray-200">{{ $e->detail }}</div>
                            <div class="text-[11px] text-gray-400 font-mono truncate">{{ $e->method }} /{{ $e->path }} · {{ $e->status }}</div>
                        </div>

                        {{-- Aksiyonlar --}}
                        <div class="flex items-center gap-2 ml-auto">
                            @if ($e->ip && ! $e->is_admin)
                                @if (in_array($e->ip, \App\Support\Shield::bannedIps(), true))
                                    <span class="text-[11px] px-2 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20">IP yasaklı</span>
                                @else
                                    <x-filament::button size="xs" color="danger" icon="heroicon-m-no-symbol"
                                        wire:click="banIp('{{ $e->ip }}', '{{ $this->eventLabel($e->type) }}')"
                                        wire:confirm="{{ $e->ip }} adresi yasaklansın mı? Bu IP’den gelen tüm istekler kesilir.">
                                        IP Engelle
                                    </x-filament::button>
                                @endif
                            @endif
                            @if ($e->user_id && ! $e->is_admin && ! $e->banned_at)
                                <x-filament::button size="xs" color="gray" icon="heroicon-m-user-minus"
                                    wire:click="block({{ $e->user_id }})"
                                    wire:confirm="Bu üye engellensin mi? (girişi ve maç akışı durur)">
                                    Üye
                                </x-filament::button>
                            @endif
                        </div>
                    </div>
                @empty
                    <div class="px-4 py-12 text-center text-gray-400">
                        <x-filament::icon icon="heroicon-o-shield-check" class="mx-auto h-10 w-10 text-emerald-500/60" />
                        <div class="mt-2">Aktif tehdit yok. Site güvende.</div>
                    </div>
                @endforelse
            </div>
        </div>

        {{-- IP yasak listesi --}}
        <div class="rounded-2xl bg-white dark:bg-white/5 ring-1 ring-gray-950/5 dark:ring-white/10 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-950/5 dark:border-white/10 flex items-center justify-between gap-3">
                <span class="font-semibold flex items-center gap-2">
                    <x-filament::icon icon="heroicon-m-no-symbol" class="h-5 w-5 text-orange-500" />
                    IP Yasak Listesi <span class="text-gray-400 text-sm font-normal">({{ count($bans) }})</span>
                </span>
            </div>

            {{-- Elle ekleme --}}
            <div class="px-4 py-3 border-b border-gray-950/5 dark:border-white/10 flex flex-wrap items-center gap-2">
                <input type="text" wire:model="newIp" placeholder="IP adresi (ör. 203.0.113.9)"
                    class="w-48 rounded-lg border-gray-300 dark:border-white/10 dark:bg-white/5 text-sm font-mono" />
                <input type="text" wire:model="newIpReason" placeholder="Neden (opsiyonel)"
                    class="flex-1 min-w-[160px] rounded-lg border-gray-300 dark:border-white/10 dark:bg-white/5 text-sm" />
                <x-filament::button size="sm" color="danger" icon="heroicon-m-plus" wire:click="banNewIp">
                    Yasakla
                </x-filament::button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5">
                        <tr>
                            <th class="text-left font-medium px-4 py-2">IP</th>
                            <th class="text-left font-medium px-4 py-2">Neden</th>
                            <th class="text-left font-medium px-4 py-2">Ekleyen</th>
                            <th class="text-left font-medium px-4 py-2">Ne zaman</th>
                            <th class="text-right font-medium px-4 py-2">İşlem</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-950/5 dark:divide-white/10">
                        @forelse ($bans as $b)
                            <tr>
                                <td class="px-4 py-2 font-mono font-medium">{{ $b->ip }}</td>
                                <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ $b->reason ?: '—' }}</td>
                                <td class="px-4 py-2 text-gray-500">{{ $b->by_nick ?: $b->by_email ?: 'sistem' }}</td>
                                <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {{ $b->created_at ? \Illuminate\Support\Carbon::parse($b->created_at)->diffForHumans() : '—' }}
                                </td>
                                <td class="px-4 py-2 text-right">
                                    <x-filament::button size="xs" color="gray" wire:click="unbanIp({{ $b->id }})"
                                        wire:confirm="{{ $b->ip }} yasağı kaldırılsın mı?">
                                        Kaldır
                                    </x-filament::button>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Yasaklı IP yok.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

    </div>
</x-filament-panels::page>
