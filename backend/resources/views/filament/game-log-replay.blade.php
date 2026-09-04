@php
    /** @var \App\Models\GameLog $record */
    $record = $getRecord();
    $turns = $record->mergedTurns();
    $games = collect($turns)->groupBy(fn ($t) => (int) ($t['g'] ?? 1));
@endphp

<div class="space-y-6">
    @if (empty($turns))
        <p class="text-sm text-gray-500 dark:text-gray-400">Bu maç için kayıtlı hamle yok.</p>
    @else
        @foreach ($games as $g => $rows)
            <div class="overflow-hidden rounded-xl ring-1 ring-gray-950/5 dark:ring-white/10">
                <div class="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 dark:bg-white/5 dark:text-gray-200">
                    Oyun {{ $g }}
                </div>
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-left text-xs uppercase tracking-wide text-gray-400">
                            <th class="px-4 py-2 w-12">#</th>
                            <th class="px-4 py-2 w-24">Renk</th>
                            <th class="px-4 py-2 w-24">Zar</th>
                            <th class="px-4 py-2">Hamle</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                        @foreach ($rows as $r)
                            <tr class="text-gray-700 dark:text-gray-200">
                                <td class="px-4 py-1.5 text-gray-400">{{ $loop->iteration }}</td>
                                <td class="px-4 py-1.5">
                                    @if (($r['p'] ?? '') === 'W')
                                        <span class="inline-flex items-center gap-1.5">
                                            <span class="h-2.5 w-2.5 rounded-full bg-gray-200 ring-1 ring-gray-400"></span>
                                            Beyaz
                                        </span>
                                    @else
                                        <span class="inline-flex items-center gap-1.5">
                                            <span class="h-2.5 w-2.5 rounded-full bg-gray-800 ring-1 ring-gray-600"></span>
                                            Siyah
                                        </span>
                                    @endif
                                </td>
                                <td class="px-4 py-1.5 font-mono">{{ $r['d'] ?? '' }}</td>
                                <td class="px-4 py-1.5 font-mono">{{ ($r['m'] ?? '') !== '' ? $r['m'] : '—' }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endforeach
    @endif
</div>
