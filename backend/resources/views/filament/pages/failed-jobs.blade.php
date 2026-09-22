<x-filament-panels::page>
    @php $rows = $this->getFailedJobs(); @endphp

    @if (count($rows) === 0)
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-500">
            Başarısız iş yok. 🎉
        </div>
    @else
        <div class="text-sm text-gray-500 mb-3">
            Toplam <strong>{{ count($rows) }}</strong> başarısız iş (en yeni 200 gösteriliyor).
            Yukarıdaki butonlarla tümünü yeniden deneyebilir veya temizleyebilirsin.
        </div>
        <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr class="text-left">
                        <th class="py-2 px-3">#</th>
                        <th class="py-2 px-3">İş</th>
                        <th class="py-2 px-3">Hata</th>
                        <th class="py-2 px-3 whitespace-nowrap">Tarih</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($rows as $r)
                        <tr class="border-t border-gray-100 dark:border-gray-800 align-top">
                            <td class="py-2 px-3 whitespace-nowrap text-gray-500">{{ $r['id'] }}</td>
                            <td class="py-2 px-3 whitespace-nowrap font-medium">{{ $r['name'] }}</td>
                            <td class="py-2 px-3 text-red-600 dark:text-red-400">{{ $r['exception'] }}</td>
                            <td class="py-2 px-3 whitespace-nowrap text-gray-500">{{ $r['failed_at'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif
</x-filament-panels::page>
