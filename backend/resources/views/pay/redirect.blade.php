<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Yönlendiriliyor…</title></head>
<body style="font-family:system-ui;text-align:center;padding:40px;color:#5e574c">
  Bankaya yönlendiriliyorsunuz…
  <form id="gf" method="post" action="{{ $action }}">
    @foreach($fields as $k => $v)
      <input type="hidden" name="{{ $k }}" value="{{ $v }}">
    @endforeach
  </form>
  <script>document.getElementById('gf').submit();</script>
</body></html>
