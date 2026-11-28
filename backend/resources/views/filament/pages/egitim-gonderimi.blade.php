<x-filament-panels::page>
    @php($s = $this->stats())
    @php($rows = $this->rows())

    {{-- İlerleme banner'ı: bekleyen / limit --}}
    <div style="border:1px solid {{ $s['ready'] ? '#16a34a' : '#e5e7eb' }};border-radius:12px;padding:16px;background:{{ $s['ready'] ? '#f0fdf4' : '#fff' }}">
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
            <span style="font-size:26px;font-weight:800;color:{{ $s['ready'] ? '#15803d' : '#1b2730' }}">{{ $s['pending'] }}</span>
            <span style="font-size:14px;color:#6b7280">/ {{ $s['limit'] }} eğitime hazır (gönderilmeyi bekliyor)</span>
            @if ($s['ready'])
                <span style="margin-left:auto;background:#16a34a;color:#fff;font-size:12px;font-weight:700;border-radius:999px;padding:4px 12px">✓ Limit doldu — gönderebilirsin</span>
            @else
                <span style="margin-left:auto;font-size:12px;color:#6b7280">limite {{ max(0, $s['limit'] - $s['pending']) }} kaldı</span>
            @endif
        </div>
        <div style="margin-top:10px;height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden">
            <div style="height:100%;width:{{ $s['pct'] }}%;background:{{ $s['ready'] ? '#16a34a' : '#f59e0b' }};transition:width .3s"></div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:#6b7280">Bugüne dek gönderilmiş: <b>{{ $s['sent'] }}</b> etiket</div>
    </div>

    {{-- Limit ayarı + Eğitime Gönder --}}
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-top:4px">
        <div style="display:flex;flex-direction:column;gap:4px">
            <label style="font-size:12px;color:#6b7280;font-weight:600">Eğitim limiti</label>
            <div style="display:flex;gap:8px;align-items:center">
                <input type="number" min="1" wire:model="limit"
                    style="height:38px;width:120px;border-radius:8px;border:1px solid #d1d5db;padding:0 10px;font-size:14px"/>
                <button type="button" wire:click="saveLimit"
                    style="height:38px;padding:0 16px;border-radius:8px;border:1px solid #d1d5db;background:#fff;font-size:13px;font-weight:600;cursor:pointer">Limiti Kaydet</button>
            </div>
        </div>
        <button type="button" wire:click="sendToTraining" wire:confirm="{{ $s['ready'] ? $s['pending'].' etiket eğitime gönderilsin mi?' : 'Limitin ALTINDASIN ('.$s['pending'].'/'.$s['limit'].'). Yine de '.$s['pending'].' etiketi göndermek istiyor musun?' }}"
            wire:loading.attr="disabled" wire:target="sendToTraining" @disabled($s['pending'] === 0)
            style="height:40px;padding:0 22px;border-radius:9px;border:0;background:{{ $s['pending'] === 0 ? '#9ca3af' : '#15803d' }};color:#fff;font-size:14px;font-weight:700;cursor:{{ $s['pending'] === 0 ? 'not-allowed' : 'pointer' }}">
            🎓 Eğitime Gönder
        </button>
        <span wire:loading wire:target="sendToTraining" style="font-size:12px;color:#6b7280">Gönderiliyor…</span>
    </div>

    {{-- Bekleyen etiketler --}}
    <div style="margin-top:8px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="padding:10px 14px;background:#f9fafb;font-size:13px;font-weight:700;border-bottom:1px solid #e5e7eb">
            Gönderilmeyi bekleyen etiketler ({{ count($rows) }})
        </div>
        @if (count($rows) === 0)
            <div style="padding:20px;text-align:center;color:#6b7280;font-size:13px">Bekleyen etiket yok. Foto Analizleri'nde düzelt/onayla → burada birikir.</div>
        @else
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                    <tr style="text-align:left;color:#6b7280;background:#fff">
                        <th style="padding:8px 14px;border-bottom:1px solid #f0f0f0">#</th>
                        <th style="padding:8px 14px;border-bottom:1px solid #f0f0f0">Kullanıcı</th>
                        <th style="padding:8px 14px;border-bottom:1px solid #f0f0f0">Durum</th>
                        <th style="padding:8px 14px;border-bottom:1px solid #f0f0f0">Bildirildi</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($rows as $row)
                        <tr>
                            <td style="padding:8px 14px;border-bottom:1px solid #f6f6f6;font-weight:600">{{ $row['id'] }}</td>
                            <td style="padding:8px 14px;border-bottom:1px solid #f6f6f6">{{ $row['user'] }}</td>
                            <td style="padding:8px 14px;border-bottom:1px solid #f6f6f6">
                                <span style="font-size:11.5px;border-radius:999px;padding:2px 9px;background:{{ $row['status'] === 'otomatik doğru' ? '#eef2ff' : '#ecfccb' }}">{{ $row['status'] }}</span>
                            </td>
                            <td style="padding:8px 14px;border-bottom:1px solid #f6f6f6;color:#6b7280">{{ $row['reported_at'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </div>
</x-filament-panels::page>
