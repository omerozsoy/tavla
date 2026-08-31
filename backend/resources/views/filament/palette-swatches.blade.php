@php $colors = $getState() ?? []; @endphp
<div>
    @if (empty($colors))
        <p style="font-size:.85rem;color:#6b7280;margin:0">
            Görseli yükleyip <strong>Kaydet</strong>ledikten sonra resimdeki baskın 5 renk burada çıkar;
            birine tıklayınca sol panel rengine uygulanır.
        </p>
    @else
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">
            @foreach ($colors as $c)
                <button type="button"
                    x-on:click="$wire.set('data.panel_color', @js($c))"
                    title="Sol panel rengi yap: {{ $c }}"
                    style="display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:0;cursor:pointer;padding:0">
                    <span style="width:46px;height:46px;border-radius:8px;border:1px solid rgba(0,0,0,.18);background:{{ $c }}"></span>
                    <span style="font-size:.7rem;color:#6b7280;font-family:ui-monospace,monospace">{{ $c }}</span>
                </button>
            @endforeach
        </div>
    @endif
</div>
