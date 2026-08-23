<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ödeme — TavlaTv</title>
<style>
  body{margin:0;background:#efeae1;color:#1c1a17;font-family:'Segoe UI',system-ui,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
  .pc{background:#fff;border:1px solid #ded7ca;border-radius:16px;padding:26px;max-width:380px;width:100%}
  h1{font-size:1.3rem;margin:0 0 4px}
  .sub{color:#5e574c;font-size:.9rem;margin:0 0 18px}
  label{display:block;font-size:.82rem;font-weight:600;color:#5e574c;margin:12px 0 5px}
  input{width:100%;padding:12px;border:1px solid #ded7ca;border-radius:8px;font-size:16px;box-sizing:border-box}
  .row{display:flex;gap:10px}
  button{width:100%;margin-top:20px;padding:13px;border:none;border-radius:10px;background:#a83a2b;
    color:#fff;font-weight:800;font-size:1rem;cursor:pointer}
  .amt{font-weight:800;color:#a83a2b}
</style></head><body>
  <form class="pc" method="post" action="{{ route('pay.submit', $payment->id) }}">
    @csrf
    <h1>Ödeme</h1>
    <p class="sub">{{ strtoupper($payment->plan) }} · {{ $payment->period==='yearly'?'Yıllık':'Aylık' }}
      · <span class="amt">{{ number_format($payment->amount/100, 2, ',', '.') }} ₺</span></p>
    <label>Kart Numarası</label>
    <input name="number" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" required>
    <div class="row">
      <div style="flex:1"><label>Ay</label><input name="month" inputmode="numeric" placeholder="AA" maxlength="2" required></div>
      <div style="flex:1"><label>Yıl</label><input name="year" inputmode="numeric" placeholder="YY" maxlength="4" required></div>
      <div style="flex:1"><label>CVV</label><input name="cvv" inputmode="numeric" placeholder="123" maxlength="4" required></div>
    </div>
    <button>Güvenli Öde</button>
  </form>
</body></html>
