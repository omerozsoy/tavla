<x-filament-panels::page>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {{-- Sol: cevap yazan oyuncular --}}
        <div class="space-y-2 lg:col-span-1">
            @php($convs = $this->conversations())
            @forelse ($convs as $c)
                <button type="button" wire:click="select({{ $c['id'] }})"
                    @class([
                        'w-full rounded-lg border p-3 text-left transition',
                        'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-500/10' => $selectedUserId === $c['id'],
                        'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800' => $selectedUserId !== $c['id'],
                    ])>
                    <div class="flex items-center justify-between gap-2">
                        <span class="truncate font-medium text-gray-950 dark:text-white">{{ $c['name'] }}</span>
                        @if ($c['unread'] > 0)
                            <span class="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-semibold text-white">
                                {{ $c['unread'] }}
                            </span>
                        @endif
                    </div>
                    <div class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{{ $c['snippet'] }}</div>
                </button>
            @empty
                <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                    Henüz oyunculardan gelen cevap yok.
                </div>
            @endforelse
        </div>

        {{-- Sağ: seçili konuşma + cevap kutusu --}}
        <div class="lg:col-span-2">
            @if ($selectedUserId)
                <div class="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700" style="height: 62vh;">
                    <div class="border-b border-gray-200 px-4 py-3 font-medium text-gray-950 dark:border-gray-700 dark:text-white">
                        {{ $this->selectedName() }}
                    </div>
                    <div class="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-950/40">
                        @foreach ($this->thread() as $m)
                            <div @class(['flex', 'justify-end' => $m['mine'], 'justify-start' => ! $m['mine']])>
                                <div @class([
                                    'max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                                    'bg-primary-600 text-white' => $m['mine'],
                                    'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100' => ! $m['mine'],
                                ])>
                                    @if ($m['image'])
                                        <img src="{{ $m['image'] }}" alt="" class="mb-1 max-h-48 rounded-lg" />
                                    @endif
                                    @if ($m['body'] !== '')
                                        <div class="whitespace-pre-wrap break-words">{{ $m['body'] }}</div>
                                    @endif
                                    <div @class(['mt-1 text-[10px] opacity-70', 'text-right' => $m['mine']])>{{ $m['at'] }}</div>
                                </div>
                            </div>
                        @endforeach
                    </div>
                    <div class="border-t border-gray-200 p-3 dark:border-gray-700">
                        <form wire:submit="sendReply" class="flex items-end gap-2">
                            <textarea wire:model="reply" rows="2" maxlength="4000"
                                placeholder="Cevabını yaz…"
                                class="flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"></textarea>
                            <x-filament::button type="submit" icon="heroicon-m-paper-airplane">
                                Gönder
                            </x-filament::button>
                        </form>
                    </div>
                </div>
            @else
                <div class="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700">
                    Okumak için soldan bir konuşma seç.
                </div>
            @endif
        </div>
    </div>
</x-filament-panels::page>
