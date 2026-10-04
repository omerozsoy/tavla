@php
    // Önizleme: sitedeki gerçek mağaza kartının görüntüsü (scripts/cosmetic-previews.mjs ->
    // public/admin-previews/<kind>-<id>.png); yoksa renk halkası/pul yedeği.
    $rec = $getRecord();
    $img = 'admin-previews/'.$rec->kind.'-'.$rec->item_id.'.png';
    $hasImg = is_file(public_path($img));
    $m = is_array($getState()) ? $getState() : [];
    $ring = ['common' => '#9da7b3', 'rare' => '#6e8db8', 'epic' => '#a17fb5', 'legendary' => '#c2a15f', 'mythic' => '#c0616b'][$rec->group] ?? null;
    if (isset($m['accent']) && $ring) {
        $m['accent'] = $ring;
    }
    $ok = fn ($v) => is_string($v) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $v);
@endphp
<div class="px-3 py-2" style="display:flex;gap:4px;align-items:center">
    @if ($hasImg)
        <img src="{{ asset($img) }}?v={{ filemtime(public_path($img)) }}" alt="{{ $rec->name }}" loading="lazy"
            style="height:{{ $rec->kind === 'frame' ? 64 : 72 }}px;width:auto;border-radius:8px;background:#f3f4f6">
    @else
        @if ($ok($m['accent'] ?? null))
            <span style="width:30px;height:30px;border-radius:50%;border:4px solid {{ $m['accent'] }};background:#e5e7eb;display:inline-block"></span>
        @endif
        @foreach (['dark', 'light'] as $k)
            @if ($ok($m[$k] ?? null))
                <span style="width:26px;height:26px;border-radius:50%;background:{{ $m[$k] }};box-shadow:inset 0 0 0 3px rgba(255,255,255,.35),0 0 0 1px rgba(0,0,0,.35);display:inline-block"></span>
            @endif
        @endforeach
    @endif
</div>
