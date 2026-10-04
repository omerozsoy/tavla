@php
    // Mini tavla önizlemesi (Tavla Tasarımı): zemin, etraf (çerçeve/bar), hane 1/2, açık/koyu pul.
    $c = is_array($colors ?? null) ? $colors : [];
    $hex = fn ($v, $d) => (is_string($v) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $v)) ? $v : $d;
    $panel = $hex($c['panel'] ?? null, '#d8c6ac');
    $frame = $hex($c['frame'] ?? null, '#2a2420');
    $a = $hex($c['a'] ?? null, '#a83a2b');
    $b = $hex($c['b'] ?? null, '#f2ead9');
    $dark = $hex($c['checker'] ?? null, '#241a12');
    $light = $hex($c['light'] ?? null, '#f7f1e6');
    $w = (int) ($width ?? 240);
    $W = 260; $H = 170; $fw = 10; $bar = 14;
    $half = ($W - 2 * $fw - $bar) / 2; $pw = $half / 6; $ph = ($H - 2 * $fw) * 0.42;
    $px = function ($i) use ($fw, $half, $bar, $pw) { return $fw + ($i >= 6 ? $half + $bar : 0) + ($i % 6) * $pw; };
@endphp
<svg viewBox="0 0 {{ $W }} {{ $H }}" style="display:block;width:100%;max-width:{{ $w }}px;height:auto;border-radius:6px" role="img" aria-label="Tahta önizlemesi">
    <rect x="0" y="0" width="{{ $W }}" height="{{ $H }}" rx="6" fill="{{ $frame }}"/>
    <rect x="{{ $fw }}" y="{{ $fw }}" width="{{ $W - 2 * $fw }}" height="{{ $H - 2 * $fw }}" fill="{{ $panel }}"/>
    @for ($i = 0; $i < 12; $i++)
        @php $x = $px($i); @endphp
        <polygon points="{{ $x }},{{ $fw }} {{ $x + $pw }},{{ $fw }} {{ $x + $pw / 2 }},{{ $fw + $ph }}" fill="{{ $i % 2 ? $b : $a }}"/>
        <polygon points="{{ $x }},{{ $H - $fw }} {{ $x + $pw }},{{ $H - $fw }} {{ $x + $pw / 2 }},{{ $H - $fw - $ph }}" fill="{{ $i % 2 ? $a : $b }}"/>
    @endfor
    <rect x="{{ $fw + $half }}" y="{{ $fw }}" width="{{ $bar }}" height="{{ $H - 2 * $fw }}" fill="{{ $frame }}"/>
    @php $r = $pw * 0.42; @endphp
    @foreach ([[0, 'top', $light, 3], [11, 'top', $dark, 2], [0, 'bot', $dark, 3], [11, 'bot', $light, 2], [4, 'bot', $light, 1], [7, 'top', $dark, 1]] as [$col, $side, $fill, $n])
        @for ($k = 0; $k < $n; $k++)
            @php $cx = $px($col) + $pw / 2; $cy = $side === 'top' ? $fw + $r + 1 + $k * 2 * $r : $H - $fw - $r - 1 - $k * 2 * $r; @endphp
            <circle cx="{{ $cx }}" cy="{{ $cy }}" r="{{ $r }}" fill="{{ $fill }}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
        @endfor
    @endforeach
</svg>
