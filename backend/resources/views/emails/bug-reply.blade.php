@php
  // Hata bildirimi YANITI e-postası (markalı, email-safe: tablo + inline stil).
  // message.blade.php ile aynı marka dili; buton yerine yanıt metni öne çıkar.
  $logo = rtrim(config('app.url'), '/').'/icon-512.png';
  $brand = '#a83a2b'; // terracotta
  $ink = '#1c1a17';
  $muted = '#6b6154';
  $cream = '#efeae1';
  $border = '#e2dbcd';
  $site = rtrim(config('app.frontend_url', 'https://www.tavlatv.com'), '/');
@endphp
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <title>TavlaTV — Bildirimine Yanıt</title>
</head>
<body style="margin:0;padding:0;background:{{ $cream }};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{ $cream }};padding:32px 12px;">
    <tr>
      <td align="center">
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
          <tr>
            <td style="background:#ffffff;border:1px solid {{ $border }};border-radius:16px;padding:32px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;">
                    <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:{{ $ink }};">
                      {{ $greetingName ? 'Merhaba '.$greetingName.'!' : 'Merhaba!' }}
                    </h1>
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:{{ $ink }};">
                      Bize ulaşıp bir hata / geri bildirim paylaştığın için <strong>teşekkür ederiz</strong>.
                      Bildirimin bize çok yardımcı oldu. İşte yanıtımız:
                    </p>

                    <!-- Yönetici yanıtı -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                           style="background:{{ $cream }};border:1px solid {{ $border }};border-radius:12px;margin:0 0 22px;">
                      <tr>
                        <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:{{ $ink }};white-space:pre-line;">{{ $replyText }}</td>
                      </tr>
                    </table>

                    @if($originalMessage)
                      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:{{ $muted }};text-transform:uppercase;letter-spacing:0.4px;">
                        Senin bildirimin
                      </p>
                      <p style="margin:0 0 22px;font-size:13px;line-height:1.6;color:{{ $muted }};white-space:pre-line;border-left:3px solid {{ $border }};padding-left:12px;">{{ $originalMessage }}</p>
                    @endif

                    <!-- Siteye dön butonu -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
                      <tr>
                        <td align="center" bgcolor="{{ $brand }}" style="border-radius:999px;">
                          <a href="{{ $site }}" target="_blank"
                             style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">
                            TavlaTV'ye Dön
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:20px 0 0;font-size:14px;color:{{ $ink }};">Sevgiler, <strong>TavlaTV Ekibi</strong></p>

                    <hr style="border:none;border-top:1px solid {{ $border }};margin:24px 0 16px;">
                    <p style="margin:0;font-size:11px;line-height:1.5;color:{{ $muted }};">
                      Bu e-postaya doğrudan yanıt vererek bize tekrar ulaşabilirsin.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:{{ $muted }};">
              © {{ date('Y') }} TavlaTV · tavlatv.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
