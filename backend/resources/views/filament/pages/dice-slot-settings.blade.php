<x-filament-panels::page>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {{-- Sol: ayar formu --}}
        <div class="lg:col-span-2">
            <form wire:submit="save" class="space-y-6">
                {{ $this->form }}
                <div class="flex justify-end">
                    <x-filament::button type="submit" icon="heroicon-m-check">
                        Kaydet
                    </x-filament::button>
                </div>
            </form>
        </div>

        {{-- Sağ: jackpot + olasılıklar + son kazançlar --}}
        <div class="space-y-6">
            <x-filament::section>
                <x-slot name="heading">Jackpot</x-slot>
                <x-slot name="description">Güncel artan havuz (64 – 64 – 64)</x-slot>

                <div class="text-center py-2">
                    <div class="text-3xl font-bold" style="color:#c9563f">{{ number_format($jackpotPool, 0, ',', '.') }}</div>
                    <div class="text-sm text-gray-500">coin</div>
                </div>
                <ul class="mt-2 space-y-1 text-sm">
                    <li class="flex items-center justify-between">
                        <span class="text-gray-500">Taban</span>
                        <span>{{ number_format($jackpotBase, 0, ',', '.') }} coin</span>
                    </li>
                    @if ($lastWinner)
                        <li class="flex items-center justify-between">
                            <span class="text-gray-500">Son kazanan</span>
                            <span>{{ $lastWinner }} (+{{ number_format($lastWonAmount, 0, ',', '.') }})</span>
                        </li>
                    @endif
                </ul>
            </x-filament::section>

            <x-filament::section>
                <x-slot name="heading">Gerçek Olasılıklar</x-slot>
                <x-slot name="description">Güncel ağırlıklara göre (kaydedince güncellenir)</x-slot>

                <ul class="space-y-1 text-sm">
                    <li class="flex items-center justify-between">
                        <span class="text-gray-500">Sıralama (kent)</span>
                        <span>{{ $odds['straight'] }}</span>
                    </li>
                    <li class="flex items-center justify-between">
                        <span class="text-gray-500">Herhangi üçlü zar</span>
                        <span>{{ $odds['anyTriple'] }}</span>
                    </li>
                    <li class="flex items-center justify-between">
                        <span class="text-gray-500">Belirli üçlü (ör. 6-6-6)</span>
                        <span>{{ $odds['triple6'] }}</span>
                    </li>
                    <li class="flex items-center justify-between">
                        <span class="text-gray-500">Jackpot (64-64-64)</span>
                        <span>{{ $odds['jackpot'] }}</span>
                    </li>
                    <li class="flex items-center justify-between">
                        <span class="text-gray-500">Tek makarada 64 küpü</span>
                        <span>%{{ $odds['cubePct'] }}</span>
                    </li>
                </ul>
            </x-filament::section>

            <x-filament::section>
                <x-slot name="heading">Son Kazançlar</x-slot>

                @if (empty($recent))
                    <p class="text-sm text-gray-500">Henüz kazanç yok.</p>
                @else
                    <ul class="space-y-1 text-sm">
                        @foreach ($recent as $r)
                            <li class="flex items-center justify-between gap-2">
                                <span class="flex items-center gap-2">
                                    @if ($r['jackpot'])
                                        <span title="Jackpot">🏆</span>
                                    @endif
                                    <span class="text-gray-500">{{ $r['user'] }}</span>
                                    <span class="font-mono">{{ $r['reels'] }}</span>
                                </span>
                                <span>+{{ number_format($r['payout'], 0, ',', '.') }}</span>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </x-filament::section>
        </div>
    </div>
</x-filament-panels::page>
