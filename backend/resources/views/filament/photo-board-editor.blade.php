@php
    // Foto analizi ELLE DÜZELTME editörü: SOLDA foto, SAĞDA tıklanabilir tahta yan yana. Üstte fırça
    // (Sen/Rakip/Sil); noktaya tıkladıkça aktif renkten taş EKLENİR. Çizim PhotoAnalysis.tsx'teki
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
@endphp
<div x-data="{
        pos: @js($pos),
        mineDark: @js((bool) $mineDark),
        brush: 'me', timer: null,
        mag(i) { return Math.abs(this.pos.points?.[i] || 0) },
        // Noktaya tıkla -> aktif fırçayı uygula. Aynı renk +1 (max 15); zıt renk varsa yeni renge 1 ile
        // sıfırla (tavlada bir hane tek renk); Sil -> mutlak değeri 1 azalt.
        paint(i) {
            const cur = this.pos.points[i] || 0
            if (this.brush === 'erase') {
                this.pos.points[i] = cur > 0 ? cur - 1 : cur < 0 ? cur + 1 : 0
            } else {
                const sign = this.brush === 'me' ? 1 : -1
                if (cur === 0 || Math.sign(cur) === sign) this.pos.points[i] = Math.min(15, Math.abs(cur) + 1) * sign
                else this.pos.points[i] = sign
            }
            this.sync()
        },
        fill(i) { const n = this.pos.points?.[i] || 0; return (n > 0) !== this.mineDark ? '#f3eee1' : '#b5423a' },
        barV(k) { return this.pos.bar?.[k] || 0 },
        bar(k, d) { if (!this.pos.bar) this.pos.bar = { white: 0, black: 0 }; this.pos.bar[k] = Math.max(0, Math.min(15, this.barV(k) + d)); this.sync() },
        dieV(i) { return this.pos.dice?.[i] || 0 },
        setDie(i, v) { const a = [this.dieV(0), this.dieV(1)]; a[i] = +v; this.pos.dice = a.filter(x => x >= 1 && x <= 6); this.sync() },
        setTurn(t) { this.pos.turn = t; this.sync() },
        setCubeVal(v) { if (!this.pos.cube) this.pos.cube = { value: 1, owner: null }; this.pos.cube.value = +v; if (+v === 1) this.pos.cube.owner = null; this.sync() },
        setCubeOwner(o) { if (!this.pos.cube) this.pos.cube = { value: 1, owner: null }; this.pos.cube.owner = o || null; if (!o) this.pos.cube.value = 1; this.sync() },
        // JSON'u gizli forma yaz (deferred) + debounce commit (her tıklamada roundtrip yok; Kaydet'te de uçar).
        sync() { this.$wire.set('{{ $statePath }}', JSON.stringify(this.pos), false); clearTimeout(this.timer); this.timer = setTimeout(() => this.$wire.$commit(), 400) }
    }" style="display:flex;flex-direction:column;gap:12px;user-select:none">

    {{-- Fırça: aktif renk/sil --}}
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <b style="font-size:13px">Renk:</b>
        <button type="button" @click="brush='me'" :style="{ background: brush==='me' ? '#1b2730':'#fff', color: brush==='me' ? '#fff':'#111827', outline: brush==='me' ? '2px solid #1b2730':'none' }"
            style="height:32px;padding:0 14px;border-radius:8px;border:1px solid #d1d5db;font-size:13px;font-weight:600">● Sen</button>
        <button type="button" @click="brush='opp'" :style="{ background: brush==='opp' ? '#b5423a':'#fff', color: brush==='opp' ? '#fff':'#111827', outline: brush==='opp' ? '2px solid #b5423a':'none' }"
            style="height:32px;padding:0 14px;border-radius:8px;border:1px solid #d1d5db;font-size:13px;font-weight:600">● Rakip</button>
        <button type="button" @click="brush='erase'" :style="{ background: brush==='erase' ? '#6b7280':'#fff', color: brush==='erase' ? '#fff':'#111827', outline: brush==='erase' ? '2px solid #6b7280':'none' }"
            style="height:32px;padding:0 14px;border-radius:8px;border:1px solid #d1d5db;font-size:13px;font-weight:600">✕ Sil</button>
        <span style="font-size:12px;color:#6b7280">Noktaya tıkla → taş ekle/çıkar</span>
    </div>

    {{-- Foto (sol) + tahta (sağ) yan yana --}}
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
        <img src="{{ $photoUrl }}" alt="" style="flex:1 1 260px;max-width:340px;width:100%;border-radius:8px;border:1px solid #e5e7eb;object-fit:contain"/>
        <svg viewBox="0 0 {{ $W }} {{ $H }}" role="img" aria-label="Düzeltme tahtası"
            style="flex:1 1 340px;max-width:460px;width:100%;background:#1b2730;border-radius:8px;touch-action:manipulation">
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
                    {{-- tıklama alanı (tüm yarı-kolon) --}}
                    <rect x="{{ $x - $pw / 2 }}" y="{{ $isTop ? 0 : $H / 2 }}" width="{{ $pw }}" height="{{ $H / 2 }}"
                        fill="transparent" style="cursor:pointer" @click="paint({{ $idx }})"/>
                @endfor
            @endforeach
        </svg>
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
        Soldaki fotoğrafa bak; renk seç (Sen/Rakip), tahtada ilgili noktaya tıklayarak taşları doğru say ve
        renge getir (Sil ile azalt). Bar/Sıra/Zar/Küp'ü de düzelt. Sonra aşağıdan <b>Kaydet</b> → eğitim etiketi.
    </div>
</div>
