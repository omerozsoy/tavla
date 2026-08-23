@extends('panel.layout')
@section('content')
  <h1>Bildirimler</h1>

  <div class="card">
    <h2>Bildirim Gönder</h2>
    <form method="post" action="/panel/notifications">
      @csrf
      <div class="grid">
        <div>
          <label>Kime</label>
          <select name="target" id="target" onchange="document.getElementById('userRow').style.display = this.value==='user' ? 'block' : 'none'">
            <option value="all">Tüm üyeler ({{ $memberCount }})</option>
            <option value="user" @selected(old('target')==='user')>Tek üye</option>
          </select>
        </div>
        <div>
          <label>İkon</label>
          <select name="icon">
            <option value="bell">🔔 Zil</option>
            <option value="crown">👑 Taç (ünvan)</option>
            <option value="medal">🏅 Madalya</option>
            <option value="star">⭐ Yıldız</option>
            <option value="trophy">🏆 Kupa</option>
            <option value="coin">🪙 Coin</option>
          </select>
        </div>
      </div>
      <div class="field" id="userRow" style="display:{{ old('target')==='user' ? 'block' : 'none' }};margin-top:14px">
        <label>Üye (nickname, e-posta veya id)</label>
        <input name="query" value="{{ old('query') }}" placeholder="ör. master123">
        @error('query')<div class="err">{{ $message }}</div>@enderror
      </div>
      <div class="field" style="margin-top:14px">
        <label>Başlık</label>
        <input name="title" value="{{ old('title') }}" required placeholder="ör. 1800 puanı geçtin — Master oldun!">
        @error('title')<div class="err">{{ $message }}</div>@enderror
      </div>
      <div class="field">
        <label>Mesaj (opsiyonel)</label>
        <textarea name="body" rows="3" placeholder="Detay metni…">{{ old('body') }}</textarea>
      </div>
      <button class="btn" style="margin-top:6px">Gönder</button>
    </form>
  </div>

  <div class="card" style="padding:0;overflow-x:auto">
    <table>
      <thead>
        <tr><th>Kime</th><th>Başlık</th><th>Mesaj</th><th>Durum</th><th>Tarih</th></tr>
      </thead>
      <tbody>
        @forelse($recent as $n)
          <tr>
            <td>{{ $names[$n->user_id] ?? ('#'.$n->user_id) }}</td>
            <td><b>{{ $n->title }}</b></td>
            <td class="muted">{{ \Illuminate\Support\Str::limit($n->body, 60) }}</td>
            <td><span class="tag {{ $n->read ? 'gray' : '' }}">{{ $n->read ? 'okundu' : 'yeni' }}</span></td>
            <td class="muted">{{ optional($n->created_at)->format('d.m.Y H:i') }}</td>
          </tr>
        @empty
          <tr><td colspan="5" class="muted" style="padding:24px;text-align:center">Henüz bildirim yok.</td></tr>
        @endforelse
      </tbody>
    </table>
  </div>
@endsection
