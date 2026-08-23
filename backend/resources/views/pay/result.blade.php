<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ödeme Sonucu — TavlaTv</title>
<style>
  body{margin:0;background:#efeae1;color:#1c1a17;font-family:'Segoe UI',system-ui,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:16px}
  .r{background:#fff;border:1px solid #ded7ca;border-radius:16px;padding:32px;max-width:360px}
  .ic{font-size:3rem}
  h1{margin:8px 0}
  a{display:inline-block;margin-top:18px;padding:11px 24px;background:#a83a2b;color:#fff;
    text-decoration:none;border-radius:999px;font-weight:700}
</style></head><body>
  <div class="r">
    <div class="ic">{{ $ok ? '✅' : '❌' }}</div>
    <h1>{{ $ok ? 'Ödeme Başarılı' : 'Ödeme Başarısız' }}</h1>
    <p style="color:#5e574c">{{ $ok ? 'Üyeliğin etkinleştirildi.' : ($msg ?: 'İşlem tamamlanamadı.') }}</p>
    <a href="/">Siteye Dön</a>
  </div>
</body></html>
