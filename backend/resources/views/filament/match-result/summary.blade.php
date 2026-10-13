@php
    /** @var array $d */
    $d = $getState() ?? [];
    $pr = fn ($v) => $v === null ? '—' : number_format((float) $v, 2);
    // Kart rengi: kazanan yeşil, kaybeden kırmızı. AI/berabere nötr kalır.
    $sideClass = fn (bool $win, bool $lose) => $win
        ? 'bg-success-50 ring-success-600/20 dark:bg-success-400/10'
        : ($lose ? 'bg-danger-50 ring-danger-600/20 dark:bg-danger-400/10'
                 : 'bg-gray-50 ring-gray-950/5 dark:bg-white/5 dark:ring-white/10');
@endphp

<div class="fi-in-entry-wrp space-y-4">
    {{-- ÜST ŞERİT: tür · tarih · bahis --}}
    <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span class="flex flex-wrap items-center gap-1.5">
            <span class="inline-flex items-center rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-primary-600/20 dark:bg-primary-400/10 dark:text-primary-400">{{ $d['type_label'] }}</span>
            @if ($d['stake'] > 0)
                <span class="inline-flex items-center rounded-md bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 ring-1 ring-warning-600/20 dark:bg-warning-400/10 dark:text-warning-400">{{ number_format($d['stake']) }} coin bahis</span>
            @endif
        </span>
        <span>{{ $d['date'] }}</span>
    </div>

    {{-- SKORBORD: iki oyuncu + ortada skor --}}
    <div class="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        {{-- SOL: bu satırın oyuncusu --}}
        <div class="rounded-xl p-4 ring-1 {{ $sideClass($d['self']['won'], !$d['self']['won']) }}">
            <p class="truncate text-base font-bold text-gray-900 dark:text-white">{{ $d['self']['name'] }}</p>
            <p class="mt-0.5 text-xs font-semibold {{ $d['self']['won'] ? 'text-success-700 dark:text-success-400' : 'text-danger-700 dark:text-danger-400' }}">
                {{ $d['self']['won'] ? 'GALİP' : 'MAĞLUP' }}
            </p>
            <dl class="mt-3 space-y-1.5 text-sm">
                <div class="flex justify-between gap-2">
                    <dt class="text-gray-500 dark:text-gray-400">PR</dt>
                    <dd class="font-semibold text-gray-900 dark:text-white">{{ $pr($d['self']['pr']) }}</dd>
                </div>
                {{-- Pul (checker) PR + Küp (cube) PR ayrı ayrı (gnubg). Küp kararı yoksa Küp PR gizli. --}}
                <div class="flex justify-between gap-2 pl-3 text-xs">
                    <dt class="text-gray-400 dark:text-gray-500">Pul PR</dt>
                    <dd class="font-medium text-gray-600 dark:text-gray-300">{{ $pr($d['self']['checker_pr']) }}</dd>
                </div>
                @if ($d['self']['cube_pr'] !== null)
                    <div class="flex justify-between gap-2 pl-3 text-xs">
                        <dt class="text-gray-400 dark:text-gray-500">Küp PR</dt>
                        <dd class="font-medium text-gray-600 dark:text-gray-300">{{ $pr($d['self']['cube_pr']) }}</dd>
                    </div>
                @endif
                <div class="flex justify-between gap-2">
                    <dt class="text-gray-500 dark:text-gray-400">Puan</dt>
                    <dd class="font-medium text-gray-700 dark:text-gray-200">
                        {{ $d['self']['rating_before'] ?? '—' }} → {{ $d['self']['rating_after'] ?? '—' }}
                        @if ($d['self']['delta'] != 0)
                            <span class="{{ $d['self']['delta'] > 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400' }}">
                                ({{ sprintf('%+d', $d['self']['delta']) }})
                            </span>
                        @endif
                    </dd>
                </div>
                @if ($d['self']['luck'] !== null)
                    <div class="flex justify-between gap-2">
                        <dt class="text-gray-500 dark:text-gray-400">Şans</dt>
                        <dd class="font-medium text-gray-700 dark:text-gray-200">{{ $pr($d['self']['luck']) }}</dd>
                    </div>
                @endif
            </dl>
        </div>

        {{-- ORTA: skor --}}
        <div class="flex flex-col items-center justify-center px-2">
            <div class="text-3xl font-black tabular-nums text-gray-900 dark:text-white">
                {{ $d['score'] }}
            </div>
            <div class="mt-1 text-[11px] uppercase tracking-wide text-gray-400">skor</div>
        </div>

        {{-- SAĞ: rakip (kazanan = bu satırın oyuncusu kaybettiyse) --}}
        <div class="rounded-xl p-4 ring-1 {{ $sideClass(!$d['self']['won'], $d['self']['won']) }}">
            <p class="truncate text-base font-bold text-gray-900 dark:text-white text-right">{{ $d['opp']['name'] }}</p>
            <p class="mt-0.5 text-right text-xs font-semibold {{ $d['self']['won'] ? 'text-danger-700 dark:text-danger-400' : 'text-success-700 dark:text-success-400' }}">
                {{ $d['self']['won'] ? 'MAĞLUP' : 'GALİP' }}
            </p>
            <dl class="mt-3 space-y-1.5 text-sm">
                <div class="flex justify-between gap-2">
                    <dt class="text-gray-500 dark:text-gray-400">PR</dt>
                    <dd class="font-semibold text-gray-900 dark:text-white">{{ $d['is_ai'] ? '—' : $pr($d['opp']['pr']) }}</dd>
                </div>
                <div class="flex justify-between gap-2">
                    <dt class="text-gray-500 dark:text-gray-400">Puan</dt>
                    <dd class="font-medium text-gray-700 dark:text-gray-200">{{ $d['opp']['rating'] ?? '—' }}</dd>
                </div>
            </dl>
        </div>
    </div>

    {{-- PR AÇIKLAMASI: yalnız kayıtlı (istemci) PR gnubg'den FARKLIYSA göster. --}}
    @if ($d['pr_mismatch'])
        <div class="rounded-lg bg-warning-50 p-3 text-xs ring-1 ring-warning-600/20 dark:bg-warning-400/10">
            <p class="font-semibold text-warning-700 dark:text-warning-400">PR tutarsızlığı</p>
            <p class="mt-1 text-warning-700/90 dark:text-warning-400/90">
                Gösterilen PR gnubg (TavlaTV motoru, yetkili) değeridir: <b>{{ $pr($d['self']['pr']) }}</b>.
                Eski kayıtlı istemci PR'ı farklı: <b>{{ $pr($d['self']['stored_pr']) }}</b>
                (fark {{ $pr(abs((float) $d['self']['pr'] - (float) $d['self']['stored_pr'])) }}).
                <code>tavla:gnubg-pr-backfill --rerun</code> ile düzeltilebilir.
            </p>
        </div>
    @endif

    {{-- ALT: oda + bakiye --}}
    <div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Oda: <span class="font-mono">{{ $d['room'] ?: '—' }}</span></span>
        @if ($d['coins_after'] !== null)
            <span>Maç sonrası bakiye: <b>{{ number_format($d['coins_after']) }}</b> coin</span>
        @endif
        <span>Kayıt #: {{ $d['id'] }}</span>
    </div>
</div>
