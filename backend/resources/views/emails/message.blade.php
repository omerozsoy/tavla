@php
  // Marka e-posta sablonu (verify + reset ortak). Email-safe: tablo + inline stil.
  $logo = rtrim(config('app.url'), '/').'/icon-512.png';
  $brand = '#a83a2b'; // terracotta
  $ink = '#1c1a17';
  $muted = '#6b6154';
  $cream = '#efeae1';
  $border = '#e2dbcd';
@endphp
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <title>{{ $heading ?? 'TavlaTV' }}</title>
</head>
<body style="margin:0;padding:0;background:{{ $cream }};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{ $cream }};padding:32px 12px;">
    <tr>
      <td align="center">
        <!-- Logo + marka -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:18px;">
              <img src="{{ $logo }}" width="64" height="64" alt="TavlaTV"
                   style="display:block;border-radius:14px;border:0;outline:none;text-decoration:none;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;letter-spacing:0.5px;color:{{ $ink }};padding-top:10px;">
                Tavla<span style="color:{{ $brand }};">TV</span>
              </div>
            </td>
          </tr>
          <!-- Kart -->
          <tr>
            <td style="background:#ffffff;border:1px solid {{ $border }};border-radius:16px;padding:32px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;">
                    <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:{{ $ink }};">{{ $heading ?? 'Merhaba!' }}</h1>
                    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:{{ $ink }};">{{ $intro }}</p>

                    <!-- Buton -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                      <tr>
                        <td align="center" bgcolor="{{ $brand }}" style="border-radius:999px;">
                          <a href="{{ $url }}" target="_blank"
                             style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">
                            {{ $buttonText }}
                          </a>
                        </td>
                      </tr>
                    </table>

                    @isset($outro)
                      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:{{ $muted }};">{{ $outro }}</p>
                    @endisset

                    <p style="margin:16px 0 0;font-size:14px;color:{{ $ink }};">Sevgiler, <strong>TavlaTV</strong></p>

                    <hr style="border:none;border-top:1px solid {{ $border }};margin:24px 0 16px;">

                    <p style="margin:0;font-size:11px;line-height:1.5;color:{{ $muted }};">
                      Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br>
                      <a href="{{ $url }}" style="color:{{ $brand }};word-break:break-all;">{{ $url }}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:{{ $muted }};">
              © {{ date('Y') }} TavlaTV · tavlai.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
