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
