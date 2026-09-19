@php
    /** @var \Illuminate\Support\Collection $matches */
    $matches = $getState() ?? collect();
@endphp

<div class="fi-in-entry-wrp">
    @if ($matches->isEmpty())
        <p class="text-sm text-gray-500 dark:text-gray-400">Kayıtlı maç yok.</p>
    @else
        <div class="overflow-x-auto rounded-lg ring-1 ring-gray-950/5 dark:ring-white/10">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                    <tr>
                        <th class="px-3 py-2 text-left font-medium">Tarih</th>
                        <th class="px-3 py-2 text-left font-medium">Sonuç</th>
                        <th class="px-3 py-2 text-left font-medium">Oyuncu</th>
                        <th class="px-3 py-2 text-left font-medium">Rakip</th>
                        <th class="px-3 py-2 text-right font-medium">Skor</th>
                        <th class="px-3 py-2 text-right font-medium">Puan Δ</th>
                        <th class="px-3 py-2 text-right font-medium">Rating</th>
                        <th class="px-3 py-2 text-right font-medium">PR</th>
                        <th class="px-3 py-2 text-left font-medium">Tür</th>
                        <th class="px-3 py-2 text-left font-medium">Oda</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                    @foreach ($matches as $m)
                        @php
                            $delta = (int) ($m->delta ?? 0);
                            $deltaColor = $delta > 0 ? 'text-success-600 dark:text-success-400' : ($delta < 0 ? 'text-danger-600 dark:text-danger-400' : 'text-gray-500');
                        @endphp
                        <tr class="text-gray-800 dark:text-gray-200">
                            <td class="px-3 py-2 whitespace-nowrap">{{ optional($m->created_at)->format('d.m.Y H:i') ?? '—' }}</td>
                            <td class="px-3 py-2">
                                @if ($m->won)
                                    <span class="inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-success-600/20 dark:bg-success-400/10 dark:text-success-400">Galibiyet</span>
                                @else
                                    <span class="inline-flex items-center rounded-md bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700 ring-1 ring-danger-600/20 dark:bg-danger-400/10 dark:text-danger-400">Mağlubiyet</span>
                                @endif
                            </td>
                            <td class="px-3 py-2 whitespace-nowrap">
                                {{ $m->self_nickname ?: '—' }}
                                @if (!empty($m->self_full_name))
                                    <span class="block text-xs text-gray-500 dark:text-gray-400">{{ $m->self_full_name }}</span>
                                @endif
                            </td>
                            <td class="px-3 py-2 whitespace-nowrap">
                                <span>{{ $m->opponent_name ?: '—' }}</span>
                                <span class="text-gray-400">({{ $m->opponent_rating ?? '—' }})</span>
                                @if (!empty($m->opp_full_name))
                                    <span class="block text-xs text-gray-500 dark:text-gray-400">{{ $m->opp_full_name }}</span>
                                @endif
                            </td>
                            <td class="px-3 py-2 text-right whitespace-nowrap">
                                {{ $m->score_self !== null ? $m->score_self.'-'.$m->score_opp : '—' }}
                            </td>
                            <td class="px-3 py-2 text-right whitespace-nowrap {{ $deltaColor }}">{{ sprintf('%+d', $delta) }}</td>
                            <td class="px-3 py-2 text-right whitespace-nowrap text-gray-500">{{ $m->rating_after ?? '—' }}</td>
                            <td class="px-3 py-2 text-right whitespace-nowrap">{{ $m->pr !== null ? number_format((float) $m->pr, 1) : '—' }}</td>
                            <td class="px-3 py-2 whitespace-nowrap text-gray-500">{{ $m->match_type ?: 'normal' }}</td>
                            <td class="px-3 py-2 whitespace-nowrap text-gray-400 font-mono text-xs">{{ $m->room_code ?: '—' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Son {{ $matches->count() }} maç gösteriliyor.</p>
    @endif
</div>
