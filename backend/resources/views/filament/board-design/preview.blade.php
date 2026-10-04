@php
    // Tahta önizlemesi (Tavla Tasarımı): zemin, etraf (çerçeve/bar), hane 1/2, açık/koyu pul +
    // zemin dokusu (düz/degrade/keçe/ahşap) ve pul stili (düz/parlak/buz/halka/neon) — sitedeki
    // App.css [data-surface]/[data-checker] kurallarının SVG karşılığı.
    $c = is_array($colors ?? null) ? $colors : [];
    $hex = fn ($v, $d) => (is_string($v) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $v)) ? $v : $d;
    $panel = $hex($c['panel'] ?? null, '#d8c6ac');
    $frame = $hex($c['frame'] ?? null, '#2a2420');
    $a = $hex($c['a'] ?? null, '#a83a2b');
    $b = $hex($c['b'] ?? null, '#f2ead9');
    $dark = $hex($c['checker'] ?? null, '#241a12');
    $light = $hex($c['light'] ?? null, '#f7f1e6');
    $surface = in_array($surface ?? null, ['gradient', 'felt', 'wood'], true) ? $surface : 'plain';
    $style = in_array($checkerStyle ?? null, ['gloss', 'ice', 'ring', 'neon'], true) ? $checkerStyle : 'flat';
    $w = (int) ($width ?? 240);
    $u = 'bp'.substr(md5(uniqid('', true)), 0, 8); // sayfadaki her SVG için benzersiz id öneki
    $W = 260; $H = 170; $fw = 10; $bar = 14;
    $half = ($W - 2 * $fw - $bar) / 2; $pw = $half / 6; $ph = ($H - 2 * $fw) * 0.42;
    $px = function ($i) use ($fw, $half, $bar, $pw) { return $fw + ($i >= 6 ? $half + $bar : 0) + ($i % 6) * $pw; };
    $r = $pw * 0.42;
@endphp
<svg viewBox="0 0 {{ $W }} {{ $H }}" style="display:block;width:100%;max-width:{{ $w }}px;height:auto;border-radius:6px" role="img" aria-label="Tahta önizlemesi">
    <defs>
        <linearGradient id="{{ $u }}g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
            <stop offset=".46" stop-color="#fff" stop-opacity="0"/>
            <stop offset="1" stop-color="#000" stop-opacity=".18"/>
        </linearGradient>
        <pattern id="{{ $u }}f" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M0 4L4 0" stroke="#000" stroke-opacity=".09" stroke-width="1.2"/>
            <path d="M0 0L4 4" stroke="#fff" stroke-opacity=".07" stroke-width="1.2"/>
        </pattern>
        <pattern id="{{ $u }}w" width="60" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 3 Q15 1 30 3 T60 3" fill="none" stroke="#000" stroke-opacity=".13" stroke-width=".8"/>
            <path d="M0 8 Q15 10 30 8 T60 8" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width=".7"/>
            <path d="M0 12 Q20 11 40 12.5 T60 12" fill="none" stroke="#000" stroke-opacity=".08" stroke-width=".6"/>
        </pattern>
        <radialGradient id="{{ $u }}hl" cx=".38" cy=".26" r=".55">
            <stop offset="0" stop-color="#fff" stop-opacity="{{ $style === 'ice' ? '.95' : '.8' }}"/>
            <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="{{ $u }}hd" cx=".38" cy=".26" r=".55">
            <stop offset="0" stop-color="{{ $style === 'ice' ? '#d2ebff' : '#fff' }}" stop-opacity="{{ $style === 'ice' ? '.6' : '.3' }}"/>
            <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <filter id="{{ $u }}glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
    </defs>
    <rect x="0" y="0" width="{{ $W }}" height="{{ $H }}" rx="6" fill="{{ $frame }}"/>
    @if ($surface === 'wood')
        <rect x="0" y="0" width="{{ $W }}" height="{{ $H }}" rx="6" fill="url(#{{ $u }}w)"/>
    @endif
    <rect x="{{ $fw }}" y="{{ $fw }}" width="{{ $W - 2 * $fw }}" height="{{ $H - 2 * $fw }}" fill="{{ $panel }}"/>
    @if ($surface !== 'plain')
        <rect x="{{ $fw }}" y="{{ $fw }}" width="{{ $W - 2 * $fw }}" height="{{ $H - 2 * $fw }}" fill="url(#{{ $u }}{{ ['gradient' => 'g', 'felt' => 'f', 'wood' => 'w'][$surface] }})"/>
    @endif
    @for ($i = 0; $i < 12; $i++)
        @php $x = $px($i); @endphp
        <polygon points="{{ $x }},{{ $fw }} {{ $x + $pw }},{{ $fw }} {{ $x + $pw / 2 }},{{ $fw + $ph }}" fill="{{ $i % 2 ? $b : $a }}"/>
        <polygon points="{{ $x }},{{ $H - $fw }} {{ $x + $pw }},{{ $H - $fw }} {{ $x + $pw / 2 }},{{ $H - $fw - $ph }}" fill="{{ $i % 2 ? $a : $b }}"/>
    @endfor
    <rect x="{{ $fw + $half }}" y="{{ $fw }}" width="{{ $bar }}" height="{{ $H - 2 * $fw }}" fill="{{ $frame }}"/>
    @if ($surface === 'wood')
        <rect x="{{ $fw + $half }}" y="{{ $fw }}" width="{{ $bar }}" height="{{ $H - 2 * $fw }}" fill="url(#{{ $u }}w)"/>
    @endif
    @foreach ([[0, 'top', 'l', 3], [11, 'top', 'd', 2], [0, 'bot', 'd', 3], [11, 'bot', 'l', 2], [4, 'bot', 'l', 1], [7, 'top', 'd', 1]] as [$col, $side, $tone, $n])
        @php $fill = $tone === 'l' ? $light : $dark; @endphp
        @for ($k = 0; $k < $n; $k++)
            @php $cx = $px($col) + $pw / 2; $cy = $side === 'top' ? $fw + $r + 1 + $k * 2 * $r : $H - $fw - $r - 1 - $k * 2 * $r; @endphp
            @if ($style === 'ring')
                <circle cx="{{ $cx }}" cy="{{ $cy }}" r="{{ $r - 1.5 }}" fill="none" stroke="{{ $fill }}" stroke-width="3"/>
            @elseif ($style === 'neon')
                <circle cx="{{ $cx }}" cy="{{ $cy }}" r="{{ $r }}" fill="{{ $fill }}" filter="url(#{{ $u }}glow)"/>
                <circle cx="{{ $cx }}" cy="{{ $cy }}" r="{{ $r * .7 }}" fill="url(#{{ $u }}h{{ $tone }})"/>
            @else
                <circle cx="{{ $cx }}" cy="{{ $cy }}" r="{{ $r }}" fill="{{ $fill }}"
                    stroke="{{ $style === 'ice' ? 'rgba(255,255,255,.65)' : 'rgba(0,0,0,.35)' }}" stroke-width="1"/>
                @if (in_array($style, ['gloss', 'ice'], true))
                    <circle cx="{{ $cx }}" cy="{{ $cy }}" r="{{ $r }}" fill="url(#{{ $u }}h{{ $tone }})"/>
                @endif
            @endif
        @endfor
    @endforeach
</svg>
