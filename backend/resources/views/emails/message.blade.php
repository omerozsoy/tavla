@php
  // Marka e-posta sablonu (verify kod+link + reset ortak). Email-safe: tablo + inline stil, web-safe font.
  $logo = rtrim(config('app.url'), '/').'/email-logo.png'; // wordmark logo (krem zemin -> sayfa bg ile dikissiz)
  $brand = '#c9563f';       // coral (marka aksani)
  $brandDeep = '#a83a2b';   // brick (koyu aksan)
  $ink = '#1c1a17';
  $muted = '#857a6b';
  $cream = '#f4efe6';       // email-logo.png zemini ile birebir
  $soft = '#faf7f1';        // kod hucresi zemini
  $border = '#e6ded0';
@endphp
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <title>{{ $heading ?? 'TavlaTV' }}</title>
</head>
<body style="margin:0;padding:0;background:{{ $cream }};-webkit-font-smoothing:antialiased;">
  <!-- on iletisim metni (gelen kutusu onizlemesi) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{ $intro ?? 'TavlaTV' }}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{ $cream }};padding:40px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:22px;">
              <img src="{{ $logo }}" width="210" alt="TavlaTV — Türkiye'nin Tavla Portalı"
                   style="display:block;width:210px;max-width:66%;height:auto;border:0;outline:none;text-decoration:none;">
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
                    <h1 style="margin:0 0 12px;font-size:23px;font-weight:800;letter-spacing:-0.3px;color:{{ $ink }};">{{ $heading ?? 'Merhaba!' }}</h1>
                    <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#453f37;">{{ $intro }}</p>

                    @isset($code)
                      <!-- OTP kodu: etiket + haneli hucreler -->
                      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:{{ $brandDeep }};">Doğrulama Kodu</p>
                      <table role="presentation" cellpadding="0" cellspacing="7" style="margin:0 0 22px;">
                        <tr>
                          @foreach (str_split((string) $code) as $digit)
                            <td align="center" valign="middle" width="46" bgcolor="{{ $soft }}"
                                style="width:46px;height:56px;border:1px solid {{ $border }};border-radius:11px;font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:800;color:{{ $brandDeep }};">
                              {{ $digit }}
                            </td>
                          @endforeach
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
                              {{ $buttonText ?? 'Devam Et' }}
                            </a>
                          </td>
                        </tr>
                      </table>
                    @endisset

                    @isset($outro)
                      <p style="margin:0;font-size:13px;line-height:1.6;color:{{ $muted }};">{{ $outro }}</p>
                    @endisset

                    <p style="margin:22px 0 0;font-size:14px;color:{{ $ink }};">Sevgiler, <strong style="color:{{ $brandDeep }};">TavlaTV</strong></p>

                    @isset($url)
                      <hr style="border:none;border-top:1px solid {{ $border }};margin:26px 0 16px;">
                      <p style="margin:0;font-size:11px;line-height:1.55;color:{{ $muted }};">
                        Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br>
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
              © {{ date('Y') }} TavlaTV · <a href="https://www.tavlatv.com" style="color:{{ $muted }};text-decoration:underline;">tavlatv.com</a><br>
              <span style="color:#a89d8c;">Türkiye'nin Tavla Portalı</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
