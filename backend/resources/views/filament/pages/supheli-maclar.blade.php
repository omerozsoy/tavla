<x-filament-panels::page>
    @php
        $s = $this->stats();
        $rows = $this->suspects();
        $fmt = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('d.m.Y H:i') : '—';
    @endphp

    <div wire:poll.120s class="space-y-6">

        {{-- Bilgi notu: sinyal, kanıt değil + mutlak/bimodal izahı --}}
        <div class="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-4 text-sm text-amber-700 dark:text-amber-300 space-y-3">
            <div>
                <b>Sinyaldir, kanıt değildir.</b> Liste, maç PR geçmişinde <b>motor-yardımı (engine-assist)</b>
                imzası taşıyan hesapları gösterir. <b>PR</b> = hamle başına ortalama hata (düşük = iyi; XG dünya
                eliti uzun örneklemde ~2.5-4.5). Kesin kanıt için maçın <b>hamle-hamle motor eşleşmesine</b> bakılmalı.
                Her hesabın altında iki tür şüpheli maç <b>ayrı</b> listelenir:
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
                <div class="rounded-lg bg-red-500/10 ring-1 ring-red-500/30 p-3 text-red-700 dark:text-red-300">
                    <div class="font-bold mb-1">🔴 Mutlak</div>
                    <div class="text-xs leading-relaxed">
                        Maç, <b>herkese göre</b> motor-seviyesi: uzun örneklemde
                        (≥{{ \App\Support\CheatScan::MIN_DECISIONS }} karar) PR &lt; {{ \App\Support\CheatScan::PR_ABSOLUTE }}.
                        60+ kararda yeterince zor seçim çıkar; insanın gerçek seviyesi ortaya çıkar — bu eşiğin altı
                        insani değil. Oyuncunun geçmişine bakmaz, <b>tek başına</b> o maç fazla kusursuz.
                    </div>
                </div>
                <div class="rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30 p-3">
                    <div class="font-bold mb-1">🟠 Bimodal (iki-tepeli)</div>
                    <div class="text-xs leading-relaxed">
                        Maç, <b>bu oyuncuya göre</b> fazla iyi: oyuncunun kendi medyanının çok altında
                        (&lt; medyan × {{ \App\Support\CheatScan::BIMODAL_RATIO }}). Tutarlı insan kendi seviyesi
                        etrafında kümelenir; biri bazı maçta 7, bazı maçta 0.8 oynuyorsa “iki ayrı oyuncu” gibidir =
                        <b>bazı maçta motor açık, bazısında kapalı</b>. Mutlak'ın kaçırdığı, medyanı iyi olan hesabı yakalar.
                    </div>
                </div>
            </div>
        </div>

        {{-- Üst kartlar --}}
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div class="rounded-xl p-4 ring-1 {{ $s['suspects'] > 0 ? 'bg-red-500/10 ring-red-500/40' : 'bg-white dark:bg-gray-900 ring-gray-200 dark:ring-white/10' }}">
                <div class="text-xs {{ $s['suspects'] > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500' }}">Şüpheli hesap</div>
                <div class="text-2xl font-bold {{ $s['suspects'] > 0 ? 'text-red-600 dark:text-red-400' : '' }}">{{ $s['suspects'] }}</div>
            </div>
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">Toplam şüpheli maç</div>
                <div class="text-2xl font-bold">{{ $s['flags'] }}</div>
            </div>
            <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-white/10 p-4">
                <div class="text-xs text-gray-500">En düşük (en kötü) PR</div>
                <div class="text-2xl font-bold">{{ $s['worst'] }}</div>
            </div>
        </div>

        @if (empty($rows))
            <div class="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 p-6 text-center text-emerald-700 dark:text-emerald-300">
                Motor-yardımı imzası taşıyan maç bulunamadı.
            </div>
        @else
            <div class="space-y-4">
                @foreach ($rows as $row)
                    <div class="rounded-xl bg-white dark:bg-gray-900 ring-1 ring-red-500/50 overflow-hidden">
                        {{-- Hesap başlığı --}}
                        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-red-500/10">
                            <div class="flex items-center gap-2 flex-wrap">
                                <x-filament::icon icon="heroicon-m-cpu-chip" class="h-5 w-5 text-red-400" />
                                <span class="font-semibold">{{ $row['nickname'] }}</span>
                                <span class="text-xs text-gray-400">#{{ $row['user_id'] }}</span>
                                @if ($row['rating'])
                                    <span class="text-xs text-gray-400">· rating {{ $row['rating'] }}</span>
                                @endif
                                <span class="inline-flex items-center rounded-full bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs font-bold">
                                    {{ $row['flags'] }} şüpheli maç
                                </span>
                                <span class="inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                                    medyan PR {{ $row['median'] }} · en kötü {{ $row['worst_pr'] }}
                                </span>
                                @if ($row['banned'])
                                    <span class="inline-flex items-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-0.5 text-[11px] font-medium">engelli</span>
                                @endif
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                @if ($row['url'])
                                    <a href="{{ $row['url'] }}" class="text-primary-600 dark:text-primary-400 text-xs font-medium hover:underline">İncele</a>
                                @endif
                                @if ($row['banned'])
                                    <x-filament::button size="xs" color="gray" wire:click="unblock({{ $row['user_id'] }})">Engeli kaldır</x-filament::button>
                                @else
                                    <x-filament::button size="xs" color="danger" icon="heroicon-m-no-symbol" wire:click="block({{ $row['user_id'] }})"
                                        wire:confirm="{{ $row['nickname'] }} hesabını motor-yardımı şüphesiyle engellemek istiyor musun?">Engelle</x-filament::button>
                                @endif
                            </div>
                        </div>

                        {{-- KULLANICI-BAZLI GRAFİK + NEDEN: PR dağılımı, dünya-şampiyonu / motor / medyan
                             referans çizgileriyle. Dinamik Tailwind rengi purge'lenir -> SVG inline hex. --}}
                        @php
                            $pf = $row['profile'];
                            $vClass = [
                                'consistent' => 'bg-red-500/20 text-red-700 dark:text-red-300',
                                'selective' => 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
                                'borderline' => 'bg-gray-500/20 text-gray-700 dark:text-gray-300',
                            ][$pf['verdict']] ?? 'bg-gray-500/20 text-gray-700';
                            $vLabel = ['consistent' => 'SÜREKLİ motor', 'selective' => 'SEÇİCİ motor', 'borderline' => 'Sınırda'][$pf['verdict']] ?? '—';
                        @endphp
                        <div class="px-4 py-3 space-y-3 border-b border-gray-200 dark:border-white/10">
                            {{-- Neden anlatısı --}}
                            <div class="flex items-start gap-2 text-sm">
                                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold shrink-0 {{ $vClass }}">{{ $vLabel }}</span>
                                <span class="text-gray-700 dark:text-gray-300">{{ $pf['reason'] }}</span>
                            </div>
                            {{-- İstatistik satırı --}}
                            <div class="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                                <span><b>{{ $pf['n'] }}</b> büyük-örneklem maç (≥{{ \App\Support\CheatScan::MIN_DECISIONS }} karar)</span>
                                <span>medyan <b>{{ $pf['median'] }}</b></span>
                                <span>ort <b>{{ $pf['mean'] }}</b></span>
                                <span>std <b>{{ $pf['std'] }}</b></span>
                                <span style="color:#ef4444">● motor&lt;{{ \App\Support\CheatScan::PR_ABSOLUTE }}: <b>{{ $pf['below_engine'] }}</b></span>
                                <span style="color:#f59e0b">🏆 şampiyon&lt;{{ \App\Support\CheatScan::PR_WORLD_CHAMPION }}: <b>{{ $pf['below_wc'] }}</b></span>
                            </div>
                            {{-- KARŞILAŞTIRMA GRAFİĞİ (en anlaşılır): oyuncunun hamle hatası (PR) referanslarla
                                 yan yana. KISA çubuk = daha iyi oyuncu. Oyuncu çubuğu şampiyon kadar kısa = insani değil. --}}
                            @php
                                $pm = (float) $pf['median'];
                                $wc = \App\Support\CheatScan::PR_WORLD_CHAMPION;
                                $cmp = [
                                    ['lbl' => '🏆 Dünya şampiyonu', 'pr' => $wc, 'c' => '#f59e0b', 'hl' => false],
                                    ['lbl' => '👤 BU OYUNCU', 'pr' => $pm, 'c' => $pm < $wc ? '#ef4444' : ($pm < 6 ? '#f59e0b' : '#10b981'), 'hl' => true],
                                    ['lbl' => '🟢 Normal iyi oyuncu', 'pr' => 9, 'c' => '#10b981', 'hl' => false],
                                    ['lbl' => '🔰 Acemi', 'pr' => 15, 'c' => '#9ca3af', 'hl' => false],
                                ];
                                $cmpMax = max(15, (int) ceil($pm));
                            @endphp
                            <div class="space-y-2">
                                <div class="text-xs text-gray-600 dark:text-gray-400">
                                    Hamle hatası (PR) karşılaştırması — <b>kısa çubuk = daha iyi oyuncu</b>.
                                    Bu oyuncunun çubuğu 🏆 dünya şampiyonu kadar kısaysa, hamleleri bir insana ait değil.
                                </div>
                                @foreach ($cmp as $b)
                                    <div class="flex items-center gap-2">
                                        <div class="w-32 sm:w-44 shrink-0 text-sm {{ $b['hl'] ? 'font-bold' : 'text-gray-600 dark:text-gray-400' }}">{{ $b['lbl'] }}</div>
                                        <div class="flex-1 bg-gray-100 dark:bg-white/5 rounded-lg h-7 overflow-hidden {{ $b['hl'] ? 'ring-2 ring-red-400 dark:ring-red-500' : '' }}">
                                            <div class="h-7 rounded-lg flex items-center px-2 text-xs font-bold text-white whitespace-nowrap"
                                                 style="width: {{ max(7, round($b['pr'] / $cmpMax * 100)) }}%; background: {{ $b['c'] }}">PR {{ $b['pr'] }}</div>
                                        </div>
                                    </div>
                                @endforeach
                                <div class="text-xs {{ $pf['below_wc'] > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500' }}">
                                    👉 Bu oyuncunun <b>{{ $pf['below_wc'] }}</b> maçı dünya şampiyonu seviyesinin altında
                                    ({{ $pf['n'] }} büyük-örneklem maçtan). İnsan 60+ kararlı maçta bunu yapamaz.
                                </div>
                            </div>
                        </div>

                        {{-- Şüpheli maçlar: MUTLAK ve BİMODAL ayrı. 'mutlak+bimodal' mutlak grubuna düşer. --}}
                        @php
                            $abs = array_values(array_filter($row['matches'], fn ($m) => $m['reason'] !== 'bimodal'));
                            $bim = array_values(array_filter($row['matches'], fn ($m) => $m['reason'] === 'bimodal'));
                            $groups = [];
                            if ($abs) $groups[] = ['title' => '🔴 Mutlak — herkese göre motor-seviyesi (≥'.\App\Support\CheatScan::MIN_DECISIONS.' kararda PR < '.\App\Support\CheatScan::PR_ABSOLUTE.')', 'rows' => $abs, 'head' => 'bg-red-500/10 text-red-700 dark:text-red-300'];
                            if ($bim) $groups[] = ['title' => '🟠 Bimodal — kendi medyanının çok altı (iki-tepeli)', 'rows' => $bim, 'head' => 'bg-amber-500/10 text-amber-700 dark:text-amber-300'];
                        @endphp
                        @foreach ($groups as $g)
                            <div class="px-4 py-1.5 text-xs font-semibold border-b border-gray-200 dark:border-white/10 {{ $g['head'] }}">
                                {{ $g['title'] }} · {{ count($g['rows']) }} maç
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead class="text-xs text-gray-500 bg-gray-50 dark:bg-white/5">
                                        <tr>
                                            <th class="text-left font-medium px-3 py-2">Oda</th>
                                            <th class="text-right font-medium px-3 py-2">PR</th>
                                            <th class="text-right font-medium px-3 py-2">Checker</th>
                                            <th class="text-right font-medium px-3 py-2">Karar</th>
                                            <th class="text-center font-medium px-3 py-2">Uzunl.</th>
                                            <th class="text-center font-medium px-3 py-2">Snç</th>
                                            <th class="text-left font-medium px-3 py-2">Rakip</th>
                                            <th class="text-right font-medium px-3 py-2">oPR</th>
                                            <th class="text-right font-medium px-3 py-2">Tarih</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                                        @foreach ($g['rows'] as $m)
                                            <tr>
                                                <td class="px-3 py-2 font-mono text-xs">{{ $m['room_code'] ?: '—' }}</td>
                                                <td class="px-3 py-2 text-right font-bold {{ $m['pr'] < 2 ? 'text-red-600 dark:text-red-400' : '' }}">{{ $m['pr'] }}</td>
                                                <td class="px-3 py-2 text-right text-gray-500">{{ $m['checker_pr'] }}</td>
                                                <td class="px-3 py-2 text-right">{{ $m['decisions'] }}+{{ $m['cube_decisions'] }}c</td>
                                                <td class="px-3 py-2 text-center">{{ $m['match_length'] ?? '—' }}p</td>
                                                <td class="px-3 py-2 text-center">{{ $m['won'] ? 'W' : 'L' }}</td>
                                                <td class="px-3 py-2 truncate max-w-[10rem]">{{ $m['opponent_name'] ?: '—' }}</td>
                                                <td class="px-3 py-2 text-right text-gray-500">{{ $m['opponent_pr'] }}</td>
                                                <td class="px-3 py-2 text-right text-xs text-gray-500">{{ $fmt($m['created_at']) }}</td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        @endforeach
                    </div>
                @endforeach
            </div>
        @endif
    </div>
</x-filament-panels::page>
