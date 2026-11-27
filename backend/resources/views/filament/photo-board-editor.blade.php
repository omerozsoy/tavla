@php
    // Foto analizi ELLE DÜZELTME editörü: tanınan konumu tıklanabilir tahtada düzelt -> JSON
    // (data.ground_truth) olarak yazılır, Kaydet ile eğitim etiketi olur. Çizim PhotoAnalysis.tsx'teki
    // PositionBoard ile AYNI geometri: W360×H240, orta bar, üst 13..24 / alt 12..1 (homeLeft aynalar).
    // points[i]: + = fotoğrafı çeken (sen), − = rakip. mineDark = çeken koyu taşla oynuyor.
    $W = 360; $H = 240; $m = 6; $barW = 20;
    $fieldW = ($W - 2 * $m - $barW) / 2;
    $pw = $fieldW / 6;
    $r = min($pw / 2 - 1.5, 12);
    $colX = fn ($c) => $c < 6 ? $m + ($c + 0.5) * $pw : $m + $fieldW + $barW + ($c - 6 + 0.5) * $pw;
    $topIdx = fn ($c) => ($homeLeft ? 24 - $c : 13 + $c) - 1; // 0-tabanlı points indeksi
    $botIdx = fn ($c) => ($homeLeft ? 1 + $c : 12 - $c) - 1;
    $dy = 2 * $r - 2;
    $cyTop = fn ($k) => $m + $r + $k * $dy;
    $cyBot = fn ($k) => $H - $m - $r - $k * $dy;
    $statePath = 'data.ground_truth';
    $dice = $pos['dice'] ?? [];
