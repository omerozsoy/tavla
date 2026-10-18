<x-filament-panels::page>
    <form wire:submit="send" class="space-y-6">
        {{ $this->form }}

        <div class="flex justify-end">
            <x-filament::button type="submit" icon="heroicon-m-paper-airplane">
                Gönder
            </x-filament::button>
        </div>
    </form>

    @php($history = $this->sentHistory())
    @if ($history->isNotEmpty())
        <x-filament::section class="mt-6">
            <x-slot name="heading">Geçmiş Mesajlar</x-slot>
            <x-slot name="description">Gönderilen son {{ $history->count() }} mesaj (en yeni önce).</x-slot>

            <div class="divide-y divide-gray-100 dark:divide-white/5">
                @foreach ($history as $h)
                    <div class="flex items-start gap-3 py-3">
                        @if (! empty($h->image))
                            <img src="{{ $h->image }}" alt="" class="h-10 w-10 shrink-0 rounded object-cover">
                        @endif
                        <div class="min-w-0 flex-1">
                            <div class="whitespace-pre-line break-words text-sm text-gray-900 dark:text-gray-100">{{ \Illuminate\Support\Str::limit((string) $h->body, 240) ?: '(görsel)' }}</div>
                            <div class="mt-1 text-xs text-gray-500">
                                {{ \Illuminate\Support\Carbon::parse($h->created_at)->format('d.m.Y H:i') }}
                                · {{ $h->recipients }} alıcı
                                · {{ $h->read_count }} okundu
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        </x-filament::section>
    @endif
</x-filament-panels::page>
