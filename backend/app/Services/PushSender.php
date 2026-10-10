<?php

namespace App\Services;

use App\Models\DeviceToken;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification as FcmNotification;

// Firebase Cloud Messaging ile push gonderir. Servis hesabi JSON'u YOKSA sessizce no-op
// (push devre disi; oyun/akis asla etkilenmez). Gonderim hatalari yutulur ve loglanir.
class PushSender
{
    // Bir kullanicinin TUM cihazlarina push gonder. $data string=>string tasiyici (tip/oda vb.).
    public function sendToUser(int $userId, string $title, ?string $body = null, array $data = []): void
    {
        $tokens = DeviceToken::where('user_id', $userId)->pluck('token')->all();
        if (empty($tokens)) {
            return;
        }
        $this->sendToTokens($tokens, $title, $body, $data);
    }

    /** @param string[] $tokens */
    public function sendToTokens(array $tokens, string $title, ?string $body, array $data = []): void
    {
        $credPath = config('services.firebase.credentials');
        if (! $credPath || ! is_file($credPath)) {
            return; // yapilandirilmamis -> push kapali
        }
        if (empty($tokens)) {
            return;
        }

        // data yalniz string degerler kabul eder -> hepsini string'e cevir.
        $strData = [];
        foreach ($data as $k => $v) {
            $strData[(string) $k] = is_scalar($v) ? (string) $v : json_encode($v);
        }

        try {
            $messaging = (new Factory)->withServiceAccount($credPath)->createMessaging();
            $message = CloudMessage::new()
                ->withNotification(FcmNotification::create($title, $body ?? ''))
                ->withData($strData);

            $report = $messaging->sendMulticast($message, array_values($tokens));

            // Gecersiz/kayitsiz token'lari sil -> tablo sismesin, bir dahaki sefere denenmesin.
            $invalid = $report->invalidTokens();
            if (! empty($invalid)) {
                DeviceToken::whereIn('token', $invalid)->delete();
            }
        } catch (\Throwable $e) {
            Log::warning('Push gonderilemedi: '.$e->getMessage());
        }
    }
}
