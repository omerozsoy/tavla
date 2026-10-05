@php $rec = $getRecord(); @endphp
<div class="px-3 py-2" style="width:170px">@include('filament.board-design.preview-zoom', [
    'colors' => $getState(), 'surface' => $rec->surface, 'checkerStyle' => $rec->checker_style,
    'imgOdd' => \App\Models\BoardDesign::imageUrl($rec->point_image_odd),
    'imgEven' => \App\Models\BoardDesign::imageUrl($rec->point_image_even),
    'fitOdd' => $rec->point_image_fit['odd'] ?? null,
    'fitEven' => $rec->point_image_fit['even'] ?? null,
    'width' => 170,
])</div>
