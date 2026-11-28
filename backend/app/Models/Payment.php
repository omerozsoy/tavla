<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'user_id', 'kind', 'payment_method', 'order_id', 'plan', 'period', 'amount', 'coins', 'package_id', 'currency', 'status', 'bank_msg',
        'discount_code', 'discount_kurus', 'product_order_id', 'product_order_ids',
        'tournament_id', // kind='tournament_entry' -> hangi turnuva (callback'te kayit icin)
        'shopier_product_id', 'shopier_url', // Shopier REST API v1 (PAT): tek-seferlik ürün id + ödeme linki
        'channel', // web / android_app / iphone — oluşturma anında UA'dan türetilir (bkz. booted)
    ];

    protected function casts(): array
    {
        return [
            'product_order_ids' => 'array',
        ];
    }

    // Kanalı TEK noktada damgala (tüm Payment::create çağıranları buradan geçer). google_play (IAP) =
    // kesin Android uygulaması. Diğerleri HTTP checkout bağlamında oluşur -> cihaz User-Agent'ından türet.
    // Konsol/kuyruk bağlamında UA yok -> null (bilinmiyor; yanlış 'web' damgalamaktan iyi).
    protected static function booted(): void
    {
        static::creating(function (Payment $p) {
            if ($p->channel !== null) {
                return;
            }
            if ($p->payment_method === 'google_play') {
                $p->channel = 'android_app';

                return;
            }
            $req = request();
            // 'iphone' kanalı YALNIZ gerçek iOS uygulaması içindir. iOS Capacitor WebView UA'da
            // Safari'den ayrışmaz -> istemci (api.ts) 'X-App-Platform: ios' başlığı ile bildirir.
            // Başlık yoksa (iPhone Safari dahil) uygulama değildir -> UA'dan android_app / web.
            if ($req && strtolower((string) $req->header('X-App-Platform')) === 'ios') {
                $p->channel = 'iphone';

                return;
            }
            $ua = $req?->userAgent();
            $p->channel = $ua ? self::channelFromUserAgent($ua) : null;
        });
    }

    // appEnv.ts ile AYNI sinyal: kurulu TavlaTV APK = remote-load Android WebView ('; wv)'), Facebook/
    // Instagram in-app tarayıcıları HARİÇ (onlar bizim app değil). Uygulama değilse (iPhone Safari,
    // masaüstü, mobil tarayıcı) -> web. iOS uygulaması UA'dan ayrışmaz, X-App-Platform başlığıyla
    // ayrıca işlenir (bkz. booted) -> burada iPhone UA de 'web' döner.
    public static function channelFromUserAgent(?string $ua): string
    {
        $ua = (string) $ua;
        if (preg_match('/;\s*wv\)/i', $ua) && ! preg_match('/FBAN|FBAV|FB_IAB|Instagram|GSA\//i', $ua)) {
            return 'android_app';
        }

        return 'web';
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
