@php
    /** @var array $w */
    $w = $getState() ?? [];
    $fmt = fn ($n) => number_format((int) $n, 0, ',', '.');
    $signed = fn ($n) => sprintf('%+s', number_format((int) $n, 0, ',', '.'));
@endphp

<div class="fi-in-entry-wrp space-y-4">
    @unless ($w['available'] ?? false)
        <p class="text-sm text-gray-500 dark:text-gray-400">
            Cüzdan defteri (wallet_transactions) bu ortamda yok. Bakiye: <b>{{ $fmt($w['coins'] ?? 0) }}</b> coin.
        </p>
    @else
        @php $recon = $w['recon']; @endphp

        {{-- ── UYUM DURUMU (izahı olmayan para) ── --}}
        @if ($recon['clean'])
            <div class="rounded-lg p-4 bg-success-50 ring-1 ring-success-600/20 dark:bg-success-400/10">
                <p class="text-sm font-semibold text-success-700 dark:text-success-400">
                    ✓ Bakiye defterle tam tutarlı — izahı olmayan para yok.
                </p>
                <p class="mt-1 text-xs text-success-700/80 dark:text-success-400/80">
                    Güncel bakiye ({{ $fmt($recon['coins']) }}) defterin son bakiyesiyle ({{ $fmt($recon['expected']) }}) birebir eşleşiyor
                    @if ($recon['baseline'] > 0)
                        · ledger öncesi başlangıç bakiyesi: {{ $fmt($recon['baseline']) }} coin
                    @endif
                    · toplam {{ $fmt($w['total_count']) }} hareket.
                </p>
            </div>
        @else
            <div class="rounded-lg p-4 bg-danger-50 ring-1 ring-danger-600/30 dark:bg-danger-400/10">
                <p class="text-sm font-bold text-danger-700 dark:text-danger-400">
                    ⚠ DİKKAT — İZAHI OLMAYAN PARA / DEFTER TUTARSIZLIĞI
                </p>
                <ul class="mt-2 space-y-1 text-xs text-danger-700 dark:text-danger-400">
                    @unless ($recon['balance_ok'])
                        <li>
                            • Güncel bakiye <b>{{ $fmt($recon['coins']) }}</b> ama defterin dediği son bakiye
                            <b>{{ $fmt($recon['expected']) }}</b> →
                            defter dışı <b>{{ $signed($recon['unexplained']) }}</b> coin
                            (deftere kayıt düşmeden, muhtemelen doğrudan veritabanından eklenmiş/çıkarılmış).
                        </li>
                    @endunless
                    @unless ($recon['internal_ok'])
                        <li>
                            • Defter zinciri kırık: başlangıç ({{ $fmt($recon['baseline']) }}) + net hareket
                            ({{ $signed($recon['ledger_net']) }}) son bakiyeye ({{ $fmt($recon['expected']) }}) denk gelmiyor →
                            bir kayıt silinmiş veya değiştirilmiş olabilir.
                        </li>
                    @endunless
                </ul>
            </div>
        @endif

        {{-- ── ÖZET KARTLARI ── --}}
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-lg p-3 ring-1 ring-gray-950/5 dark:ring-white/10">
                <p class="text-xs text-gray-500 dark:text-gray-400">Güncel bakiye</p>
                <p class="text-lg font-bold text-gray-900 dark:text-white">{{ $fmt($w['coins']) }}</p>
                @if (($w['reserved'] ?? 0) > 0)
                    <p class="text-xs text-gray-400">rezerve: {{ $fmt($w['reserved']) }}</p>
                @endif
            </div>
            <div class="rounded-lg p-3 ring-1 ring-gray-950/5 dark:ring-white/10">
                <p class="text-xs text-gray-500 dark:text-gray-400">Toplam kazanılan</p>
                <p class="text-lg font-bold text-success-600 dark:text-success-400">+{{ $fmt($w['total_credited']) }}</p>
            </div>
            <div class="rounded-lg p-3 ring-1 ring-gray-950/5 dark:ring-white/10">
                <p class="text-xs text-gray-500 dark:text-gray-400">Toplam harcanan</p>
                <p class="text-lg font-bold text-danger-600 dark:text-danger-400">−{{ $fmt($w['total_debited']) }}</p>
            </div>
            <div class="rounded-lg p-3 ring-1 ring-gray-950/5 dark:ring-white/10">
                <p class="text-xs text-gray-500 dark:text-gray-400">Ledger öncesi başlangıç</p>
                <p class="text-lg font-bold text-gray-600 dark:text-gray-300">{{ $fmt($recon['baseline']) }}</p>
            </div>
        </div>

        {{-- ── KATEGORİ DÖKÜMÜ ── --}}
        <div class="overflow-x-auto rounded-lg ring-1 ring-gray-950/5 dark:ring-white/10">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                    <tr>
                        <th class="px-3 py-2 text-left font-medium">Kaynak</th>
                        <th class="px-3 py-2 text-right font-medium">Kazanılan</th>
                        <th class="px-3 py-2 text-right font-medium">Harcanan</th>
                        <th class="px-3 py-2 text-right font-medium">Net</th>
                        <th class="px-3 py-2 text-right font-medium">Adet</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                    @foreach ($w['categories'] as $c)
                        @php $isAdmin = $c['key'] === 'admin'; @endphp
                        <tr class="{{ $isAdmin ? 'bg-danger-50/60 dark:bg-danger-400/10' : '' }} text-gray-800 dark:text-gray-200">
                            <td class="px-3 py-2 whitespace-nowrap {{ $isAdmin ? 'font-semibold text-danger-700 dark:text-danger-400' : '' }}">
                                {{ $c['icon'] }} {{ $c['label'] }}
                            </td>
                            <td class="px-3 py-2 text-right text-success-600 dark:text-success-400">{{ $c['credited'] ? '+'.$fmt($c['credited']) : '—' }}</td>
                            <td class="px-3 py-2 text-right text-danger-600 dark:text-danger-400">{{ $c['debited'] ? '−'.$fmt($c['debited']) : '—' }}</td>
                            <td class="px-3 py-2 text-right font-medium {{ $c['net'] > 0 ? 'text-success-600 dark:text-success-400' : ($c['net'] < 0 ? 'text-danger-600 dark:text-danger-400' : 'text-gray-500') }}">{{ $signed($c['net']) }}</td>
                            <td class="px-3 py-2 text-right text-gray-500">{{ $fmt($c['count']) }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot class="border-t-2 border-gray-200 dark:border-white/10 font-semibold text-gray-900 dark:text-white">
                    <tr>
                        <td class="px-3 py-2">Toplam</td>
                        <td class="px-3 py-2 text-right text-success-600 dark:text-success-400">+{{ $fmt($w['total_credited']) }}</td>
                        <td class="px-3 py-2 text-right text-danger-600 dark:text-danger-400">−{{ $fmt($w['total_debited']) }}</td>
                        <td class="px-3 py-2 text-right">{{ $signed($recon['ledger_net']) }}</td>
                        <td class="px-3 py-2 text-right text-gray-500">{{ $fmt($w['total_count']) }}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        {{-- ── ADMIN MÜDAHALELERİ ── --}}
        @if (!empty($w['admin_events']))
            <div>
                <h3 class="mb-1 text-sm font-semibold text-danger-700 dark:text-danger-400">🛠️ Admin bakiye müdahaleleri</h3>
                <div class="overflow-x-auto rounded-lg ring-1 ring-danger-600/20">
                    <table class="w-full text-sm">
                        <thead class="bg-danger-50 dark:bg-danger-400/10 text-danger-700 dark:text-danger-400">
                            <tr>
                                <th class="px-3 py-2 text-left font-medium">Tarih</th>
                                <th class="px-3 py-2 text-left font-medium">İşlem</th>
                                <th class="px-3 py-2 text-left font-medium">Yapan admin</th>
                                <th class="px-3 py-2 text-right font-medium">Değişim</th>
                                <th class="px-3 py-2 text-right font-medium">Sonraki bakiye</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-danger-100 dark:divide-danger-400/10">
                            @foreach ($w['admin_events'] as $e)
                                <tr class="text-gray-800 dark:text-gray-200">
                                    <td class="px-3 py-2 whitespace-nowrap">{{ optional($e['date'])->format('d.m.Y H:i') ?? '—' }}</td>
                                    <td class="px-3 py-2 whitespace-nowrap">{{ $e['type'] }}</td>
                                    <td class="px-3 py-2 whitespace-nowrap">
                                        @if ($e['actor'])
                                            <span class="font-medium">{{ $e['actor'] }}</span>
                                        @else
                                            <span class="text-gray-400 italic">bilinmiyor (eski kayıt)</span>
                                        @endif
                                    </td>
                                    <td class="px-3 py-2 text-right font-medium {{ $e['amount'] >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400' }}">{{ $signed($e['amount']) }}</td>
                                    <td class="px-3 py-2 text-right text-gray-500">{{ $fmt($e['balance_after']) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    "Yapan admin" yalnızca bu özellik devreye girdikten sonraki müdahaleler için doldurulur; öncekiler "bilinmiyor" görünür.
                </p>
            </div>
        @endif

        {{-- ── DB KURCALAMA DENETİMİ ── --}}
        @if (!empty($w['tamper']))
            <div>
                <h3 class="mb-1 text-sm font-bold text-danger-700 dark:text-danger-400">🚨 Doğrudan veritabanı kurcalama tespit edildi</h3>
                <div class="overflow-x-auto rounded-lg ring-1 ring-danger-600/30">
                    <table class="w-full text-sm">
                        <thead class="bg-danger-50 dark:bg-danger-400/10 text-danger-700 dark:text-danger-400">
                            <tr>
                                <th class="px-3 py-2 text-left font-medium">Tarih</th>
                                <th class="px-3 py-2 text-left font-medium">İşlem</th>
                                <th class="px-3 py-2 text-right font-medium">Eski tutar</th>
                                <th class="px-3 py-2 text-right font-medium">Yeni tutar</th>
                                <th class="px-3 py-2 text-left font-medium">DB kullanıcısı</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-danger-100 dark:divide-danger-400/10">
                            @foreach ($w['tamper'] as $t)
                                <tr class="text-gray-800 dark:text-gray-200">
                                    <td class="px-3 py-2 whitespace-nowrap">{{ $t['date'] }}</td>
                                    <td class="px-3 py-2 whitespace-nowrap font-medium text-danger-600 dark:text-danger-400">{{ $t['operation'] }}</td>
                                    <td class="px-3 py-2 text-right">{{ $t['old_amount'] !== null ? $fmt($t['old_amount']) : '—' }}</td>
                                    <td class="px-3 py-2 text-right">{{ $t['new_amount'] !== null ? $fmt($t['new_amount']) : '—' }}</td>
                                    <td class="px-3 py-2 whitespace-nowrap font-mono text-xs">{{ $t['db_actor'] ?? '—' }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Bu kayıtlar, defter satırlarının uygulama dışında (doğrudan SQL ile) değiştirildiğini/silindiğini gösterir. Normal işleyişte boş olmalıdır.
                </p>
            </div>
        @endif

        {{-- ── SON İŞLEMLER ── --}}
        <div>
            <h3 class="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Son işlemler</h3>
            <div class="overflow-x-auto rounded-lg ring-1 ring-gray-950/5 dark:ring-white/10">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                        <tr>
                            <th class="px-3 py-2 text-left font-medium">Tarih</th>
                            <th class="px-3 py-2 text-left font-medium">İşlem</th>
                            <th class="px-3 py-2 text-right font-medium">Tutar</th>
                            <th class="px-3 py-2 text-right font-medium">Bakiye</th>
                            <th class="px-3 py-2 text-left font-medium">Kaynak / Aktör</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                        @foreach ($w['recent'] as $t)
                            <tr class="text-gray-800 dark:text-gray-200">
                                <td class="px-3 py-2 whitespace-nowrap">{{ optional($t['date'])->format('d.m.Y H:i') ?? '—' }}</td>
                                <td class="px-3 py-2 whitespace-nowrap">{{ $t['type'] }}</td>
                                <td class="px-3 py-2 text-right font-medium {{ $t['amount'] >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400' }}">{{ $signed($t['amount']) }}</td>
                                <td class="px-3 py-2 text-right text-gray-500">{{ $fmt($t['balance_after']) }}</td>
                                <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-400">
                                    {{ $t['ref'] ?? '' }}@if ($t['actor']) <span class="text-danger-500">· {{ $t['actor'] }}</span>@endif
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Son {{ count($w['recent']) }} hareket gösteriliyor.</p>
        </div>
    @endunless
</div>
