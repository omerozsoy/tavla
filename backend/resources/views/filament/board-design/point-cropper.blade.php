@php
    // Croppie tarzı hane kırpıcı: resmi ÜÇGEN pencere içinde sürükle (fare/dokunma), tekerlek veya
    // +/− ile yakınlaştır. Bırakınca değerler forma (point_image_fit.<kind>.x|y|zoom) yazılır;
    // kaydırıcılar ince ayar olarak senkron kalır. Formül oyun tahtası/önizlemelerle AYNI:
    // genişlik = max(W/a, H)·zoom (cover × zoom), konum = (W−w)·x%, (H−h)·y%.
    $W = 160; $H = 436; // gerçek hane oranı (~1 : 2.7)
    $fit = is_array($fit ?? null) ? $fit : [];
    $a = (float) ($fit['aspect'] ?? 0);
    $col = (is_string($color ?? null) && preg_match('/^#[0-9a-fA-F]{6}$/', $color)) ? $color : '#a83a2b';
    $u = 'cr'.substr(md5(uniqid('', true)), 0, 8);
    $cfg = [
        'W' => $W, 'H' => $H, 'a' => $a,
        'x' => (float) ($fit['x'] ?? 50), 'y' => (float) ($fit['y'] ?? 50), 'zoom' => (float) ($fit['zoom'] ?? 100),
        'path' => 'data.point_image_fit.'.$kind,
    ];
@endphp
@if (empty($img) || $a <= 0)
    <div style="font-size:12px;color:#6b7280;padding:8px 0">Önce resim yükle; sonra resmi hane içinde sürükleyerek yerleştir.</div>
@else
    <div x-data="{
            ...@js($cfg),
            drag: null, timer: null,
            geo() {
                const sc = Math.max(this.W / this.a, this.H) * (this.zoom / 100)
                const w = this.a * sc
                return { w, h: sc, x: (this.W - w) * this.x / 100, y: (this.H - sc) * this.y / 100 }
            },
            pct(v) { return Math.max(0, Math.min(100, v)) },
            down(e) {
                const g = this.geo()
                this.drag = { px: e.clientX, py: e.clientY, gx: g.x, gy: g.y, s: this.$refs.svg.getBoundingClientRect().width / this.W }
                e.target.setPointerCapture?.(e.pointerId)
            },
            move(e) {
                if (!this.drag) return
                const g = this.geo()
                const nx = this.drag.gx + (e.clientX - this.drag.px) / this.drag.s
                const ny = this.drag.gy + (e.clientY - this.drag.py) / this.drag.s
                if (this.W - g.w < -0.01) this.x = this.pct(nx / (this.W - g.w) * 100)
                if (this.H - g.h < -0.01) this.y = this.pct(ny / (this.H - g.h) * 100)
            },
            up() { if (!this.drag) return; this.drag = null; this.save() },
            zoomBy(d) { this.zoom = Math.max(100, Math.min(400, Math.round(this.zoom + d))); this.saveSoon() },
            reset() { this.x = 50; this.y = 50; this.zoom = 100; this.save() },
            saveSoon() { clearTimeout(this.timer); this.timer = setTimeout(() => this.save(), 350) },
            save() {
                this.$wire.set(this.path + '.x', Math.round(this.x), false)
                this.$wire.set(this.path + '.y', Math.round(this.y), false)
                this.$wire.set(this.path + '.zoom', Math.round(this.zoom))
            },
        }" style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;user-select:none">
        <svg x-ref="svg" viewBox="0 0 {{ $W }} {{ $H }}" role="img" aria-label="Hane kırpıcı"
            style="display:block;width:100%;max-width:{{ (int) ($maxWidth ?? 160) }}px;height:auto;background:#2a2622;border-radius:10px;touch-action:none"
            :style="{ cursor: drag ? 'grabbing' : 'grab' }"
            @pointerdown.prevent="down($event)" @pointermove="move($event)" @pointerup="up()" @pointercancel="up()"
            @wheel.prevent="zoomBy($event.deltaY < 0 ? 8 : -8)">
            <clipPath id="{{ $u }}"><polygon points="0,0 {{ $W }},0 {{ $W / 2 }},{{ $H }}"/></clipPath>
            <polygon points="0,0 {{ $W }},0 {{ $W / 2 }},{{ $H }}" fill="{{ $col }}"/>
            {{-- Pencere dışında kalan kısım soluk (croppie gibi): resmin tamamı + seçili alan --}}
            <image href="{{ $img }}" preserveAspectRatio="none" opacity=".28"
                :x="geo().x" :y="geo().y" :width="geo().w" :height="geo().h"/>
            <image href="{{ $img }}" preserveAspectRatio="none" clip-path="url(#{{ $u }})"
                :x="geo().x" :y="geo().y" :width="geo().w" :height="geo().h"/>
            <polygon points="0,0 {{ $W }},0 {{ $W / 2 }},{{ $H }}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="5 4" opacity=".9"/>
        </svg>
        {{-- color ACIK yaz: Filament karanlik temada buton metni beyaz miras alip beyaz zeminde kayboluyordu. --}}
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button type="button" @click="zoomBy(-20)" title="Uzaklaştır"
                style="width:30px;height:30px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#111827;font-weight:700">−</button>
            <span style="font-size:12px;min-width:44px;text-align:center" x-text="'%' + Math.round(zoom)"></span>
            <button type="button" @click="zoomBy(20)" title="Yakınlaştır"
                style="width:30px;height:30px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#111827;font-weight:700">+</button>
            <button type="button" @click="reset()" title="Ortala ve sıfırla"
                style="height:30px;padding:0 10px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#111827;font-size:12px">Sıfırla</button>
        </div>
        <div style="font-size:11.5px;color:#6b7280;line-height:1.4;max-width:240px" @if (! empty($compact)) hidden @endif>
            Resmi sürükleyerek yerleştir; tekerlek veya +/− ile yakınlaştır. Kesikli çizgi = hane.
            Karşı sıradaki haneler aynı tasarımı ters çevrilmiş kullanır.
        </div>
    </div>
@endif
