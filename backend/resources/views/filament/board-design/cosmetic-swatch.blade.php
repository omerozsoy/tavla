@php
    $m = is_array($getState()) ? $getState() : [];
    // Çerçeve halkası grubun rengini alır (frontend rarityColors.ts; grup değişince renk de değişir).
    $ring = ['common' => '#9da7b3', 'rare' => '#6e8db8', 'epic' => '#a17fb5', 'legendary' => '#c2a15f', 'mythic' => '#c0616b'][$getRecord()->group] ?? null;
    if (isset($m['accent']) && $ring) {
        $m['accent'] = $ring;
    }
    $ok = fn ($v) => is_string($v) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $v);
@endphp
<div class="px-3 py-2" style="display:flex;gap:4px;align-items:center">
    @if ($ok($m['accent'] ?? null))
        <span style="width:30px;height:30px;border-radius:50%;border:4px solid {{ $m['accent'] }};background:#e5e7eb;display:inline-block"></span>
    @endif
    @foreach (['dark', 'light'] as $k)
        @if ($ok($m[$k] ?? null))
            <span style="width:26px;height:26px;border-radius:50%;background:{{ $m[$k] }};box-shadow:inset 0 0 0 3px rgba(255,255,255,.35),0 0 0 1px rgba(0,0,0,.35);display:inline-block"></span>
        @endif
    @endforeach
</div>
