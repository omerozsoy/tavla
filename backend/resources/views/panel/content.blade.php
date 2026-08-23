@extends('panel.layout')
@section('content')
  @php $labels=['service'=>'Hizmetler','event'=>'Takvim','club'=>'Kulüpler','blog'=>'Blog','news'=>'Haberler','ad'=>'Reklamlar','quiz'=>'Quizler']; @endphp
  @php
    $quiz = ['options'=>['','','',''], 'answer'=>0, 'explain'=>''];
    if($type==='quiz' && $editing && $editing->body){
      $q = json_decode($editing->body, true);
      if(is_array($q)){ $quiz['answer']=(int)($q['answer']??0); $quiz['explain']=$q['explain']??''; foreach(($q['options']??[]) as $k=>$v){ $quiz['options'][$k]=$v; } }
    }
  @endphp
  <h1>İçerik Yönetimi</h1>

  <div class="type-tabs">
    @foreach($types as $ty)
      <a href="/panel/content?type={{ $ty }}" class="{{ $type===$ty ? 'active' : '' }}">{{ $labels[$ty] }}</a>
    @endforeach
  </div>

  <div class="card">
    <h2>{{ $editing ? 'Düzenle' : 'Yeni '.$labels[$type] }}</h2>
    <form method="post" action="/panel/content" enctype="multipart/form-data">
      @csrf
      <input type="hidden" name="type" value="{{ $type }}">
      @if($editing)<input type="hidden" name="id" value="{{ $editing->id }}">@endif

      <div class="field">
        <label>{{ $type==='club' ? 'Kulüp Adı' : ($type==='quiz' ? 'Soru' : 'Başlık') }}</label>
        <input name="title" value="{{ old('title', $editing->title ?? '') }}" required>
      </div>

      @if($type==='event')
        <div class="grid">
          <div><label>Düzenleyen / Otel</label><input name="organizer" value="{{ $editing->organizer ?? '' }}"></div>
          <div><label>Yer</label><input name="place" value="{{ $editing->place ?? '' }}"></div>
          <div><label>Tarih &amp; Saat</label><input type="datetime-local" name="event_at" value="{{ $editing && $editing->event_at ? $editing->event_at->format('Y-m-d\TH:i') : '' }}"></div>
          <div><label>İletişim</label><input name="contact" value="{{ $editing->contact ?? '' }}"></div>
        </div>
      @elseif($type==='club')
        <div class="grid">
          <div><label>İl</label><input name="province" value="{{ $editing->province ?? '' }}"></div>
          <div><label>Adres</label><input name="place" value="{{ $editing->place ?? '' }}"></div>
          <div><label>İletişim</label><input name="contact" value="{{ $editing->contact ?? '' }}"></div>
        </div>
      @elseif($type==='blog' || $type==='news')
        <div class="field" style="max-width:260px">
          <label>Yayın Tarihi</label>
          <input type="date" name="event_at" value="{{ $editing && $editing->event_at ? $editing->event_at->format('Y-m-d') : '' }}">
        </div>
      @endif

      @if(in_array($type,['event','blog','news','ad']))
        <div class="field">
          <label>{{ $type==='ad' ? 'Reklam Görseli' : 'Görsel (isteğe bağlı)' }}</label>
          @if($editing && $editing->image)
            <div style="margin-bottom:8px"><img src="{{ $editing->image }}" alt="" style="max-height:120px;border-radius:8px;border:1px solid var(--line)"></div>
          @endif
          <input type="file" name="image_file" accept="image/*">
        </div>
      @endif

      @if($type==='ad')
        <div class="field">
          <label>Bağlantı (tıklanınca gidilecek adres, isteğe bağlı)</label>
          <input name="body" value="{{ $editing->body ?? '' }}" placeholder="https://...">
        </div>
      @elseif($type==='quiz')
        <label style="margin-bottom:8px">Şıklar — doğru olanı işaretle</label>
        @for($i=0;$i<4;$i++)
          <div class="field" style="display:flex;gap:10px;align-items:center">
            <input type="radio" name="answer" value="{{ $i }}" {{ (int)$quiz['answer']===$i ? 'checked':'' }} style="width:20px;flex:none">
            <input name="opt{{ $i+1 }}" value="{{ $quiz['options'][$i] ?? '' }}" placeholder="{{ $i+1 }}. şık">
          </div>
        @endfor
        <div class="field">
          <label>Açıklama (cevaptan sonra gösterilir, isteğe bağlı)</label>
          <textarea name="explain" rows="3">{{ $quiz['explain'] }}</textarea>
        </div>
      @else
        <div class="field">
          <label>Metin</label>
          <textarea name="body" rows="{{ in_array($type,['service','blog','news']) ? 9 : 3 }}">{{ $editing->body ?? '' }}</textarea>
        </div>
      @endif

      <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <input type="checkbox" name="published" value="1" {{ (!$editing || $editing->published) ? 'checked' : '' }} style="width:18px">
        Yayında
      </label>

      <div style="margin-top:16px;display:flex;gap:8px">
        <button class="btn">{{ $editing ? 'Güncelle' : 'Ekle' }}</button>
        @if($editing)<a class="btn ghost" href="/panel/content?type={{ $type }}">İptal</a>@endif
      </div>
    </form>
  </div>

  <div class="card" style="padding:0;overflow-x:auto">
    <table>
      <thead><tr><th>{{ $type==='club' ? 'Kulüp' : 'Başlık' }}</th><th>Bilgi</th><th>Durum</th><th>İşlem</th></tr></thead>
      <tbody>
        @forelse($items as $c)
          <tr>
            <td><b>{{ $c->title }}</b></td>
            <td class="muted">
              {{ $c->province ? $c->province.' · ' : '' }}{{ $c->event_at ? $c->event_at->format('d.m.Y') : '' }}{{ $c->organizer ? ' · '.$c->organizer : '' }}
            </td>
            <td>@if($c->published)<span class="tag">yayında</span>@else<span class="tag gray">gizli</span>@endif</td>
            <td class="row-actions">
              <a class="btn sm ghost" href="/panel/content?type={{ $type }}&edit={{ $c->id }}">Düzenle</a>
              <form method="post" action="/panel/content/{{ $c->id }}/delete" onsubmit="return confirm('Bu kayıt silinsin mi?')">
                @csrf<button class="btn sm danger">Sil</button>
              </form>
            </td>
          </tr>
        @empty
          <tr><td colspan="4" class="muted" style="padding:24px;text-align:center">Kayıt yok.</td></tr>
        @endforelse
      </tbody>
    </table>
  </div>
@endsection
