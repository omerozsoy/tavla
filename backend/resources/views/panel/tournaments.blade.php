@extends('panel.layout')
@section('content')
  <h1>Turnuvalar</h1>

  <div class="card">
    <h2>Yeni Turnuva Oluştur</h2>
    <form method="post" action="/panel/tournaments">
      @csrf
      <div class="field">
        <label>Turnuva Adı</label>
        <input name="name" value="{{ old('name') }}" required>
        @error('name')<div class="err">{{ $message }}</div>@enderror
      </div>
      <div class="grid">
        <div>
          <label>Kişi Sayısı</label>
          <select name="size">
            <option value="4">4</option>
            <option value="8" selected>8</option>
            <option value="16">16</option>
            <option value="32">32</option>
            <option value="64">64</option>
            <option value="128">128</option>
            <option value="256">256</option>
            <option value="0">Sınırsız</option>
          </select>
        </div>
        <div>
          <label>Ödül (coin)</label>
          <input type="number" name="prize_coins" min="0" value="0">
        </div>
        <div>
          <label>Katılım Ücreti (coin)</label>
          <input type="number" name="entry_fee" min="0" value="0">
        </div>
      </div>
      <button class="btn" style="margin-top:18px">Oluştur</button>
    </form>
  </div>

  <div class="card" style="padding:0;overflow-x:auto">
    <table>
      <thead>
        <tr><th>Ad</th><th>Durum</th><th>Katılım</th><th>Ödül</th><th>İşlem</th></tr>
      </thead>
      <tbody>
        @forelse($list as $tr)
          <tr>
            <td><b>{{ $tr->name }}</b></td>
            <td><span class="tag {{ $tr->status==='finished'?'gray':'' }}">{{ $tr->status }}</span></td>
            <td>{{ count($tr->players ?? []) }}/{{ $tr->size }}</td>
            <td>{{ $tr->prize_coins ?: '—' }}</td>
            <td class="row-actions">
              @if($tr->status !== 'finished')
                <form method="post" action="/panel/tournaments/{{ $tr->id }}/finish">
                  @csrf<button class="btn sm ghost">Bitir</button>
                </form>
              @endif
              <form method="post" action="/panel/tournaments/{{ $tr->id }}/delete" onsubmit="return confirm('Bu turnuva silinsin mi?')">
                @csrf<button class="btn sm danger">Sil</button>
              </form>
            </td>
          </tr>
        @empty
          <tr><td colspan="5" class="muted" style="padding:24px;text-align:center">Turnuva yok.</td></tr>
        @endforelse
      </tbody>
    </table>
  </div>
@endsection
