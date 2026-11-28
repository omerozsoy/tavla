<x-filament-panels::page>
    {{-- Gerçek temalı React Board düzeltme sayfası, panel içinde iframe ile (admin panelden çıkmaz). --}}
    <iframe src="/foto-duzelt/{{ $this->getRecord()->id }}"
        style="width:100%;height:84vh;border:0;border-radius:10px;background:#fff"
        title="Foto Düzelt"></iframe>
</x-filament-panels::page>
