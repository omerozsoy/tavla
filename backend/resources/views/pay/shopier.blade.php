<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Ödemeye yönlendiriliyor…</title>
</head>
<body onload="document.forms[0].submit()" style="font-family:system-ui,sans-serif;text-align:center;padding-top:4rem">
    <p>Güvenli ödeme sayfasına yönlendiriliyorsunuz…</p>
    <form method="post" action="{{ $action }}">
        @foreach ($fields as $name => $value)
            <input type="hidden" name="{{ $name }}" value="{{ $value }}">
        @endforeach
        <noscript><button type="submit">Devam Et</button></noscript>
    </form>
</body>
</html>
