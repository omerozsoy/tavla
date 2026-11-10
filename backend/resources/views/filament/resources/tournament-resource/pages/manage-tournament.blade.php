@php($data = $this->stats())

<x-filament-panels::page>
    <x-filament::section>
        <x-slot name="heading">Özet</x-slot>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            @foreach ($data['summary'] as $label => $value)
                <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div class="text-xs text-gray-500 dark:text-gray-400">{{ $label }}</div>
                    <div class="mt-1 text-lg font-semibold">{{ $value }}</div>
                </div>
            @endforeach
        </div>
    </x-filament::section>

    @if ($this->showRoundList())
        <x-filament::section>
            <x-slot name="heading">Tur Saatleri & Başlatma</x-slot>
            <x-slot name="description">Her tur için başlangıç tarih/saati (GMT+3). "Başlat" sıradaki turun kurasını çeker; ileri turları şimdiden planlayabilirsin.</x-slot>

            <div class="space-y-1">
                @foreach ($this->roundRows() as $row)
                    <div class="flex flex-wrap items-center gap-3 border-b border-gray-100 py-2 dark:border-gray-800">
                        <div class="w-16 font-medium">{{ $row['round'] }}. tur</div>
                        <input
                            type="datetime-local"
                            wire:model="roundTimes.{{ $row['round'] }}"
                            @disabled($row['status'] === 'drawn')
                            class="fi-input block rounded-lg border-gray-300 text-sm shadow-sm disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800"
                        />
                        <div class="w-24 text-sm">
                            @if ($row['status'] === 'drawn')
                                <span class="text-success-600 dark:text-success-400">Çekildi</span>
                            @elseif ($row['isNext'])
                                <span class="text-primary-600 dark:text-primary-400 font-medium">Sıradaki</span>
                            @else
                                <span class="text-gray-500">Planlanıyor</span>
                            @endif
                        </div>
                        <div class="w-28">
                            @if ($row['canStart'])
                                <x-filament::button wire:click="startRound({{ $row['round'] }})" size="sm" color="success" icon="heroicon-o-play">
                                    Başlat
                                </x-filament::button>
                            @elseif ($row['isNext'])
                                <x-filament::button size="sm" color="gray" disabled
                                    :tooltip="$row['hasTime'] ? 'Önceki tur maçları bitmeli' : 'Önce saati girip kaydet'">
                                    Başlat
                                </x-filament::button>
                            @endif
                        </div>
                    </div>
                @endforeach
            </div>

            <div class="mt-4 flex gap-2">
                <x-filament::button wire:click="saveTimes" color="info" icon="heroicon-o-check">
                    Saatleri Kaydet
                </x-filament::button>
                <x-filament::button wire:click="addRound" color="gray" icon="heroicon-o-plus" outlined>
                    Tur ekle
                </x-filament::button>
            </div>
        </x-filament::section>
    @endif

    <x-filament::section>
        <x-slot name="heading">Turlar</x-slot>
        <x-slot name="description">Her turdaki oyuncu sayısı ve biten / kalan maç dökümü.</x-slot>

        @if (count($data['rounds']) === 0)
            <div class="text-sm text-gray-500 dark:text-gray-400">Henüz tur yok (turnuva başlatılmadı).</div>
        @else
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-left text-gray-500 dark:text-gray-400">
                        <th class="py-2">Tur</th>
                        <th class="py-2">Oyuncu</th>
                        <th class="py-2">Biten maç</th>
                        <th class="py-2">Kalan maç</th>
                        <th class="py-2">Bay</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($data['rounds'] as $r)
                        <tr class="border-t border-gray-100 dark:border-gray-800">
                            <td class="py-2 font-medium">{{ $r['round'] }}. tur</td>
                            <td class="py-2">{{ $r['players'] }}</td>
                            <td class="py-2 text-success-600 dark:text-success-400">{{ $r['finished'] }}</td>
                            <td class="py-2 {{ $r['remaining'] > 0 ? 'text-warning-600 dark:text-warning-400' : '' }}">{{ $r['remaining'] }}</td>
                            <td class="py-2 text-gray-500">{{ $r['byes'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </x-filament::section>
</x-filament-panels::page>
