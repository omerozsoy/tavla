@php
    $record = $getRecord();
    $path = $record?->screenshot;
    $url = $path ? \Illuminate\Support\Facades\Storage::disk('uploads')->url($path) : null;
@endphp
<div>
    @if ($url)
        <a href="{{ $url }}" target="_blank" rel="noopener">
            <img src="{{ $url }}" alt="Ekran görüntüsü"
                 style="max-width:100%;max-height:520px;border-radius:8px;border:1px solid rgba(0,0,0,.15)">
        </a>
        <p style="font-size:.75rem;color:#6b7280;margin:6px 0 0">
            Tam boyut için görsele tıklayın.
        </p>
    @else
        <p style="font-size:.85rem;color:#6b7280;margin:0">Ekran görüntüsü yok.</p>
    @endif
</div>
