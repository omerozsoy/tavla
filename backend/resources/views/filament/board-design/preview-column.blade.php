@php $rec = $getRecord(); @endphp
<div class="px-3 py-2" style="width:170px">@include('filament.board-design.preview-zoom', [
    'colors' => $getState(), 'surface' => $rec->surface, 'checkerStyle' => $rec->checker_style,
    'imgOdd' => $rec->point_mode === 'each' ? null : \App\Models\BoardDesign::imageUrl($rec->point_image_odd),
    'imgEven' => $rec->point_mode === 'each' ? null : \App\Models\BoardDesign::imageUrl($rec->point_image_even),
    'fitOdd' => $rec->point_image_fit['odd'] ?? null,
    'fitEven' => $rec->point_image_fit['even'] ?? null,
    'pointImgs' => $rec->point_mode === 'each' ? collect($rec->point_images ?? [])->map(fn ($p) => \App\Models\BoardDesign::imageUrl($p))->all() : null,
    'pointFits' => $rec->point_mode === 'each' ? collect($rec->point_images ?? [])->keys()->mapWithKeys(fn ($n) => [$n => $rec->point_image_fit['p'.$n] ?? []])->all() : null,
    'surfLeft' => \App\Models\BoardDesign::imageUrl($rec->surface_image_left),
    'surfRight' => \App\Models\BoardDesign::imageUrl($rec->surface_image_right),
    'surfOpacity' => $rec->surface_image_opacity ?? 100,
    'surfFit' => $rec->surface_image_fit ?: 'cover',
    'surfPos' => $rec->surface_pos,
    'texts' => $rec->point_texts,
    'width' => 170,
])</div>
