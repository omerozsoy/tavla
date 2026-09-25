<x-filament-panels::page>
    @php
        $s = $this->stats();
        $rows = $this->liveRows();
        $events = $this->events();

        $riskBadge = function (int $risk) {
            $t = $this->riskTier($risk);
            return $t === 2
                ? 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30'
                : ($t === 1
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'
                    : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 ring-1 ring-gray-500/20');
        };
        $sevBadge = fn (int $sev) => $sev >= 3
            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
            : ($sev === 2 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-gray-500/10 text-gray-500 dark:text-gray-400');
    @endphp

    <div wire:poll.15s class="space-y-6">

        @unless ($this->ready())
            <div class="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-4 text-amber-700 dark:text-amber-300">
                Güvenlik Kalkanı tabloları henüz yok. Sunucuda <code>php artisan migrate</code> çalıştırın.
            </div>
        @endunless

        {{-- Üst kartlar --}}
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            @foreach ([
                ['Çevrimiçi (90sn)', $s['online'], 'text-emerald-600 dark:text-emerald-400'],
                ['Aktif (15dk)', $s['active'], 'text-sky-600 dark:text-sky-400'],
                ['İşaretli', $s['flagged'], 'text-amber-600 dark:text-amber-400'],
                ['Olay (24s)', $s['events24'], 'text-gray-700 dark:text-gray-300'],
                ['Tehlike (24s)', $s['danger24'], 'text-red-600 dark:text-red-400'],
                ['Engelli', $s['banned'], 'text-gray-700 dark:text-gray-300'],
            ] as [$label, $val, $cls])
                <div class="rounded-xl bg-white dark:bg-white/5 ring-1 ring-gray-950/5 dark:ring-white/10 p-4">
                    <div class="text-xs text-gray-500 dark:text-gray-400">{{ $label }}</div>
                    <div class="mt-1 text-2xl font-semibold {{ $cls }}">{{ $val }}</div>
                </div>
            @endforeach
        </div>

        {{-- Kontroller --}}
        <div class="flex items-center gap-3">
            <x-filament::button size="sm" :color="$onlyRisky ? 'warning' : 'gray'" wire:click="toggleRisky">
                {{ $onlyRisky ? 'Tümünü göster' : 'Sadece riskliler' }}
            </x-filament::button>
            <span class="text-xs text-gray-500 dark:text-gray-400">15 saniyede bir otomatik yenilenir.</span>
        </div>

        {{-- Canlı tablo --}}
        <div class="rounded-xl bg-white dark:bg-white/5 ring-1 ring-gray-950/5 dark:ring-white/10 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-950/5 dark:border-white/10 font-medium">
                Canlı Etkinlik <span class="text-gray-400 text-sm">({{ count($rows) }})</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5">
                        <tr>
                            <th class="text-left font-medium px-3 py-2">Kim</th>
                            <th class="text-left font-medium px-3 py-2">Hangi sayfa</th>
                            <th class="text-left font-medium px-3 py-2">Süre</th>
                            <th class="text-right font-medium px-3 py-2">İstek</th>
                            <th class="text-right font-medium px-3 py-2">Tepe/dk</th>
                            <th class="text-right font-medium px-3 py-2">Hata</th>
                            <th class="text-right font-medium px-3 py-2">Spin</th>
                            <th class="text-right font-medium px-3 py-2">Şüpheli</th>
                            <th class="text-center font-medium px-3 py-2">Risk</th>
                            <th class="text-left font-medium px-3 py-2">Son</th>
                            <th class="text-right font-medium px-3 py-2">İşlem</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-950/5 dark:divide-white/10">
                        @forelse ($rows as $r)
                            @php
                                $name = $r->user_id
                                    ? ($r->nickname ?: trim(($r->first_name ?? '').' '.($r->last_name ?? '')) ?: $r->email ?: ('#'.$r->user_id))
                                    : 'Misafir';
                            @endphp
                            <tr class="{{ $this->riskTier($r->risk) === 2 ? 'bg-red-500/5' : ($this->riskTier($r->risk) === 1 ? 'bg-amber-500/5' : '') }}">
                                <td class="px-3 py-2">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium truncate max-w-[160px]">{{ $name }}</span>
                                        @if ($r->is_admin)
                                            <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">admin</span>
                                        @endif
                                        @if ($r->banned_at)
                                            <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400">engelli</span>
                                        @endif
                                    </div>
                                    <div class="text-xs text-gray-400 font-mono">{{ $r->ip }}</div>
                                </td>
                                <td class="px-3 py-2">
                                    @php $pg = $this->pageLabel($r->last_page ?? null); @endphp
                                    <div class="font-medium">{{ $pg ?? $this->activityLabel($r->last_path) }}</div>
                                    @if (! empty($r->last_page))
                                        <div class="text-xs text-sky-600 dark:text-sky-400 font-mono truncate max-w-[240px]">/{{ ltrim($r->last_page, '/') }}</div>
                                    @endif
                                    <div class="text-[11px] text-gray-400 font-mono truncate max-w-[240px]">{{ $r->last_method }} /{{ $r->last_path }} · {{ $r->last_status }}</div>
                                </td>
                                <td class="px-3 py-2 whitespace-nowrap">{{ $this->human($r->session_started_at) }}</td>
                                <td class="px-3 py-2 text-right tabular-nums">{{ number_format($r->req_count) }}</td>
                                <td class="px-3 py-2 text-right tabular-nums {{ $r->rate_max >= 240 ? 'text-red-600 dark:text-red-400 font-semibold' : ($r->rate_max >= 120 ? 'text-amber-600 dark:text-amber-400' : '') }}">{{ $r->rate_max }}</td>
                                <td class="px-3 py-2 text-right tabular-nums {{ $r->err_count >= 15 ? 'text-amber-600 dark:text-amber-400' : '' }}">{{ $r->err_count }}</td>
                                <td class="px-3 py-2 text-right tabular-nums {{ $r->spin_count >= 60 ? 'text-amber-600 dark:text-amber-400' : '' }}">{{ $r->spin_count }}</td>
                                <td class="px-3 py-2 text-right tabular-nums {{ $r->susp_count > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400' }}">{{ $r->susp_count }}</td>
                                <td class="px-3 py-2 text-center">
                                    <span class="inline-block min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-semibold {{ $riskBadge($r->risk) }}">{{ $r->risk }}</span>
                                </td>
                                <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{{ $this->human($r->last_seen_at) }} önce</td>
                                <td class="px-3 py-2 text-right whitespace-nowrap">
                                    @if ($r->user_id && ! $r->is_admin)
                                        @if ($r->banned_at)
                                            <x-filament::button size="xs" color="gray" wire:click="unblock({{ $r->user_id }})">Engeli kaldır</x-filament::button>
                                        @else
                                            <x-filament::button size="xs" color="danger" wire:click="block({{ $r->user_id }})" wire:confirm="Bu kullanıcı engellensin mi? (girişi ve maç akışı durur)">Engelle</x-filament::button>
                                        @endif
                                    @else
                                        <span class="text-xs text-gray-300 dark:text-gray-600">—</span>
                                    @endif
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="11" class="px-3 py-8 text-center text-gray-400">Aktif kullanıcı yok.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        {{-- Güvenlik olayları --}}
        <div class="rounded-xl bg-white dark:bg-white/5 ring-1 ring-gray-950/5 dark:ring-white/10 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-950/5 dark:border-white/10 font-medium flex items-center justify-between gap-3">
                <span>
                    Güvenlik Olayları <span class="text-gray-400 text-sm">(son {{ count($events) }})</span>
                    @if ($onlyImportant)
                        <span class="ml-1 text-xs text-gray-400">— yalnızca önemli</span>
                    @endif
                </span>
                <x-filament::button size="xs" :color="$onlyImportant ? 'gray' : 'warning'" wire:click="toggleImportant">
                    {{ $onlyImportant ? 'Tümünü göster' : 'Sadece önemli' }}
                </x-filament::button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5">
                        <tr>
                            <th class="text-left font-medium px-3 py-2">Zaman</th>
                            <th class="text-left font-medium px-3 py-2">Tür</th>
                            <th class="text-left font-medium px-3 py-2">Kim</th>
                            <th class="text-left font-medium px-3 py-2">İstek</th>
                            <th class="text-left font-medium px-3 py-2">Açıklama</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-950/5 dark:divide-white/10">
                        @forelse ($events as $e)
                            @php
                                $who = $e->user_id ? ($e->nickname ?: $e->first_name ?: $e->email ?: ('#'.$e->user_id)) : ('IP '.$e->ip);
                            @endphp
                            <tr>
                                <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{{ \Illuminate\Support\Carbon::parse($e->created_at)->diffForHumans() }}</td>
                                <td class="px-3 py-2">
                                    <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium {{ $sevBadge($e->severity) }}">{{ $this->eventLabel($e->type) }}</span>
                                </td>
                                <td class="px-3 py-2 truncate max-w-[160px]">{{ $who }}</td>
                                <td class="px-3 py-2 text-xs text-gray-500 font-mono truncate max-w-[260px]">{{ $e->method }} /{{ $e->path }} · {{ $e->status }}</td>
                                <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{{ $e->detail }}</td>
                            </tr>
                        @empty
                            <tr><td colspan="5" class="px-3 py-8 text-center text-gray-400">Henüz güvenlik olayı yok.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

    </div>
</x-filament-panels::page>
