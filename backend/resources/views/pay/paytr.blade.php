<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Güvenli Ödeme — TavlaTv</title>
<style>
  html,body{margin:0;background:#efeae1}
  .wrap{max-width:520px;margin:0 auto;padding:12px}
  #paytriframe{width:100%;min-height:520px;border:0}
</style>
{{-- PayTR iframe yukseklik otomatik ayarlayicisi (resmi) --}}
<script src="https://www.paytr.com/js/iframeResizer.min.js"></script>
</head><body>
  <div class="wrap">
    {{-- Kart formu PayTR tarafinda barinir; kart verisi bize ASLA ulasmaz (PCI PayTR'de). --}}
    <iframe src="{{ $iframeUrl }}" id="paytriframe" frameborder="0" scrolling="no"></iframe>
  </div>
  <script>iFrameResize({}, '#paytriframe');</script>
</body></html>
