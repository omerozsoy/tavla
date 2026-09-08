@php
    /** @var \App\Models\GameLog $record */
    $record = $getRecord();
    $rows = $record->relatedResults();
    $fmt = fn ($v, $d = 2) => $v === null ? '—' : number_format((float) $v, $d);
    $mwc = fn ($v) => $v === null ? '—' : sprintf('%+.1f%%', (float) $v);
@endphp

<div class="space-y-3">
    @if ($rows->isEmpty())
        <p class="text-sm text-gray-500 dark:text-gray-400">
            @if ($record->mode === 'online')
                Bu maç için bağlı sonuç kaydı (PR / puan) bulunamadı — oyuncular henüz raporlamamış olabilir.
            @else
                PR / şans / puan analizi yalnız online (puanlı) maçlarda tutulur.
            @endif
        </p>
    @else
        <div class="overflow-x-auto rounded-xl ring-1 ring-gray-950/5 dark:ring-white/10">
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-left text-xs uppercase tracking-wide text-gray-400">
                        <th class="px-3 py-2">Oyuncu</th>
                        <th class="px-3 py-2">Sonuç</th>
                        <th class="px-3 py-2">PR</th>
                        <th class="px-3 py-2">gnubg PR</th>
                        <th class="px-3 py-2">Şans %</th>
                        <th class="px-3 py-2">Puan</th>
                        <th class="px-3 py-2">Δ</th>
                        <th class="px-3 py-2">Bahis</th>
                        <th class="px-3 py-2">Detay</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                    @foreach ($rows as $r)
                        <tr class="text-gray-700 dark:text-gray-200">
                            <td class="px-3 py-2">{{ $r->user?->nickname ?? $r->opponent_name ?? ('ID '.$r->user_id) }}</td>
                            <td class="px-3 py-2">
                                @if ($r->won)
                                    <span class="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-500/15 dark:text-green-300">Galibiyet</span>
                                @else
                                    <span class="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-300">Mağlubiyet</span>
                                @endif
                            </td>
                            <td class="px-3 py-2 font-mono">{{ $fmt($r->pr) }}</td>
                            <td class="px-3 py-2 font-mono">{{ $fmt($r->gnubg_pr ?? null) }}</td>
                            <td class="px-3 py-2 font-mono">{{ $mwc($r->luck_mwc ?? null) }}</td>
                            <td class="px-3 py-2 font-mono">{{ $r->rating_after ?? '—' }}</td>
                            <td class="px-3 py-2 font-mono">
                                @if ($r->delta !== null)
                                    <span class="{{ $r->delta > 0 ? 'text-green-600 dark:text-green-400' : ($r->delta < 0 ? 'text-red-600 dark:text-red-400' : '') }}">
                                        {{ ($r->delta > 0 ? '+' : '').(int) $r->delta }}
                                    </span>
                                @else
                                    —
                                @endif
                            </td>
                            <td class="px-3 py-2 font-mono">{{ $r->room?->stake ? number_format((int) $r->room->stake).' coin' : '—' }}</td>
                            <td class="px-3 py-2">
                                <a href="{{ \App\Filament\Resources\MatchResultResource::getUrl('view', ['record' => $r]) }}"
                                    class="text-primary-600 hover:underline dark:text-primary-400">Aç →</a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif
</div>
