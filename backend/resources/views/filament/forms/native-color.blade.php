<x-dynamic-component :component="$getFieldWrapperView()" :field="$field">
    <div
        x-data="{
            state: @js((string) ($getState() ?? '')),
            norm(v) { return /^#[0-9a-fA-F]{6}$/.test(v) ? v : null },
            push(v) { const n = this.norm(v); if (n) $wire.set(@js($getStatePath()), n) },
        }"
        class="flex items-center gap-2"
    >
        {{-- Native renk seçici: tam spektrum + (Chrome/Edge) ekrandan damlalık. --}}
        <input
            type="color"
            :value="norm(state) ?? '#cccccc'"
            @input="state = $event.target.value"
            @change="push(state)"
            @if ($isDisabled()) disabled @endif
            class="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-gray-300 bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:bg-white/5"
        />
        {{-- Hassas giriş: hex yaz / yapıştır. --}}
        <input
            type="text"
            x-model="state"
            maxlength="7"
            placeholder="#RRGGBB"
            spellcheck="false"
            @input="push(state)"
            @if ($isDisabled()) disabled @endif
            class="block w-28 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm uppercase text-gray-950 shadow-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:bg-white/5 dark:text-white"
        />
    </div>
</x-dynamic-component>
