<x-filament-panels::page>
    {{-- Gerçek temalı React Board düzeltme sayfası, panel içinde iframe ile (admin panelden ÇIKMAZ).
         FotoDuzelt opak tam-ekran (fd-screen) → iframe temiz görünür. Kaydet/kapat → React, iframe'de
         olduğunu anlayıp top-window'u /admin/photo-analyses'e döndürür (ön yüz görünmez). --}}
    <iframe src="/foto-duzelt/{{ $this->getRecord()->id }}"
        style="width:100%;height:86vh;border:0;border-radius:10px;background:#f4f1ea"
        title="Foto Düzelt"></iframe>
</x-filament-panels::page>
