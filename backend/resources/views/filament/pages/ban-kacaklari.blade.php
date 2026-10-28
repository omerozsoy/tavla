<x-filament-panels::page>
    @php
        $s = $this->stats();
        $rows = $this->suspects();
        $fmt = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('d.m.Y H:i') : '—';
    @endphp

    <div class="space-y-6">

        {{-- Bilgi notu --}}
        <div class="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-4 text-sm text-amber-700 dark:text-amber-300">
            <b>Sinyaldir, kanıt değildir.</b> Yasaklı bir hesapla aynı IP'den giren yasaksız hesaplar listelenir —
            <b>ban kaçağı (yasaklanıp yeni hesap açma)</b> şüphesi için inceleme başlangıcı. Aynı ev/ofis/okul/mobil-NAT
            IP'si masum paylaşılabilir. <b>“ban sonrası” rozetli</b> satırlar (yeni hesap, yasaktan sonra açılmış) en güçlü sinyaldir.
            Kaynak: yasaklıların kalıcı IP izi (shield_presence + shield_events + sessions).
        </div>

        {{-- Üst kartlar --}}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="rounded-xl p-4 ring-1 {{ $s['afterBan'] > 0 ? 'bg-red-500/10 ring-red-500/40' : 'bg-white dark:bg-gray-900 ring-gray-200 dark:ring-white/10' }}">
                <div class="text-xs {{ $s['afterBan'] > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500' }}">⚠ Ban sonrası açılmış</div>
                <div class="text-2xl font-bold {{ $s['afterBan'] > 0 ? 'text-red-600 dark:text-red-400' : '' }}">{{ $s['afterBan'] }}</div>
            </div>
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">Şüpheli yasaksız hesap</div>
                <div class="text-2xl font-bold">{{ $s['fresh'] }}</div>
            </div>
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">İlişkili yasaklı hesap</div>
                <div class="text-2xl font-bold">{{ $s['banned'] }}</div>
            </div>
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">Paylaşılan IP</div>
                <div class="text-2xl font-bold">{{ $s['ips'] }}</div>
            </div>
        </div>

        @if (empty($rows))
            <div class="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 p-6 text-center text-emerald-700 dark:text-emerald-300">
                Yasaklı hesaplarla aynı IP'den giren yasaksız hesap bulunamadı.
            </div>
        @else
            <div class="space-y-4">
                @foreach ($rows as $row)
                    @php $u = $row['user']; $strong = $row['anyAfterBan']; @endphp
                    <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 overflow-hidden {{ $strong ? 'ring-red-500/50' : 'ring-gray-200 dark:ring-white/10' }}">
                        {{-- Yasaksız (yeni) hesap başlığı --}}
                        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/10 {{ $strong ? 'bg-red-500/10' : 'bg-gray-50 dark:bg-white/5' }}">
                            <div class="flex items-center gap-2 flex-wrap min-w-0">
                                <x-filament::icon icon="heroicon-m-user" class="h-5 w-5 text-gray-400 shrink-0" />
                                <span class="font-semibold truncate">{{ $u['name'] }}</span>
                                <span class="text-xs text-gray-400">#{{ $u['id'] }}</span>
                                @if ($u['rating'])
                                    <span class="text-xs text-gray-400">· {{ $u['rating'] }}</span>
                                @endif
                                @if ($strong)
                                    <span class="inline-flex items-center rounded-full bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs font-bold">⚠ ban sonrası açılmış</span>
                                @endif
                                <span class="text-xs text-gray-500">· kayıt: {{ $fmt($u['created_at']) }}</span>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                @if ($u['url'])
                                    <a href="{{ $u['url'] }}" class="text-primary-600 dark:text-primary-400 text-xs font-medium hover:underline">İncele</a>
                                @endif
                                <x-filament::button size="xs" color="danger" wire:click="block({{ $u['id'] }})"
                                    wire:confirm="{{ $u['name'] }} hesabını ban kaçağı olarak engellemek istiyor musun?">Engelle</x-filament::button>
                            </div>
                        </div>

                        {{-- Email --}}
                        <div class="px-4 pt-2 text-xs text-gray-500 truncate">{{ $u['email'] ?: '—' }}</div>

                        {{-- Yasaklı bağlantılar --}}
                        <div class="divide-y divide-gray-100 dark:divide-white/5">
                            @foreach ($row['links'] as $l)
                                <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                                    <div class="min-w-0 space-y-0.5">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="text-gray-400 text-xs">yasaklı ile ortak:</span>
                                            <span class="font-medium truncate">{{ $l['bannedName'] }}</span>
                                            <span class="text-xs text-gray-400">#{{ $l['bannedId'] }}</span>
                                            <span class="inline-flex items-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-0.5 text-[11px] font-medium">yasaklı</span>
                                            @if ($l['afterBan'])
                                                <span class="inline-flex items-center rounded-full bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 text-[11px] font-bold">ban sonrası</span>
                                            @endif
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            yasak: {{ $fmt($l['bannedAt']) }}
                                            @if ($l['bannedReason']) · sebep: {{ $l['bannedReason'] }} @endif
                                        </div>
                                        <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                                            @foreach ($l['ips'] as $ip)
                                                <span class="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 font-mono text-[11px]">
                                                    {{ $ip }}
                                                    <button wire:click="banIp('{{ $ip }}')"
                                                        wire:confirm="{{ $ip }} IP'sini yasakla? Bu IP'den giren TÜM hesaplar (varsa masum ortak kullanıcılar dahil) siteye erişemez."
                                                        class="text-red-500 hover:text-red-700" title="IP'yi yasakla">✕</button>
                                                </span>
                                            @endforeach
                                        </div>
                                    </div>
                                    <div class="shrink-0">
                                        @if ($l['bannedUrl'])
                                            <a href="{{ $l['bannedUrl'] }}" class="text-primary-600 dark:text-primary-400 text-xs font-medium hover:underline">Yasaklıyı gör</a>
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