@endphp
<div x-data="{
        pos: @js($pos),
        mineDark: @js((bool) $mineDark),
        sel: null, selSign: 1, timer: null,
        mag(i) { return Math.abs(this.pos.points?.[i] || 0) },
        pick(i) { this.sel = i; this.selSign = (this.pos.points?.[i] || 0) < 0 ? -1 : 1 },
        setMag(mm) {
            if (this.sel === null) return
            mm = Math.max(0, Math.min(15, mm))
            this.pos.points[this.sel] = mm * this.selSign
            this.sync()
        },
        bump(d) { this.setMag(this.mag(this.sel) + d) },
        setSign(s) {
            if (this.sel === null) return
            this.selSign = s
            this.pos.points[this.sel] = this.mag(this.sel) * s
            this.sync()
        },
        fill(i) { const n = this.pos.points?.[i] || 0; return (n > 0) !== this.mineDark ? '#f3eee1' : '#b5423a' },
        barV(k) { return this.pos.bar?.[k] || 0 },
        bar(k, d) {
            if (!this.pos.bar) this.pos.bar = { white: 0, black: 0 }
            this.pos.bar[k] = Math.max(0, Math.min(15, this.barV(k) + d)); this.sync()
        },
        dieV(i) { return this.pos.dice?.[i] || 0 },
        setDie(i, v) { const a = [this.dieV(0), this.dieV(1)]; a[i] = +v; this.pos.dice = a.filter(x => x >= 1 && x <= 6); this.sync() },
        setTurn(t) { this.pos.turn = t; this.sync() },
        setCubeVal(v) { if (!this.pos.cube) this.pos.cube = { value: 1, owner: null }; this.pos.cube.value = +v; if (+v === 1) this.pos.cube.owner = null; this.sync() },
        setCubeOwner(o) { if (!this.pos.cube) this.pos.cube = { value: 1, owner: null }; this.pos.cube.owner = o || null; if (!o) this.pos.cube.value = 1; this.sync() },
        // JSON'u gizli forma yaz (deferred) + debounce commit (her tıklamada roundtrip yok; Kaydet'te de uçar).
        sync() {
            this.$wire.set('{{ $statePath }}', JSON.stringify(this.pos), false)
            clearTimeout(this.timer); this.timer = setTimeout(() => this.$wire.$commit(), 400)
        },
        selLabel() { if (this.sel === null) return ''; const i = this.sel; return (i + 1) }
    }" style="display:flex;flex-direction:column;gap:10px;user-select:none;max-width:480px">

    <svg viewBox="0 0 {{ $W }} {{ $H }}" role="img" aria-label="Düzeltme tahtası"
        style="display:block;width:100%;background:#1b2730;border-radius:8px;touch-action:manipulation">
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
                {{-- üçgen --}}
                <polygon points="{{ $x - $hw }},{{ $baseY }} {{ $x + $hw }},{{ $baseY }} {{ $x }},{{ $apexY }}"
                    fill="{{ $dark ? '#2f4150' : '#d8cfc0' }}" opacity="0.55"/>
                {{-- taşlar (en çok 5 çizilir, fazlası sayı) --}}
                @for ($k = 0; $k < 5; $k++)
                    <circle cx="{{ $x }}" cy="{{ $isTop ? $cyTop($k) : $cyBot($k) }}" r="{{ $r }}"
                        x-show="mag({{ $idx }}) > {{ $k }}" :fill="fill({{ $idx }})"
                        stroke="rgba(0,0,0,.35)" stroke-width="1" style="pointer-events:none"/>
                @endfor
                <text x="{{ $x }}" y="{{ ($isTop ? $cyTop(4) : $cyBot(4)) + 3.5 }}" font-size="10" text-anchor="middle"
                    font-weight="700" x-show="mag({{ $idx }}) > 5" x-text="mag({{ $idx }})"
                    :fill="(pos.points[{{ $idx }}]>0) !== mineDark ? '#333' : '#fff'" style="pointer-events:none"/>
                {{-- tıklama alanı + seçili çerçeve --}}
                <rect x="{{ $x - $pw / 2 }}" y="{{ $isTop ? 0 : $H / 2 }}" width="{{ $pw }}" height="{{ $H / 2 }}"
                    fill="transparent" style="cursor:pointer" @click="pick({{ $idx }})"/>
                <rect x="{{ $x - $pw / 2 + 1 }}" y="{{ $isTop ? 1 : $H / 2 }}" width="{{ $pw - 2 }}" height="{{ $H / 2 - 1 }}"
                    rx="4" fill="none" stroke="#f2c14e" stroke-width="2" x-show="sel === {{ $idx }}" style="pointer-events:none"/>
            @endfor
        @endforeach
    </svg>

    {{-- Seçili nokta düzenleyici --}}
    <div x-show="sel !== null" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#f3f4f6;border-radius:8px;padding:8px 10px">
        <b style="font-size:13px">Nokta <span x-text="selLabel()"></span>:</b>
        <button type="button" @click="bump(-1)" style="width:30px;height:30px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#111827;font-weight:700">−</button>
        <span style="min-width:22px;text-align:center;font-weight:700" x-text="mag(sel)"></span>
        <button type="button" @click="bump(1)" style="width:30px;height:30px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#111827;font-weight:700">+</button>
        <span style="width:10px"></span>
        <button type="button" @click="setSign(1)" :style="{ background: selSign===1 ? '#1b2730':'#fff', color: selSign===1 ? '#fff':'#111827' }"
            style="height:30px;padding:0 12px;border-radius:8px;border:1px solid #d1d5db;font-size:12px;font-weight:600">Sen</button>
        <button type="button" @click="setSign(-1)" :style="{ background: selSign===-1 ? '#b5423a':'#fff', color: selSign===-1 ? '#fff':'#111827' }"
            style="height:30px;padding:0 12px;border-radius:8px;border:1px solid #d1d5db;font-size:12px;font-weight:600">Rakip</button>
    </div>

    {{-- Bar / Sıra / Zar / Küp --}}
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;align-items:center">
        <div style="display:flex;align-items:center;gap:6px">
            <b>Bar</b>
            <span>Sen</span>
            <button type="button" @click="bar('white',-1)" style="width:26px;height:26px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#111827">−</button>
            <span x-text="barV('white')" style="min-width:16px;text-align:center"></span>
            <button type="button" @click="bar('white',1)" style="width:26px;height:26px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#111827">+</button>
            <span>Rakip</span>
            <button type="button" @click="bar('black',-1)" style="width:26px;height:26px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#111827">−</button>
            <span x-text="barV('black')" style="min-width:16px;text-align:center"></span>
            <button type="button" @click="bar('black',1)" style="width:26px;height:26px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#111827">+</button>
        </div>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;align-items:center">
        <div style="display:flex;align-items:center;gap:6px">
            <b>Sıra</b>
            <button type="button" @click="setTurn('white')" :style="{ background: (pos.turn||'white')==='white' ? '#1b2730':'#fff', color: (pos.turn||'white')==='white' ? '#fff':'#111827' }"
                style="height:28px;padding:0 10px;border-radius:6px;border:1px solid #d1d5db;font-size:12px">Sen</button>
            <button type="button" @click="setTurn('black')" :style="{ background: pos.turn==='black' ? '#b5423a':'#fff', color: pos.turn==='black' ? '#fff':'#111827' }"
                style="height:28px;padding:0 10px;border-radius:6px;border:1px solid #d1d5db;font-size:12px">Rakip</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
            <b>Zar</b>
            <select @change="setDie(0,$event.target.value)" style="height:28px;border-radius:6px;border:1px solid #d1d5db;padding:0 4px">
                <template x-for="v in [0,1,2,3,4,5,6]" :key="v"><option :value="v" :selected="dieV(0)===v" x-text="v || '—'"></option></template>
            </select>
            <select @change="setDie(1,$event.target.value)" style="height:28px;border-radius:6px;border:1px solid #d1d5db;padding:0 4px">
                <template x-for="v in [0,1,2,3,4,5,6]" :key="v"><option :value="v" :selected="dieV(1)===v" x-text="v || '—'"></option></template>
            </select>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
            <b>Küp</b>
            <select @change="setCubeVal($event.target.value)" style="height:28px;border-radius:6px;border:1px solid #d1d5db;padding:0 4px">
                <template x-for="v in [1,2,4,8,16,32,64]" :key="v"><option :value="v" :selected="(pos.cube?.value||1)===v" x-text="v"></option></template>
            </select>
            <select @change="setCubeOwner($event.target.value)" style="height:28px;border-radius:6px;border:1px solid #d1d5db;padding:0 4px">
                <option value="" :selected="!(pos.cube?.owner)">orta</option>
                <option value="white" :selected="pos.cube?.owner==='white'">sen</option>
                <option value="black" :selected="pos.cube?.owner==='black'">rakip</option>
            </select>
        </div>
    </div>
    <div style="font-size:11.5px;color:#6b7280;line-height:1.4">
        Fotoğrafa bakıp yanlış noktaları düzelt: noktaya tıkla, −/+ ile taş say, Sen/Rakip ile renk seç.
        Sonra aşağıdan <b>Kaydet</b>. Değişiklikler eğitim etiketi olarak saklanır.
    </div>
</div>
