<x-filament-panels::page>
@php
    // Foto analizi ELLE DÜZELTME editörü (Filament panel İÇİNDE, iframe/ön yüz YOK). SOLDA foto, SAĞDA
    // tıklanabilir tahta. Geometri PhotoAnalysis.tsx PositionBoard ile AYNI: W360×H240, orta bar,
    // üst 13..24 / alt 12..1 (homeLeft aynalar). points[i]: + = çeken (sen), − = rakip. mineDark = çeken koyu oynar.
    $W = 360; $H = 240; $m = 6; $barW = 20;
    $fieldW = ($W - 2 * $m - $barW) / 2;
    $pw = $fieldW / 6;
    $r = min($pw / 2 - 1.5, 12);
    $colX = fn ($c) => $c < 6 ? $m + ($c + 0.5) * $pw : $m + $fieldW + $barW + ($c - 6 + 0.5) * $pw;
    $topIdx = fn ($c) => ($homeLeft ? 24 - $c : 13 + $c) - 1;
    $botIdx = fn ($c) => ($homeLeft ? 1 + $c : 12 - $c) - 1;
    $dy = 2 * $r - 2;
    $cyTop = fn ($k) => $m + $r + $k * $dy;
    $cyBot = fn ($k) => $H - $m - $r - $k * $dy;
    $readCubeLabel = $readCube
        ? ($readCube['value'] ?? 1) . (($readCube['owner'] ?? null) ? ' (' . (($readCube['owner'] === 'white') ? 'sen' : 'rakip') . ')' : ' (orta)')
        : '—';
@endphp

