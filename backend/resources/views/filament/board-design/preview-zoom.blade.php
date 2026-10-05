{{-- Tıklayınca büyüyen tahta önizlemesi (Tavla Tasarımı formu + listesi). Esc / tıklama ile kapanır. --}}
@php $args = ['colors' => $colors ?? [], 'surface' => $surface ?? null, 'checkerStyle' => $checkerStyle ?? null, 'imgOdd' => $imgOdd ?? null, 'imgEven' => $imgEven ?? null]; @endphp
<div x-data="{ big: false }" @keydown.escape.window="big = false">
    <button type="button" @click="big = true" title="Büyütmek için tıkla"
        style="display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in;position:relative">
        @include('filament.board-design.preview', $args + ['width' => $width ?? 640])
        @if (! empty($hint))
            <span style="position:absolute;right:8px;bottom:8px;font-size:11px;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff">🔍 Büyüt</span>
        @endif
    </button>
    <template x-teleport="body">
        <div x-show="big" x-transition.opacity @click="big = false" role="dialog" aria-modal="true" aria-label="Tahta önizlemesi (büyük)"
            style="position:fixed;inset:0;z-index:60;background:rgba(10,8,6,.82);display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out">
            <div style="width:min(1200px,96vw)" @click.stop>
                @include('filament.board-design.preview', $args + ['width' => 1200])
                <div style="margin-top:10px;text-align:center;color:#fff;font-size:13px;opacity:.8">Kapatmak için dışarı tıkla ya da Esc</div>
            </div>
        </div>
    </template>
</div>
