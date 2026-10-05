@php
    // Tek hane büyük önizleme (yerleşim ayarı yaparken): gerçek hane oranında üçgen + resim.
    $W = 110; $H = 300;
    $fit = is_array($fit ?? null) ? $fit : [];
    $u = 'pp'.substr(md5(uniqid('', true)), 0, 8);
    $g = null;
    $a = (float) ($fit['aspect'] ?? 0);
    if ($a > 0) {
        $z = max(1, (float) ($fit['zoom'] ?? 100) / 100);
        $sc = max($W / $a, $H) * $z;
        $g = [($W - $a * $sc) * (float) ($fit['x'] ?? 50) / 100, ($H - $sc) * (float) ($fit['y'] ?? 50) / 100, $a * $sc, $sc];
    }
    $col = (is_string($color ?? null) && preg_match('/^#[0-9a-fA-F]{6}$/', $color)) ? $color : '#a83a2b';
@endphp
<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">
    <svg viewBox="0 0 {{ $W }} {{ $H }}" role="img" aria-label="Hane önizlemesi"
        style="display:block;width:100%;max-width:110px;height:auto;background:#efe9df;border-radius:8px;border:1px solid rgba(0,0,0,.12)">
        <clipPath id="{{ $u }}"><polygon points="0,0 {{ $W }},0 {{ $W / 2 }},{{ $H }}"/></clipPath>
        <polygon points="0,0 {{ $W }},0 {{ $W / 2 }},{{ $H }}" fill="{{ $col }}"/>
        @if (! empty($img))
            @if ($g)
                {{-- Kırpılan kısım soluk: resmin tamamı ve hanenin nereye denk geldiği görünür --}}
                <image href="{{ $img }}" x="{{ $g[0] }}" y="{{ $g[1] }}" width="{{ $g[2] }}" height="{{ $g[3] }}" preserveAspectRatio="none" opacity=".18"/>
                <image href="{{ $img }}" x="{{ $g[0] }}" y="{{ $g[1] }}" width="{{ $g[2] }}" height="{{ $g[3] }}" preserveAspectRatio="none" clip-path="url(#{{ $u }})"/>
            @else
                <image href="{{ $img }}" x="0" y="0" width="{{ $W }}" height="{{ $H }}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{{ $u }})"/>
            @endif
            <polygon points="0,0 {{ $W }},0 {{ $W / 2 }},{{ $H }}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.2" stroke-dasharray="4 3"/>
        @endif
    </svg>
    <div style="font-size:11.5px;color:#6b7280;line-height:1.4;max-width:220px">
        @if (! empty($img))
            Kesikli çizgi = hane; soluk kısım üçgenin dışında kalır. Karşı sıradaki haneler aynı tasarımı ters çevrilmiş kullanır.
        @else
            Önce resim yükle; sonra kaydırıcılarla yerleştir.
        @endif
    </div>
</div>
