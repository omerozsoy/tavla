<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

// PayTR iframe API (get-token + guvenli iframe + bildirim/callback).
// Akis: createToken (sunucu->PayTR, gizli anahtarla imzali) -> iframe sayfasi kart formunu barindirir
// -> PayTR sunucu->sunucu bildirim (callback) yollar -> verifyCallback HMAC dogrular -> fulfill.
// Dok: https://dev.paytr.com/iframe-api
class PayTRService
{
    private array $cfg;

    public function __construct()
    {
        $this->cfg = config('paytr');
    }

    public function isConfigured(): bool
    {
        return ! empty($this->cfg['merchant_id'])
            && ! empty($this->cfg['merchant_key'])
            && ! empty($this->cfg['merchant_salt']);
    }

    // Demo odeme: PayTR bilgileri YOKKEN akisi gormek/test icin. Gercek para CEKILMEZ.
    // PayTR bilgileri girilince (isConfigured) demo asla devreye girmez -> gercek odeme kullanilir.
    // GUVENLIK: demo = bedava coin acigi -> yalniz PAYMENT_DEMO=true ACIKCA ise acilir, prod'da asla.
    public function isDemo(): bool
    {
        if ($this->isConfigured()) {
            return false;
        }

        return (bool) ($this->cfg['demo'] ?? false);
    }

    // Odeme baslatilabilir mi? (PayTR yapilandirildi VEYA demo acik)
    public function isAvailable(): bool
    {
        return $this->isConfigured() || $this->isDemo();
    }

    // PayTR merchant_oid: YALNIZ harf+rakam (ozel karakter yasak). order_id zaten alfanumerik
    // (TV/TC/.. + ymdHis + hex) oldugundan degismez; yine de guvenli tarafta kalmak icin suzeriz.
    public function merchantOid(Payment $p): string
    {
        return preg_replace('/[^A-Za-z0-9]/', '', (string) $p->order_id);
    }

    // user_basket: base64(JSON) — [[urun_adi, birim_fiyat_TL, adet]].
    private function basket(Payment $p): string
    {
        $label = match ($p->kind) {
            'coins' => 'Coin paketi',
            'renew', 'subscription' => 'Premium uyelik',
            'product' => 'Urun siparisi',
            'cart' => 'Sepet',
            'tournament_entry' => 'Turnuva katilimi',
            default => 'Odeme',
        };
        $priceTl = number_format(((int) $p->amount) / 100, 2, '.', '');

        return base64_encode(json_encode([[$label, $priceTl, 1]]));
    }

    /**
     * get-token: PayTR'den iframe token'i al (gizli anahtarla imzali). Basarisizsa RuntimeException.
     * Donen token ile iframeUrl() guvenli odeme sayfasini verir.
     */
    public function createToken(Payment $p, string $email, string $ip, string $okUrl, string $failUrl): string
    {
        $merchantId = (string) $this->cfg['merchant_id'];
        $key = (string) $this->cfg['merchant_key'];
        $salt = (string) $this->cfg['merchant_salt'];

        $oid = $this->merchantOid($p);
        $amount = (int) $p->amount;                 // KURUS (tam sayi)
        $basket = $this->basket($p);
        $noInstallment = 0;                         // 0 = taksit acik; 1 = yalniz tek cekim
        $maxInstallment = 0;                        // 0 = PayTR panel limiti
        $currency = (string) ($this->cfg['currency'] ?? 'TL');
        $testMode = $this->cfg['test_mode'] ? 1 : 0;
        $userIp = $ip !== '' ? $ip : '0.0.0.0';
        $userEmail = $email !== '' ? $email : 'noemail@tavlatv.com';

        // paytr_token = base64(HMAC-SHA256(hashStr + salt, key)). hashStr alan SIRASI PayTR'ye gore SABIT.
        $hashStr = $merchantId.$userIp.$oid.$userEmail.$amount.$basket.$noInstallment.$maxInstallment.$currency.$testMode;
        $token = base64_encode(hash_hmac('sha256', $hashStr.$salt, $key, true));

        $resp = Http::asForm()->timeout(20)->post($this->cfg['token_url'], [
            'merchant_id' => $merchantId,
            'user_ip' => $userIp,
            'merchant_oid' => $oid,
            'email' => $userEmail,
            'payment_amount' => $amount,
            'paytr_token' => $token,
            'user_basket' => $basket,
            'debug_on' => $testMode,
            'no_installment' => $noInstallment,
            'max_installment' => $maxInstallment,
            'user_name' => 'TavlaTV Kullanici',
            'user_address' => 'TavlaTV',
            'user_phone' => '0000000000',
            'merchant_ok_url' => $okUrl,
            'merchant_fail_url' => $failUrl,
            'timeout_limit' => (int) ($this->cfg['timeout'] ?? 30),
            'currency' => $currency,
            'test_mode' => $testMode,
            'lang' => 'tr',
        ]);

        $json = $resp->json();
        if (! is_array($json) || ($json['status'] ?? '') !== 'success') {
            Log::error('paytr.get_token failed', [
                'oid' => $oid,
                'http' => $resp->status(),
                'reason' => is_array($json) ? ($json['reason'] ?? null) : $resp->body(),
            ]);
            throw new \RuntimeException('PayTR odeme baslatilamadi.');
        }

        return (string) $json['token'];
    }

    public function iframeUrl(string $token): string
    {
        return $this->cfg['iframe_url'].$token;
    }

    /**
     * Bildirim (callback) dogrulama. PayTR sunucu->sunucu POST'u HMAC ile imzalar; biz AYNI sirayla
     * hesaplayip sabit-zamanli karsilastiririz. Sahte/degistirilmis bildirim hash_ok=false doner.
     *  hash = base64(HMAC-SHA256(merchant_oid + salt + status + total_amount, key))
     * Donen: ['hash_ok','paid','order_id','amount','msg'].
     */
    public function verifyCallback(array $post): array
    {
        $oid = (string) ($post['merchant_oid'] ?? '');
        $status = (string) ($post['status'] ?? '');
        $totalAmount = (string) ($post['total_amount'] ?? '');
        $received = (string) ($post['hash'] ?? '');

        $key = (string) ($this->cfg['merchant_key'] ?? '');
        $salt = (string) ($this->cfg['merchant_salt'] ?? '');
        $calc = base64_encode(hash_hmac('sha256', $oid.$salt.$status.$totalAmount, $key, true));
        $hashOk = $received !== '' && $key !== '' && hash_equals($calc, $received);

        return [
            'hash_ok' => $hashOk,
            'paid' => $hashOk && $status === 'success',
            'order_id' => $oid,
            'amount' => $totalAmount, // KURUS (string); karar controller'da
            'msg' => $status === 'success'
                ? 'Onaylandi'
                : (string) ($post['failed_reason_msg'] ?? 'Onaylanmadi'),
        ];
    }
}
