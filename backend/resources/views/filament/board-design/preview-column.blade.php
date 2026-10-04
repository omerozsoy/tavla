@php $rec = $getRecord(); @endphp
<div class="px-3 py-2" style="width:170px">@include('filament.board-design.preview', ['colors' => $getState(), 'surface' => $rec->surface, 'checkerStyle' => $rec->checker_style, 'width' => 170])</div>
