<?php

namespace Tests\Unit;

use App\Models\Payment;
use PHPUnit\Framework\TestCase;

class PaymentChannelTest extends TestCase
{
    public function test_channel_from_user_agent(): void
    {
        // Kurulu Android APK = remote-load WebView ('; wv)').
        $this->assertSame('android_app', Payment::channelFromUserAgent(
            'Mozilla/5.0 (Linux; Android 13; SM-G991B; wv) AppleWebKit/537.36 Chrome/120 Mobile'
        ));
        // Facebook in-app tarayıcı 'wv' içerse de bizim app değil -> web.
        $this->assertSame('web', Payment::channelFromUserAgent(
            'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 [FBAN/FB4A;FBAV/400]'
        ));
        // iPhone Safari = uygulama DEĞİL -> web. ('iphone' kanalı yalnız gerçek iOS app için,
        // o da UA'dan değil X-App-Platform başlığından damgalanır -> bkz. Payment::booted.)
        $this->assertSame('web', Payment::channelFromUserAgent(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Safari/604'
        ));
        // Masaüstü Chrome -> web.
        $this->assertSame('web', Payment::channelFromUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
        ));
        // Android mobil Chrome (uygulama değil, 'wv' yok) -> web.
        $this->assertSame('web', Payment::channelFromUserAgent(
            'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
        ));
    }
}
