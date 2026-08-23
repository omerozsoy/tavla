<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TavlaTv — Yönetim</title>
  <style>
    :root{
      --cream:#f4efe6;--cream-deep:#efeae1;--white:#fff;--line:#ded7ca;
      --ink:#1c1a17;--muted:#5e574c;--faint:#8a8377;--brick:#a83a2b;--brick-light:#c9563f;
    }
    *{box-sizing:border-box}
    body{margin:0;background:var(--cream-deep);color:var(--ink);
      font-family:'Segoe UI',system-ui,sans-serif;font-size:15px;line-height:1.5}
    a{color:var(--brick);text-decoration:none}
    .panel{display:flex;min-height:100vh}
    .side{width:230px;flex:none;background:var(--ink);color:var(--cream);
      display:flex;flex-direction:column;padding:18px 0}
    .side .brand{font-size:1.3rem;font-weight:800;padding:0 20px 18px;letter-spacing:.02em}
    .side .brand span{display:block;font-size:.72rem;font-weight:600;color:var(--faint);
      text-transform:uppercase;letter-spacing:.12em;margin-top:2px}
    .side nav{display:flex;flex-direction:column;gap:2px;padding:0 10px}
    .side nav a{padding:11px 14px;border-radius:8px;color:var(--cream);font-weight:500}
    .side nav a:hover{background:rgba(255,255,255,.06)}
    .side nav a.active{background:var(--brick);color:#fff}
    .side .logout{margin-top:auto;padding:0 14px}
    .side .logout button{width:100%;padding:10px;background:none;border:1px solid #3a342d;
      color:var(--cream);border-radius:8px;cursor:pointer}
    .main{flex:1;padding:28px 32px;max-width:1100px}
    h1{font-size:1.6rem;margin:0 0 20px}
    .flash{padding:12px 16px;border-radius:8px;margin-bottom:18px;font-weight:600}
    .flash.ok{background:#dff0e3;color:#1f6b3a;border:1px solid #b7ddc2}
    .card{background:var(--white);border:1px solid var(--line);border-radius:12px;
      padding:22px;margin-bottom:22px}
    .card h2{margin:0 0 16px;font-size:1.1rem}
    label{display:block;font-size:.82rem;font-weight:600;color:var(--muted);margin-bottom:5px}
    input,select,textarea{width:100%;padding:11px 13px;border:1px solid var(--line);
      border-radius:8px;background:var(--cream);color:var(--ink);font-size:.98rem;font-family:inherit}
    textarea{resize:vertical;line-height:1.55}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}
    .field{margin-bottom:14px}
    .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border:none;
      border-radius:8px;background:var(--brick);color:#fff;font-weight:600;cursor:pointer;font-size:.95rem}
    .btn:hover{background:var(--brick-light)}
    .btn.ghost{background:none;border:1px solid var(--line);color:var(--ink)}
    .btn.danger{background:none;border:1px solid var(--brick);color:var(--brick)}
    .btn.sm{padding:6px 12px;font-size:.85rem}
    table{width:100%;border-collapse:collapse}
    th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
    th{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--faint)}
    tr:hover td{background:var(--cream)}
    .tag{display:inline-block;font-size:.68rem;font-weight:700;text-transform:uppercase;
      padding:2px 7px;border-radius:999px;background:var(--brick);color:#fff}
    .tag.gray{background:var(--faint)}
    .row-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .inline{display:flex;gap:6px;align-items:center}
    .inline input{width:110px}
    .search{display:flex;gap:8px;margin-bottom:16px;max-width:420px}
    .muted{color:var(--muted);font-size:.9rem}
    .pager{display:flex;gap:8px;margin-top:16px}
    .type-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
    .type-tabs a{padding:8px 16px;border:1px solid var(--line);border-radius:8px;
      background:var(--white);color:var(--ink);font-weight:600}
    .type-tabs a.active{background:var(--brick);color:#fff;border-color:var(--brick)}
    .err{color:var(--brick);font-size:.85rem;margin-top:6px}
    @media(max-width:760px){.side{width:64px}.side .brand,.side nav a span{display:none}
      .main{padding:18px}}
  </style>
</head>
<body>
  <div class="panel">
    <aside class="side">
      <div class="brand">TavlaTv<span>Yönetim</span></div>
      <nav>
        <a href="/panel/users" class="{{ request()->is('panel/users') ? 'active' : '' }}">Üyeler</a>
        <a href="/panel/tournaments" class="{{ request()->is('panel/tournaments') ? 'active' : '' }}">Turnuvalar</a>
        <a href="/panel/content" class="{{ request()->is('panel/content*') ? 'active' : '' }}">İçerik</a>
        <a href="/panel/notifications" class="{{ request()->is('panel/notifications*') ? 'active' : '' }}">Bildirimler</a>
        <a href="/" target="_blank">↗ Siteyi Aç</a>
      </nav>
      <form method="post" action="/panel/logout" class="logout">@csrf<button>Çıkış Yap</button></form>
    </aside>
    <main class="main">
      @if(session('ok'))<div class="flash ok">{{ session('ok') }}</div>@endif
      @yield('content')
    </main>
  </div>
</body>
</html>
