<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

// Tek kaynak SMS gonderimi (Netgsm). Tum SMS buradan gecer. OTP + islemsel bildirim
// (ikisi de IYS muaf). Netgsm HTTP GET API: donus govdesi '00'/'01'/'02' ile baslarsa
// kabul edilmistir. Kimlik bilgisi yoksa (dev/test) gondermez; mesaji loglar + false doner.
class Sms
{
    public static function send(string $phone, string $text): bool
    {
        $user = (string) config('services.netgsm.user');
        $pass = (string) config('services.netgsm.pass');
        $header = (string) config('services.netgsm.header');

        // 10 haneli GSM (bas 0 olmadan): '05XXXXXXXXX' -> '5XXXXXXXXX'
        $gsm = ltrim(preg_replace('/\D/', '', $phone), '0');

        if ($user === '' || $pass === '' || $header === '') {
            // Yapilandirma yok (yerel/test): gercek gonderim yapma, izlenebilsin diye logla.
            Log::info('SMS (netgsm yapilandirilmamis)', ['gsm' => $gsm, 'text' => $text]);

            return false;
        }

        try {
            $resp = Http::asForm()->timeout(10)->get('https://api.netgsm.com.tr/sms/send/get', [
                'usercode'  => $user,
                'password'  => $pass,
                'gsmno'     => $gsm,
                'message'   => $text,
                'msgheader' => $header,
            ]);
            $body = trim($resp->body());
            $ok = $resp->ok() && (str_starts_with($body, '00') || str_starts_with($body, '01') || str_starts_with($body, '02'));
            if (! $ok) {
                Log::warning('SMS gonderilemedi', ['gsm' => $gsm, 'resp' => $body]);
            }

            return $ok;
        } catch (\Throwable $e) {
            Log::warning('SMS istisna', ['gsm' => $gsm, 'err' => $e->getMessage()]);

            return false;
        }
    }
}