<style>
    .fd { --card:#fff; --br:#e5e7eb; --ink:#111827; --muted:#6b7280; --chip:#f3f4f6; --field:#fff; --field-br:#d1d5db; --field-ink:#111827; }
    .dark .fd { --card:#1e293b; --br:#334155; --ink:#e2e8f0; --muted:#94a3b8; --chip:#334155; --field:#0f172a; --field-br:#475569; --field-ink:#e2e8f0; }
    .fd [x-cloak], [x-cloak] { display:none !important; }
    .fd { display:flex; flex-direction:column; gap:16px; user-select:none; color:var(--ink); }
    .fd-card { background:var(--card); border:1px solid var(--br); border-radius:14px; padding:14px 16px; }
    .fd-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .fd-grid { display:grid; grid-template-columns:minmax(240px,340px) 1fr; gap:16px; align-items:start; }
    @media (max-width:860px){ .fd-grid { grid-template-columns:1fr; } }
    .fd-label { font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.03em; }
    /* fırça / toggle chip'leri */
    .fd-chip { height:36px; padding:0 14px; border-radius:9px; border:1px solid var(--field-br); background:var(--field);
               color:var(--field-ink); font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:.12s; }
    .fd-chip:hover { border-color:var(--muted); }
    .fd-sw { width:14px; height:14px; border-radius:50%; display:inline-block; box-shadow:0 0 0 1px rgba(0,0,0,.4) inset; }
    .fd-chip.on { outline:2px solid #3b82f6; outline-offset:1px; border-color:#3b82f6; background:var(--chip); }
    .fd-chip.on.era { background:#64748b; color:#fff; border-color:#64748b; outline-color:#64748b; }
    .fd-chip.danger { color:#dc2626; border-color:#ef444455; }
    .fd-hint { font-size:12px; color:var(--muted); }
    /* stepper */
    .fd-step { width:30px; height:30px; border-radius:8px; border:1px solid var(--field-br); background:var(--field); color:var(--field-ink); font-size:16px; cursor:pointer; line-height:1; }
    .fd-step:hover { border-color:var(--muted); }
    .fd-num { min-width:20px; text-align:center; font-weight:700; font-variant-numeric:tabular-nums; }
    /* select */
    .fd-select { height:34px; min-width:58px; border-radius:8px; border:1px solid var(--field-br); background:var(--field);
                 color:var(--field-ink); padding:0 8px; font-size:14px; font-weight:600; cursor:pointer; }
    .fd-photo { width:100%; border-radius:12px; border:1px solid var(--br); display:block; }
    .fd-read { font-size:12px; background:var(--chip); color:var(--ink); border-radius:999px; padding:4px 11px; }
    .fd-read b { color:var(--ink); }
    .fd-board { width:100%; max-width:520px; }
    .fd-save { height:44px; padding:0 24px; border-radius:11px; border:0; background:#16a34a; color:#fff; font-size:15px;
               font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(22,163,74,.3); }
    .fd-save:hover { background:#15803d; }
    .fd-ctl-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-top:14px; }
    .fd-ctl { background:var(--card); border:1px solid var(--br); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:9px; }
</style>

<div class="fd" x-data="{
        pos: @js($this->pos),
        mineDark: @js($this->photographerDark),
        brush: 'me',
        zoom: false,
        d0: ((@js($this->pos['dice'] ?? []))[0] || 0),
        d1: ((@js($this->pos['dice'] ?? []))[1] || 0),
        mag(i) { return Math.abs(this.pos.points?.[i] || 0) },
        paint(i) {
            const cur = this.pos.points[i] || 0
            if (this.brush === 'erase') this.pos.points[i] = cur > 0 ? cur - 1 : cur < 0 ? cur + 1 : 0
            else {
                const sign = this.brush === 'me' ? 1 : -1
                if (cur === 0 || Math.sign(cur) === sign) this.pos.points[i] = Math.min(15, Math.abs(cur) + 1) * sign
                else this.pos.points[i] = sign
            }
            this.sync()
        },
        fill(i) { const n = this.pos.points?.[i] || 0; return (n > 0) !== this.mineDark ? '#f3eee1' : '#b5423a' },
        // Fırça/swatch renkleri board ile AYNI (mineDark'a göre): araç çubuğu gerçek konan rengi gösterir.
        meColor() { return this.mineDark ? '#b5423a' : '#f3eee1' },
        oppColor() { return this.mineDark ? '#f3eee1' : '#b5423a' },
        clearBoard() { this.pos.points = Array(24).fill(0); this.pos.bar = { white: 0, black: 0 }; this.sync() },
        barV(k) { return this.pos.bar?.[k] || 0 },
        bar(k, d) { if (!this.pos.bar) this.pos.bar = { white: 0, black: 0 }; this.pos.bar[k] = Math.max(0, Math.min(15, this.barV(k) + d)); this.sync() },
        syncDice() { this.pos.dice = [Number(this.d0), Number(this.d1)].filter(x => x >= 1 && x <= 6); this.sync() },
        setTurn(t) { this.pos.turn = t; this.sync() },
        // YÖN: Ben (fotoğrafçı/Sen) hangi renk? Recognition yanlışsa tüm sen/rakip ATAMASI terstir
        // (convention: +=fotoğrafçı; yanlış renkte puanlar negatife çevrilmiş). Takas = puanları çevir +
        // bar swap + fotoğrafçı rengini değiştir. GÖRSEL board aynı kalır, SAHİPLİK (sen/rakip) düzelir.
        setMine(dark) { if (dark !== this.mineDark) this.swapColors() },
        swapColors() {
            this.pos.points = (this.pos.points || []).map(v => -v)
            const b = this.pos.bar || { white: 0, black: 0 }
            this.pos.bar = { white: b.black || 0, black: b.white || 0 }
            this.mineDark = !this.mineDark
            this.$wire.set('photographerDark', this.mineDark, false)
            this.sync()
        },
        // Küp yok = tavlada küp açılmamış (değer 1, ortada). Recognition zarı küp sandıysa bununla temizle.
        setCubeNone(none) {
            if (none) this.pos.cube = { value: 1, owner: null }
            else this.pos.cube = { value: Math.max(2, Number(this.pos.cube.value) || 2), owner: this.pos.cube.owner || 'white' }
            this.sync()
        },
        // Düzeltilmiş konumu Livewire $pos'una deferred yaz (Kaydet action commit'inde uçar).
        sync() { this.$wire.set('pos', this.pos, false) }
    }">

    {{-- Yön (Ben hangi renk?) + Fırça --}}
    <div class="fd-card" style="display:flex;flex-direction:column;gap:10px">
        <div class="fd-row">
            <span class="fd-label" style="margin-right:2px">Yön — Ben (Sen)</span>
            <button type="button" class="fd-chip" :class="!mineDark && 'on'" @click="setMine(false)"><span class="fd-sw" style="background:#f3eee1"></span> Açık</button>
            <button type="button" class="fd-chip" :class="mineDark && 'on'" @click="setMine(true)"><span class="fd-sw" style="background:#b5423a"></span> Koyu</button>
            <span class="fd-hint">Fotoğrafta kendi taşların hangi renk? Yanlışsa seç → sen/rakip ters düzelir (görsel aynı kalır).</span>
        </div>
        <div style="height:1px;background:var(--br)"></div>
        <div class="fd-row">
            <span class="fd-label" style="margin-right:2px">Taş</span>
            <button type="button" class="fd-chip" :class="brush==='me' && 'on'" @click="brush='me'"><span class="fd-sw" :style="{background: meColor()}"></span> Sen</button>
            <button type="button" class="fd-chip" :class="brush==='opp' && 'on'" @click="brush='opp'"><span class="fd-sw" :style="{background: oppColor()}"></span> Rakip</button>
            <button type="button" class="fd-chip era" :class="brush==='erase' && 'on'" @click="brush='erase'">✕ Taş Sil</button>
            <span style="width:1px;height:22px;background:var(--br)"></span>
            <button type="button" class="fd-chip danger" @click="clearBoard()">🗑 Tahtayı Boşalt</button>
            <span class="fd-hint" x-text="brush==='erase' ? 'Taşa tıkla → kaldır' : 'Noktaya tıkla → taş ekle'"></span>
        </div>
    </div>

    {{-- Foto + tahta --}}
    <div class="fd-grid">
        <div style="display:flex;flex-direction:column;gap:10px">
            <div style="position:relative;cursor:zoom-in" @click="zoom=true" title="Büyütmek için tıkla">
                <img src="{{ $photoUrl }}" alt="" class="fd-photo"/>
                <span style="position:absolute;right:8px;bottom:8px;background:rgba(15,23,42,.78);color:#fff;font-size:12px;font-weight:600;border-radius:999px;padding:4px 10px;display:inline-flex;align-items:center;gap:5px;pointer-events:none">🔍 Büyüt (zar)</span>
            </div>
            <div class="fd-row" style="gap:7px">
                <span class="fd-read">Zar okudu: <b>{{ count($readDice) ? implode('-', $readDice) : '—' }}</b></span>
                <span class="fd-read">Küp okudu: <b>{{ $readCubeLabel }}</b></span>
            </div>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <svg viewBox="0 0 {{ $W }} {{ $H }}" role="img" aria-label="Düzeltme tahtası" class="fd-board"
                style="background:#1b2730;border-radius:10px;touch-action:manipulation">
                <rect x="0" y="0" width="{{ $W }}" height="{{ $H }}" rx="8" fill="#1b2730"/>
                <rect x="{{ $W / 2 - $barW / 2 }}" y="0" width="{{ $barW }}" height="{{ $H }}" fill="#0f1720"/>
                @foreach ([['top', true], ['bot', false]] as [$half, $isTop])
                    @for ($c = 0; $c < 12; $c++)
                        @php
                            $idx = $isTop ? $topIdx($c) : $botIdx($c);
                            $x = $colX($c);
                            $hw = $pw / 2 - 1;
                            $baseY = $isTop ? $m : $H - $m;
                            $apexY = $isTop ? $H / 2 - 14 : $H / 2 + 14;
                            $dark = $isTop ? ($c % 2 === 0) : ($c % 2 === 1);
                        @endphp
                        <polygon points="{{ $x - $hw }},{{ $baseY }} {{ $x + $hw }},{{ $baseY }} {{ $x }},{{ $apexY }}"
                            fill="{{ $dark ? '#2f4150' : '#d8cfc0' }}" opacity="0.55"/>
                        @for ($k = 0; $k < 5; $k++)
                            <circle cx="{{ $x }}" cy="{{ $isTop ? $cyTop($k) : $cyBot($k) }}" r="{{ $r }}"
                                x-show="mag({{ $idx }}) > {{ $k }}" :fill="fill({{ $idx }})"
                                stroke="rgba(0,0,0,.35)" stroke-width="1" style="pointer-events:none"/>
                        @endfor
                        <text x="{{ $x }}" y="{{ ($isTop ? $cyTop(4) : $cyBot(4)) + 3.5 }}" font-size="10" text-anchor="middle"
                            font-weight="700" x-show="mag({{ $idx }}) > 5" x-text="mag({{ $idx }})"
                            :fill="(pos.points[{{ $idx }}]>0) !== mineDark ? '#333' : '#fff'" style="pointer-events:none"/>
                        <rect x="{{ $x - $pw / 2 }}" y="{{ $isTop ? 0 : $H / 2 }}" width="{{ $pw }}" height="{{ $H / 2 }}"
                            fill="transparent" style="cursor:pointer" @click="paint({{ $idx }})"/>
                    @endfor
                @endforeach
                @php
                    $barCx = $W / 2; $rBar = $barW / 2 - 1; $dyBar = 2 * $rBar - 2;
                    $barRakipCy = fn ($k) => $m + $rBar + $k * $dyBar;          // Rakip: üst-orta istif
                    $barSenCy = fn ($k) => $H - $m - $rBar - $k * $dyBar;       // Sen: alt-orta istif
                @endphp
                {{-- Bar (kırık taş) — Rakip üst-orta, Sen alt-orta --}}
                @for ($k = 0; $k < 5; $k++)
                    <circle cx="{{ $barCx }}" cy="{{ $barRakipCy($k) }}" r="{{ $rBar }}"
                        x-show="barV('black') > {{ $k }}" :fill="oppColor()" stroke="rgba(0,0,0,.4)" stroke-width="1" style="pointer-events:none"/>
                    <circle cx="{{ $barCx }}" cy="{{ $barSenCy($k) }}" r="{{ $rBar }}"
                        x-show="barV('white') > {{ $k }}" :fill="meColor()" stroke="rgba(0,0,0,.4)" stroke-width="1" style="pointer-events:none"/>
                @endfor
                <text x="{{ $barCx }}" y="{{ $barRakipCy(4) + 3.5 }}" font-size="9" text-anchor="middle" font-weight="700"
                    x-show="barV('black') > 5" x-text="barV('black')" :fill="mineDark ? '#333' : '#fff'" style="pointer-events:none"/>
                <text x="{{ $barCx }}" y="{{ $barSenCy(4) + 3.5 }}" font-size="9" text-anchor="middle" font-weight="700"
                    x-show="barV('white') > 5" x-text="barV('white')" :fill="mineDark ? '#fff' : '#333'" style="pointer-events:none"/>
            </svg>

            {{-- Bar / Sıra / Zar / Küp --}}
            <div class="fd-ctl-grid" style="width:100%">
                <div class="fd-ctl">
                    <span class="fd-label">Bar (kırık taş)</span>
                    <div class="fd-row" style="gap:8px">
                        <span class="fd-sw" :style="{background: meColor()}"></span><span style="font-size:13px">Sen</span>
                        <button type="button" class="fd-step" @click="bar('white',-1)">−</button>
                        <span class="fd-num" x-text="barV('white')"></span>
                        <button type="button" class="fd-step" @click="bar('white',1)">+</button>
                    </div>
                    <div class="fd-row" style="gap:8px">
                        <span class="fd-sw" :style="{background: oppColor()}"></span><span style="font-size:13px">Rakip</span>
                        <button type="button" class="fd-step" @click="bar('black',-1)">−</button>
                        <span class="fd-num" x-text="barV('black')"></span>
                        <button type="button" class="fd-step" @click="bar('black',1)">+</button>
                    </div>
                </div>

                <div class="fd-ctl">
                    <span class="fd-label">Sıra</span>
                    <div class="fd-row">
                        <button type="button" class="fd-chip" :class="(pos.turn||'white')==='white' && 'on'" @click="setTurn('white')"><span class="fd-sw" :style="{background: meColor()}"></span> Sen</button>
                        <button type="button" class="fd-chip" :class="pos.turn==='black' && 'on'" @click="setTurn('black')"><span class="fd-sw" :style="{background: oppColor()}"></span> Rakip</button>
                    </div>
                </div>

                <div class="fd-ctl">
                    <span class="fd-label">🎲 Zar <span style="text-transform:none;font-weight:500">(yanlışsa düzelt)</span></span>
                    <div class="fd-row" style="gap:8px">
                        <select class="fd-select" x-model.number="d0" @change="syncDice()">
                            <option value="0">—</option>
                            @for ($v = 1; $v <= 6; $v++)<option value="{{ $v }}">{{ $v }}</option>@endfor
                        </select>
                        <span style="color:var(--muted)">–</span>
                        <select class="fd-select" x-model.number="d1" @change="syncDice()">
                            <option value="0">—</option>
                            @for ($v = 1; $v <= 6; $v++)<option value="{{ $v }}">{{ $v }}</option>@endfor
                        </select>
                    </div>
                </div>

                <div class="fd-ctl">
                    <span class="fd-label">Küp <span style="text-transform:none;font-weight:500">(zar sanılmışsa "yok" işaretle)</span></span>
                    <label class="fd-row" style="gap:7px;cursor:pointer;font-size:13px">
                        <input type="checkbox" :checked="Number(pos.cube.value)===1" @change="setCubeNone($event.target.checked)" style="width:16px;height:16px;accent-color:#16a34a"/>
                        Küp yok (ortada / açılmamış)
                    </label>
                    <div class="fd-row" style="gap:8px" x-show="Number(pos.cube.value)!==1" x-cloak>
                        <select class="fd-select" x-model.number="pos.cube.value" @change="sync()">
                            @foreach ([2, 4, 8, 16, 32, 64] as $v)<option value="{{ $v }}">{{ $v }}</option>@endforeach
                        </select>
                        <select class="fd-select" x-model="pos.cube.owner" @change="sync()">
                            <option value="white">sen</option>
                            <option value="black">rakip</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {{-- Kaydet --}}
    <div class="fd-row" style="margin-top:2px">
        <button type="button" class="fd-save" @click="$wire.save()" wire:loading.attr="disabled" wire:target="save">
            ✓ Kaydet → Eğitime hazır
        </button>
        <span wire:loading wire:target="save" class="fd-hint">Kaydediliyor…</span>
        <span class="fd-hint" style="flex:1 1 220px">Fotoğrafa bak; renk seç, noktalara tıklayarak taşları doğru say. Bar/Sıra/Zar/Küp'ü düzelt → Kaydet.</span>
    </div>

    {{-- Fotoğraf büyüteç (lightbox): tıkla → büyük aç, zarı gör; arkaplan/X/Esc ile kapat --}}
    <template x-teleport="body">
        <div x-show="zoom" x-cloak @click="zoom=false" @keydown.escape.window="zoom=false"
            style="position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.92);display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out"
            x-transition.opacity>
            <img src="{{ $photoUrl }}" alt="" style="max-width:96vw;max-height:92vh;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.6)"/>
            <button type="button" @click.stop="zoom=false" aria-label="Kapat"
                style="position:fixed;top:18px;right:22px;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:22px;cursor:pointer;line-height:1">✕</button>
        </div>
    </template>
</div>
</x-filament-panels::page>
