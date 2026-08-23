@extends('panel.layout')
@section('content')
  <h1>Mail Testi</h1>

  <div class="card">
    <h2>Mevcut ayar</h2>
    <table>
      <tbody>
        <tr><td class="muted">Sürücü (MAIL_MAILER)</td>
          <td><b>{{ $cfg['mailer'] }}</b>
            @if($cfg['mailer'] === 'log')
              <span class="tag" style="background:#f6d5cf;color:#9b2c1c">gerçek gönderim YOK — log'a yazar</span>
            @else
              <span class="tag">SMTP aktif</span>
            @endif
          </td></tr>
        <tr><td class="muted">Host</td><td>{{ $cfg['host'] ?: '—' }}</td></tr>
        <tr><td class="muted">Port</td><td>{{ $cfg['port'] ?: '—' }}</td></tr>
        <tr><td class="muted">Kullanıcı</td><td>{{ $cfg['username'] ?: '—' }}</td></tr>
        <tr><td class="muted">Gönderen (FROM)</td><td>{{ $cfg['from'] ?: '—' }} ({{ $cfg['from_name'] ?: '—' }})</td></tr>
      </tbody>
    </table>
    @if($cfg['mailer'] === 'log')
      <p class="muted" style="margin-top:12px">
        Sürücü <b>log</b> olduğu için e-postalar gelen kutusuna gitmez; sadece
        <code>storage/logs/laravel.log</code> dosyasına yazılır. Gerçek teslim için
        <code>.env</code>'de SMTP ayarla ve <code>php artisan config:clear</code> çalıştır.
      </p>
    @endif
  </div>

  <div class="card">
    <h2>Test e-postası gönder</h2>
    <form method="post" action="/panel/mail">
      @csrf
      <div class="field">
        <label>Alıcı e-posta</label>
        <input name="to" type="email" value="{{ old('to', $defaultTo) }}" required placeholder="ornek@gmail.com">
        @error('to')<div class="err">{{ $message }}</div>@enderror
      </div>
      <button class="btn" style="margin-top:6px">Test gönder</button>
    </form>
  </div>
@endsection
