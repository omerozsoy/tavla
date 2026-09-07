<x-filament-panels::page>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {{-- Sol: ayar formu --}}
        <div class="lg:col-span-2">
            <form wire:submit="save" class="space-y-6">
                {{ $this->form }}
                <div class="flex justify-end">
                    <x-filament::button type="submit" icon="heroicon-m-check">
                        Kaydet
                    </x-filament::button>
                </div>
            </form>
        </div>

        {{-- Sağ: çark ön izlemesi (kayıtlı aktif ödüller) --}}
        <div>
            <x-filament::section>
                <x-slot name="heading">Çark Ön İzlemesi</x-slot>
                <x-slot name="description">Şu an geçerli (aktif + tarih + stok) ödüller. Dilim sayısı: <strong>{{ $preview['count'] }}</strong></x-slot>

                @php($rewards = $preview['rewards'])
                @if ($preview['count'] < 2)
                    <p class="text-sm text-gray-500">Ön izleme için en az 2 uygun ödül gerekir.</p>
                @else
                    @php($n = count($rewards))
                    @php($cx = 150)@php($cy = 150)@php($r = 140)
                    <div class="flex flex-col items-center gap-3">
                        <svg viewBox="0 0 300 320" width="100%" style="max-width:320px">
                            {{-- Üst gösterge (pointer) --}}
                            <polygon points="150,6 140,30 160,30" fill="#111" />
                            @php($start = -90)
                            @foreach ($rewards as $i => $rw)
                                @php($a0 = deg2rad($start + $i * (360 / $n)))
                                @php($a1 = deg2rad($start + ($i + 1) * (360 / $n)))
                                @php($x1 = $cx + $r * cos($a0))@php($y1 = $cy + $r * sin($a0))
                                @php($x2 = $cx + $r * cos($a1))@php($y2 = $cy + $r * sin($a1))
                                @php($mid = deg2rad($start + ($i + 0.5) * (360 / $n)))
                                @php($lx = $cx + ($r * 0.62) * cos($mid))@php($ly = $cy + ($r * 0.62) * sin($mid))
                                @php($fill = $rw['color'])
                                <path d="M {{ $cx }} {{ $cy }} L {{ round($x1,2) }} {{ round($y1,2) }} A {{ $r }} {{ $r }} 0 0 1 {{ round($x2,2) }} {{ round($y2,2) }} Z"
                                      fill="{{ $fill }}" stroke="#ffffff" stroke-width="1.5" />
                                <text x="{{ round($lx,2) }}" y="{{ round($ly,2) }}" fill="{{ $rw['textColor'] }}"
                                      font-size="10" font-weight="600" text-anchor="middle" dominant-baseline="middle"
                                      transform="rotate({{ round($start + ($i + 0.5) * (360 / $n) + 90, 1) }} {{ round($lx,2) }} {{ round($ly,2) }})">
                                    {{ \Illuminate\Support\Str::limit($rw['name'], 14) }}
                                </text>
                            @endforeach
                            <circle cx="{{ $cx }}" cy="{{ $cy }}" r="30" fill="#111" />
                            <text x="{{ $cx }}" y="{{ $cy }}" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" dominant-baseline="middle">ÇEVİR</text>
                        </svg>

                        <ul class="w-full space-y-1 text-sm">
                            @foreach ($rewards as $rw)
                                <li class="flex items-center justify-between gap-2">
                                    <span class="flex items-center gap-2">
                                        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:{{ $rw['color'] }}"></span>
                                        {{ $rw['name'] }}
                                    </span>
                                    <span class="text-gray-400">%{{ $rw['pct'] }}</span>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif
            </x-filament::section>
        </div>
    </div>
</x-filament-panels::page>
