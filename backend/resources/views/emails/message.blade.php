@php
  // Marka e-posta sablonu (verify kod+link + reset ortak). Email-safe: tablo + inline stil, web-safe font.
  // Coklu-domain: marka ZIYARET EDILEN host'tan belirlenir. Cagiran payload'da 'brand' verirse onu kullan,
  // yoksa request host'undan coz. tavlatv.com -> TR/TavlaTV + email-logo.png ; gammontv.com -> EN/GammonTV
  // (logo dosyasi gelene kadar metin wordmark). NOT: $brand asagida RENK degiskeni; marka dizisini $b tutar.
  $b = (isset($brand) && is_array($brand)) ? $brand : \App\Support\Brand::current();
  $isEn   = (($b['locale'] ?? 'tr') === 'en');
  $name   = (string) ($b['name'] ?? 'TavlaTV');
  $origin = rtrim((string) ($b['origin'] ?? config('app.url')), '/');
  $host   = preg_replace('#^https?://#', '', $origin);          // footer link metni: www.gammontv.com
  $logo   = ($b['email_logo'] ?? null) ? $origin.$b['email_logo'] : null; // null -> metin wordmark

  $tagline      = (string) ($b['email_tagline'] ?? ($isEn ? 'Play Backgammon Online' : 'Türkiye\'nin Tavla Portalı'));
  $codeLabel    = $isEn ? 'Verification Code' : 'Doğrulama Kodu';
  $signature    = $isEn ? 'Warm regards' : 'Sevgiler';
  $fallbackHint = $isEn ? 'If the button does not work, paste this link into your browser:' : 'Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:';

  // Renk paleti (markadan bagimsiz ortak terracotta).
  $brand = '#c9563f';       // coral (marka aksani)
  $brandDeep = '#a83a2b';   // brick (koyu aksan)
  $ink = '#1c1a17';
  $muted = '#857a6b';
  $cream = '#f4efe6';       // email-logo.png zemini ile birebir
  $soft = '#faf7f1';        // kod hucresi zemini
  $border = '#e6ded0';
@endphp
<!doctype html>
<html lang="{{ $isEn ? 'en' : 'tr' }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <title>{{ $heading ?? $name }}</title>
</head>
<body style="margin:0;padding:0;background:{{ $cream }};-webkit-font-smoothing:antialiased;">
  <!-- on iletisim metni (gelen kutusu onizlemesi) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{ $intro ?? $name }}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{ $cream }};padding:40px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;">

          <!-- Logo (marka gorseli varsa; yoksa metin wordmark) -->
          <tr>
            <td align="center" style="padding-bottom:22px;">
              @if ($logo)
                <img src="{{ $logo }}" width="210" alt="{{ $name }} — {{ $tagline }}"
                     style="display:block;width:210px;max-width:66%;height:auto;border:0;outline:none;text-decoration:none;">
              @else
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:800;letter-spacing:-0.5px;color:{{ $brandDeep }};">{{ $name }}</div>
              @endif
            </td>
          </tr>

          <!-- Kart -->
          <tr>
            <td style="background:#ffffff;border:1px solid {{ $border }};border-radius:18px;box-shadow:0 10px 30px rgba(28,26,23,0.06);overflow:hidden;">
              <!-- ust coral aksan seridi -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height:4px;background:{{ $brand }};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:34px 34px 30px;font-family:Arial,Helvetica,sans-serif;">
                    <h1 style="margin:0 0 12px;font-size:23px;font-weight:800;letter-spacing:-0.3px;color:{{ $ink }};">{{ $heading ?? ($isEn ? 'Hello!' : 'Merhaba!') }}</h1>
                    <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#453f37;">{{ $intro }}</p>

                    @isset($code)
                      <!-- OTP kodu: tek hucre (kopyalayinca bosluksuz gelsin diye) -->
                      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:{{ $brandDeep }};">{{ $codeLabel }}</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                        <tr>
                          <td align="center" valign="middle" bgcolor="{{ $soft }}"
                              style="padding:16px 24px;border:1px solid {{ $border }};border-radius:12px;font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:800;letter-spacing:12px;text-indent:12px;color:{{ $brandDeep }};">{{ $code }}</td>
                        </tr>
                      </table>
                    @endisset

                    @isset($url)
                      <!-- Ana aksiyon butonu -->
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:{{ isset($code) ? '6px' : '4px' }} 0 24px;">
                        <tr>
                          <td align="center" bgcolor="{{ $brand }}" style="border-radius:999px;">
                            <a href="{{ $url }}" target="_blank"
                               style="display:inline-block;padding:15px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">
                              {{ $buttonText ?? ($isEn ? 'Continue' : 'Devam Et') }}
                            </a>
                          </td>
                        </tr>
                      </table>
                    @endisset

                    @isset($outro)
                      <p style="margin:0;font-size:13px;line-height:1.6;color:{{ $muted }};">{{ $outro }}</p>
                    @endisset

                    <p style="margin:22px 0 0;font-size:14px;color:{{ $ink }};">{{ $signature }}, <strong style="color:{{ $brandDeep }};">{{ $name }}</strong></p>

                    @isset($url)
                      <hr style="border:none;border-top:1px solid {{ $border }};margin:26px 0 16px;">
                      <p style="margin:0;font-size:11px;line-height:1.55;color:{{ $muted }};">
                        {{ $fallbackHint }}<br>
                        <a href="{{ $url }}" style="color:{{ $brand }};word-break:break-all;">{{ $url }}</a>
                      </p>
                    @endisset
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 10px 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:{{ $muted }};">
              © {{ date('Y') }} {{ $name }} · <a href="{{ $origin }}" style="color:{{ $muted }};text-decoration:underline;">{{ $host }}</a><br>
              <span style="color:#a89d8c;">{{ $tagline }}</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
