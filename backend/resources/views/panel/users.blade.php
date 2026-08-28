@extends('panel.layout')
@section('content')
  <h1>Üyeler</h1>

  <form class="search" method="get">
    <input name="q" value="{{ $q }}" placeholder="İsim veya e-posta ara…">
    <button class="btn">Ara</button>
  </form>

  <div class="card" style="padding:0;overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>Üye</th><th>E-posta</th><th>Rating</th><th>Coin</th><th>G/M</th><th>İşlemler</th>
        </tr>
      </thead>
      <tbody>
        @forelse($users as $u)
          <tr>
            <td>
              <b>{{ $u->nickname ?: $u->first_name ?: 'Oyuncu' }}</b>
              @if($u->is_admin)<span class="tag">admin</span>@endif
              @if($u->banned_at)<span class="tag">yasaklı</span>@endif
              @if($u->plan_active !== 'free')<span class="tag">{{ $u->plan_active }}</span>@endif
            </td>
            <td class="muted">
              {{ $u->email }}<br>
              @if($u->email_verified_at)
                <span class="tag" style="background:#1f8a4c;color:#fff" title="Doğrulandı: {{ $u->email_verified_at->format('d.m.Y H:i') }}">✓ doğrulandı</span>
              @else
                <span class="tag" style="background:#c0392b;color:#fff">✗ doğrulanmadı</span>
              @endif
            </td>
            <td>
              <div class="tag" style="margin-bottom:4px" title="Mevcut ünvan (rating'e göre)">
                {{ \App\Http\Controllers\PanelController::levelLabel((int)($u->rating ?? 1500)) }}
              </div>
              <form method="post" action="/panel/users/{{ $u->id }}" class="inline">
                @csrf<input type="hidden" name="action" value="rating">
                <input type="number" name="rating" value="{{ $u->rating ?? 1500 }}" min="100" max="4000" style="width:80px">
                <button class="btn sm">Kaydet</button>
              </form>
              <form method="post" action="/panel/users/{{ $u->id }}" class="inline" style="margin-top:4px">
                @csrf<input type="hidden" name="action" value="level">
                @php($curLabel = \App\Http\Controllers\PanelController::levelLabel((int)($u->rating ?? 1500)))
                <select name="level_min" style="width:auto">
                  @foreach($levels as $label => $min)
                    <option value="{{ $min }}" @selected($label === $curLabel)>{{ $label }}</option>
                  @endforeach
                </select>
                <button class="btn sm ghost" title="Secilen unvana gore puani ayarlar">Ünvan Ata</button>
              </form>
            </td>
            <td>
              <form method="post" action="/panel/users/{{ $u->id }}" class="inline">
                @csrf<input type="hidden" name="action" value="coins">
                <input type="number" name="coins" value="{{ $u->coins ?? 0 }}" min="0">
                <button class="btn sm">Kaydet</button>
              </form>
            </td>
            <td>{{ $u->wins ?? 0 }}/{{ $u->losses ?? 0 }}</td>
            <td class="row-actions">
              <form method="post" action="/panel/users/{{ $u->id }}">
                @csrf<input type="hidden" name="action" value="ban">
                <button class="btn sm ghost">{{ $u->banned_at ? 'Yasağı Kaldır' : 'Yasakla' }}</button>
              </form>
              <form method="post" action="/panel/users/{{ $u->id }}">
                @csrf<input type="hidden" name="action" value="admin">
                <button class="btn sm ghost">{{ $u->is_admin ? 'Yetkiyi Al' : 'Yönetici Yap' }}</button>
              </form>
              <form method="post" action="/panel/users/{{ $u->id }}">
                @csrf<input type="hidden" name="action" value="verify">
                <button class="btn sm ghost">{{ $u->email_verified_at ? 'Doğrulamayı Kaldır' : 'E-postayı Doğrula' }}</button>
              </form>
              <form method="post" action="/panel/users/{{ $u->id }}" class="inline">
                @csrf<input type="hidden" name="action" value="plan">
                <select name="plan" style="width:auto">
                  <option value="free" @selected($u->plan_active==='free')>Ücretsiz</option>
                  <option value="star" @selected($u->plan_active==='star' || $u->plan_active==='starpro')>Premium</option>
                </select>
                <input type="number" name="days" value="365" min="1" title="Gün" style="width:70px">
                <button class="btn sm ghost">Plan Ver</button>
              </form>
            </td>
          </tr>
        @empty
          <tr><td colspan="6" class="muted" style="padding:24px;text-align:center">Üye bulunamadı.</td></tr>
        @endforelse
      </tbody>
    </table>
  </div>

  <div class="pager">
    @if($users->onFirstPage())
      <span class="btn ghost sm" style="opacity:.4">‹ Önceki</span>
    @else
      <a class="btn ghost sm" href="{{ $users->previousPageUrl() }}">‹ Önceki</a>
    @endif
    <span class="muted" style="align-self:center">{{ $users->currentPage() }} / {{ $users->lastPage() }} · {{ $users->total() }} üye</span>
    @if($users->hasMorePages())
      <a class="btn ghost sm" href="{{ $users->nextPageUrl() }}">Sonraki ›</a>
    @else
      <span class="btn ghost sm" style="opacity:.4">Sonraki ›</span>
    @endif
  </div>
@endsection
