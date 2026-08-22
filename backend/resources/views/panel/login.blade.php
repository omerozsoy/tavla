<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TavlaTv — Yönetim Girişi</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#efeae1;color:#1c1a17;font-family:'Segoe UI',system-ui,sans-serif}
    .box{background:#fff;border:1px solid #ded7ca;border-radius:14px;padding:32px;
      width:min(380px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.08)}
    .logo{font-size:1.6rem;font-weight:800;margin-bottom:4px}
    .logo span{color:#a83a2b}
    .sub{color:#8a8377;font-size:.85rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:22px}
    label{display:block;font-size:.82rem;font-weight:600;color:#5e574c;margin:14px 0 5px}
    input{width:100%;padding:12px 13px;border:1px solid #ded7ca;border-radius:8px;
      background:#f4efe6;font-size:1rem;box-sizing:border-box}
    button{width:100%;margin-top:20px;padding:12px;border:none;border-radius:8px;
      background:#a83a2b;color:#fff;font-weight:700;font-size:1rem;cursor:pointer}
    button:hover{background:#c9563f}
    .err{color:#a83a2b;font-size:.85rem;margin-top:12px}
  </style>
</head>
<body>
  <form class="box" method="post" action="/panel/login">
    @csrf
    <div class="logo">Tavla<span>Tv</span></div>
    <div class="sub">Yönetim Paneli</div>
    <label>E-posta</label>
    <input type="email" name="email" value="{{ old('email') }}" autofocus required>
    <label>Şifre</label>
    <input type="password" name="password" required>
    @error('email')<div class="err">{{ $message }}</div>@enderror
    <button type="submit">Giriş Yap</button>
  </form>
</body>
</html>
