<x-filament-panels::page>
    @php
        $s = $this->stats();
        $rows = $this->offenders();
        $fmt = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('d.m.Y H:i') : '—';
        $unwarned = collect($rows)->filter(fn ($r) => $r['warnedAt'] === null)->count();
    @endphp

    <div class="space-y-6">

        {{-- Bilgi notu --}}
        <div class="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-4 text-sm text-amber-700 dark:text-amber-300">
            Takma adı <b>küfür/uygunsuz</b> bulunan (yasaklı liste: Site Ayarları &rsaquo; Yasaklı Takma Adlar) aktif hesaplar.
            <b>Uyarı Gönder</b> oyuncuya resmi mesaj yollar ve süre verir (varsayılan 24 saat); süre dolana kadar takma adını
            değiştirmezse hesap <b>otomatik kapatılır</b> (saatlik nöbetçi). Oyuncu düzeltirse uyarı kendiliğinden kalkar.
            <b>Şimdi Banla</b> beklemeden kapatır; <b>yanlış eşleşmede</b> “Uyarıyı iptal et” kullan.
        </div>

        {{-- Süre + toplu uyarı --}}
        <div class="flex flex-wrap items-end gap-3 rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
            <label class="text-sm">
                <span class="block text-xs text-gray-500 mb-1">Verilecek süre (saat)</span>
                <input type="number" min="1" wire:model="hours"
                    class="w-24 rounded-lg border-gray-300 dark:border-white/10 dark:bg-white/5 text-sm" />
            </label>
            <x-filament::button color="warning" wire:click="warnAll"
                wire:confirm="Uyarılmamış {{ $unwarned }} hesaba {{ $this->hours }} saatlik uyarı gönderilsin mi?"
                :disabled="$unwarned === 0">
                Uyarılmamışların tümüne uyarı gönder ({{ $unwarned }})
            </x-filament::button>
        </div>

        {{-- Elle ekleme: filtrenin yakalamadığı bir oyuncuyu uyar + takibe al --}}
        <form wire:submit="addManual" class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4 space-y-3">
            <div class="text-sm font-medium">Elle oyuncu ekle</div>
            {{ $this->form }}
            <x-filament::button type="submit" color="warning" icon="heroicon-m-user-plus">
                Ekle ve uyar ({{ $this->hours }} saat)
            </x-filament::button>
        </form>

        {{-- Üst kartlar --}}
        <div class="grid grid-cols-3 gap-4">
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">Uygunsuz takma ad</div>
                <div class="text-2xl font-bold">{{ $s['total'] }}</div>
            </div>
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">Uyarılmış</div>
                <div class="text-2xl font-bold">{{ $s['warned'] }}</div>
            </div>
            <div class="rounded-xl p-4 ring-1 {{ $s['overdue'] > 0 ? 'bg-red-500/10 ring-red-500/40' : 'bg-white dark:bg-gray-900 ring-gray-200 dark:ring-white/10' }}">
                <div class="text-xs {{ $s['overdue'] > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500' }}">Süresi dolmuş</div>
                <div class="text-2xl font-bold {{ $s['overdue'] > 0 ? 'text-red-600 dark:text-red-400' : '' }}">{{ $s['overdue'] }}</div>
            </div>
        </div>

        @if (empty($rows))
            <div class="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 p-6 text-center text-emerald-700 dark:text-emerald-300">
                Uygunsuz takma adlı aktif hesap bulunamadı.
            </div>
        @else
            <div class="space-y-3">
                @foreach ($rows as $row)
                    <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 overflow-hidden {{ $row['overdue'] ? 'ring-red-500/50' : 'ring-gray-200 dark:ring-white/10' }}">
                        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div class="flex items-center gap-2 flex-wrap min-w-0">
                                <x-filament::icon icon="heroicon-m-user" class="h-5 w-5 text-gray-400 shrink-0" />
                                <span class="font-semibold truncate">{{ $row['name'] }}</span>
                                <span class="text-xs text-gray-400">#{{ $row['id'] }}</span>
                                @if ($row['rating'])
                                    <span class="text-xs text-gray-400">· {{ $row['rating'] }}</span>
                                @endif
                                @if ($row['manual'])
                                    <span class="inline-flex items-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-[11px] font-medium">elle eklendi</span>
                                @endif
                                <span class="text-xs text-gray-500 truncate">· {{ $row['email'] ?: '—' }}</span>

                                @if ($row['warnedAt'])
                                    @if ($row['overdue'])
                                        <span class="inline-flex items-center rounded-full bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs font-bold">süre doldu → {{ $fmt($row['banAt']) }}</span>
                                    @else
                                        <span class="inline-flex items-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">uyarıldı · son tarih {{ $fmt($row['banAt']) }}</span>
                                    @endif
                                @else
                                    <span class="inline-flex items-center rounded-full bg-gray-500/15 text-gray-600 dark:text-gray-300 px-2 py-0.5 text-xs">uyarılmadı</span>
                                @endif
                            </div>

                            <div class="flex items-center gap-2 shrink-0">
                                @if ($row['url'])
                                    <a href="{{ $row['url'] }}" class="text-primary-600 dark:text-primary-400 text-xs font-medium hover:underline">İncele</a>
                                @endif
                                <x-filament::button size="xs" color="warning" wire:click="warn({{ $row['id'] }})"
                                    wire:confirm="{{ $row['name'] }} oyuncusuna {{ $this->hours }} saatlik uyarı gönderilsin mi?">
                                    {{ $row['warnedAt'] ? 'Yeniden uyar' : 'Uyarı Gönder' }}
                                </x-filament::button>
                                <x-filament::button size="xs" color="danger" wire:click="banNow({{ $row['id'] }})"
                                    wire:confirm="{{ $row['name'] }} hesabı şimdi kapatılsın mı?">
                                    Şimdi Banla
                                </x-filament::button>
                                @if ($row['warnedAt'])
                                    <x-filament::button size="xs" color="gray" wire:click="clearWarning({{ $row['id'] }})"
                                        wire:confirm="Uyarıyı iptal et? (yanlış eşleşme — hesaba dokunulmaz)">
                                        Uyarıyı iptal et
                                    </x-filament::button>
                                @endif
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        @endif
    </div>
</x-filament-panels::page>
