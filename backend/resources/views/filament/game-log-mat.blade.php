@php
    /** @var \App\Models\GameLog $record */
    $record = $getRecord();
    try {
        $mat = $record->matText();
    } catch (\Throwable $e) {
        $mat = null;
    }
@endphp

<div class="space-y-2">
    @if (empty($mat) || trim($mat) === '')
        <p class="text-sm text-gray-500 dark:text-gray-400">Bu maç için .mat üretilecek hamle yok.</p>
    @else
        <div
            x-data="{
                copied: false,
                copy() {
                    navigator.clipboard.writeText(@js($mat)).then(() => {
                        this.copied = true;
                        setTimeout(() => (this.copied = false), 1500);
                    });
                },
            }"
            class="space-y-2"
        >
            <div class="flex items-center gap-2">
                <button type="button" @click="copy()"
                    class="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20">
                    <span x-show="!copied">Kopyala</span>
                    <span x-show="copied" x-cloak>Kopyalandı ✓</span>
                </button>
                <span class="text-xs text-gray-400">tavlatv .mat — XG (Extreme Gammon) uyumlu</span>
            </div>
            <pre class="max-h-[32rem] overflow-auto rounded-xl bg-gray-950 p-4 text-xs leading-relaxed text-gray-100 ring-1 ring-white/10">{{ $mat }}</pre>
        </div>
    @endif
</div>
