<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ödeme — TavlaTv</title>
<style>
  :root{ --bg:#efeae1; --ink:#1c1a17; --muted:#6b6357; --line:#ded7ca; --accent:#a83a2b; --accent2:#c65a3f; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
  .pc{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;max-width:420px;width:100%;
    box-shadow:0 18px 50px rgba(60,40,30,.12)}
  .brandline{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.05rem;margin:0 0 2px}
  .brandline .dot{width:9px;height:9px;border-radius:999px;background:var(--accent)}
  .sub{color:var(--muted);font-size:.9rem;margin:0 0 16px}
  .sub .amt{font-weight:800;color:var(--accent)}

  /* Canli kart onizleme */
  .card{position:relative;border-radius:16px;padding:18px;height:190px;color:#fff;overflow:hidden;
    background:linear-gradient(135deg,#2a2622,#4a3f38 60%,#6b5a4d);
    box-shadow:0 10px 26px rgba(0,0,0,.28);margin-bottom:18px;transition:background .4s}
  .card.visa{background:linear-gradient(135deg,#1a1f71,#3b4bb5 60%,#5a6bd8)}
  .card.mc{background:linear-gradient(135deg,#7a1f12,#c0392b 55%,#e8873a)}
  .card.troy{background:linear-gradient(135deg,#0a5c46,#12a061 60%,#4fd39c)}
  .card.amex{background:linear-gradient(135deg,#1f6f8b,#2e97b8 60%,#63c6dd)}
  .card-top{display:flex;justify-content:space-between;align-items:flex-start}
  .chip{width:42px;height:32px;border-radius:6px;background:linear-gradient(135deg,#e8d9a8,#c9a94e);
    position:relative;opacity:.95}
  .chip::after{content:"";position:absolute;inset:6px 8px;border:1px solid rgba(0,0,0,.25);border-radius:3px}
  .brandlogo{font-weight:800;letter-spacing:.5px;font-size:1rem;text-transform:uppercase;opacity:.95}
  .card-num{font-size:1.28rem;letter-spacing:2px;margin:26px 0 16px;font-variant-numeric:tabular-nums;
    text-shadow:0 1px 2px rgba(0,0,0,.3)}
  .card-foot{display:flex;justify-content:space-between;font-size:.72rem;text-transform:uppercase;opacity:.9}
  .card-foot .lbl{font-size:.58rem;opacity:.7;display:block;margin-bottom:2px}
  .card-name{max-width:62%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  label{display:block;font-size:.8rem;font-weight:700;color:var(--muted);margin:12px 0 5px}
  input{width:100%;padding:13px;border:1px solid var(--line);border-radius:11px;font-size:16px;
    background:#fbf9f5;transition:border-color .15s,box-shadow .15s;font-variant-numeric:tabular-nums}
  input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(168,58,43,.14);background:#fff}
  .row{display:flex;gap:10px}
  .row>div{flex:1}
  button{width:100%;margin-top:20px;padding:15px;border:none;border-radius:12px;
    background:linear-gradient(135deg,var(--accent),var(--accent2));
    color:#fff;font-weight:800;font-size:1.02rem;cursor:pointer;transition:filter .15s;
    display:flex;align-items:center;justify-content:center;gap:8px}
  button:hover{filter:brightness(1.06)}
  .secure{display:flex;align-items:center;justify-content:center;gap:6px;
    color:var(--muted);font-size:.76rem;margin:12px 0 0;text-align:center}
</style></head><body>
  <form class="pc" method="post" action="{{ $submitUrl }}" autocomplete="on" @if(!empty($preview)) onsubmit="alert('Bu bir önizlemedir — gerçek ödeme için Mağaza › Sepet üzerinden ilerleyin.');return false;" @endif>
    @csrf
    <p class="brandline"><span class="dot"></span> TavlaTv · Güvenli Ödeme @if(!empty($preview))<span style="margin-left:auto;font-size:.7rem;color:var(--muted);font-weight:600">ÖNİZLEME</span>@endif</p>
    <p class="sub">
      @if($payment->kind === 'coins'){{ number_format((int)$payment->coins, 0, ',', '.') }} coin@else{{ strtoupper($payment->plan ?? '') }} · {{ $payment->period==='yearly'?'Yıllık':'Aylık' }}@endif
      · <span class="amt">{{ number_format($payment->amount/100, 2, ',', '.') }} ₺</span>
    </p>

    <!-- Canli kart onizleme -->
    <div class="card" id="cardView">
      <div class="card-top">
        <div class="chip"></div>
        <div class="brandlogo" id="brandLogo"></div>
      </div>
      <div class="card-num" id="numView">•••• •••• •••• ••••</div>
      <div class="card-foot">
        <div class="card-name"><span class="lbl">Kart Sahibi</span><span id="nameView">AD SOYAD</span></div>
        <div><span class="lbl">Son Kul.</span><span id="expView">AA/YY</span></div>
      </div>
    </div>

    <label>Kart Numarası</label>
    <input id="number" name="number" inputmode="numeric" autocomplete="cc-number"
      placeholder="0000 0000 0000 0000" maxlength="23" required>

    <label>Kart Üzerindeki İsim</label>
    <input id="holder" name="holder" autocomplete="cc-name" placeholder="Ad Soyad">

    <div class="row">
      <div><label>Ay</label><input id="month" name="month" inputmode="numeric" autocomplete="cc-exp-month" placeholder="AA" maxlength="2" required></div>
      <div><label>Yıl</label><input id="year" name="year" inputmode="numeric" autocomplete="cc-exp-year" placeholder="YY" maxlength="2" required></div>
      <div><label>CVV</label><input id="cvv" name="cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" required></div>
    </div>

    <button type="submit">🔒 Güvenli Öde · {{ number_format($payment->amount/100, 2, ',', '.') }} ₺</button>
    <p class="secure">🔐 256-bit SSL · 3D Secure · Kart bilgileriniz saklanmaz, doğrudan bankaya iletilir.</p>
  </form>

<script>
(function(){
  var num = document.getElementById('number');
  var holder = document.getElementById('holder');
  var month = document.getElementById('month');
  var year = document.getElementById('year');
  var cardView = document.getElementById('cardView');
  var numView = document.getElementById('numView');
  var nameView = document.getElementById('nameView');
  var expView = document.getElementById('expView');
  var brandLogo = document.getElementById('brandLogo');

  function onlyDigits(s){ return (s||'').replace(/\D/g,''); }

  function detectBrand(d){
    if(/^4/.test(d)) return {cls:'visa', name:'VISA'};
    if(/^9792/.test(d)) return {cls:'troy', name:'TROY'};
    if(/^3[47]/.test(d)) return {cls:'amex', name:'AMEX'};
    if(/^(5[1-5]|22[2-9]|2[3-6]|27[01]|2720)/.test(d)) return {cls:'mc', name:'MASTERCARD'};
    return {cls:'', name:''};
  }

  function formatNumber(){
    var d = onlyDigits(num.value).slice(0,19);
    var groups = d.match(/.{1,4}/g);
    num.value = groups ? groups.join(' ') : '';
    // Onizleme
    var shown = (d + '••••••••••••••••').slice(0,16);
    numView.textContent = (shown.match(/.{1,4}/g)||[]).join(' ');
    var b = detectBrand(d);
    cardView.className = 'card ' + b.cls;
    brandLogo.textContent = b.name;
  }
  num.addEventListener('input', formatNumber);

  holder.addEventListener('input', function(){
    nameView.textContent = holder.value.trim() ? holder.value.toUpperCase() : 'AD SOYAD';
  });
  function updExp(){
    var m = onlyDigits(month.value).slice(0,2);
    var y = onlyDigits(year.value).slice(0,2);
    month.value = m; year.value = y;
    expView.textContent = (m||'AA') + '/' + (y||'YY');
  }
  month.addEventListener('input', updExp);
  year.addEventListener('input', updExp);
  document.getElementById('cvv').addEventListener('input', function(e){
    e.target.value = onlyDigits(e.target.value).slice(0,4);
  });
})();
</script>
</body></html>
