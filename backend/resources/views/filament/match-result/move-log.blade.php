@php
    /** @var \App\Models\MatchResult $record */
    $record = $getRecord();
    $rows = $record->moveDiceLog();
    $badge = fn (string $p) => $p === 'white'
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200'
        : 'bg-gray-800 text-white dark:bg-white/15 dark:text-gray-100';
@endphp

<div class="space-y-0.5 text-sm">
    @if (empty($rows))
        <p class="text-gray-500 dark:text-gray-400">Bu maç için hamle kaydı yok.</p>
    @else
        @foreach ($rows as $row)
            @if ($row['kind'] === 'game')
                <div class="mt-3 border-t border-gray-100 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400 first:mt-0 first:border-t-0 first:pt-0 dark:border-white/10">
                    {{ $row['no'] }}. Oyun
                </div>
            @elseif ($row['kind'] === 'move')
                <div class="flex items-center gap-2 py-0.5">
                    <span class="w-6 shrink-0 text-right text-xs text-gray-400">{{ $row['no'] }}.</span>
                    <span class="inline-flex w-28 shrink-0 items-center truncate rounded-md px-1.5 py-0.5 text-xs font-bold {{ $badge($row['player']) }}">
                        {{ $row['name'] }}
                    </span>
                    <span class="inline-flex min-w-[3rem] shrink-0 justify-center rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-bold tabular-nums text-indigo-900 dark:bg-indigo-400/20 dark:text-indigo-200">
                        🎲 {{ $row['dice'] !== '' ? $row['dice'] : '—' }}
                    </span>
                    <span class="{{ $row['noMove'] ? 'italic text-gray-400' : 'font-mono text-gray-800 dark:text-gray-100' }}">
                        {{ $row['notation'] }}
                    </span>
                </div>
            @elseif ($row['kind'] === 'cube')
                <div class="flex items-center gap-2 py-0.5">
                    <span class="w-6 shrink-0"></span>
                    <span class="inline-flex w-28 shrink-0 items-center truncate rounded-md px-1.5 py-0.5 text-xs font-bold {{ $badge($row['player']) }}">
                        {{ $row['name'] }}
                    </span>
                    <span class="text-xs font-semibold text-rose-600 dark:text-rose-300">⚅ {{ $row['action'] }}</span>
                </div>
            @elseif ($row['kind'] === 'end')
                <div class="py-1 pl-8 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                    🏁 {{ $row['name'] }} oyunu kazandı — {{ $row['points'] }} puan
                </div>
            @endif
        @endforeach
    @endif
</div>
