<?php

namespace App\Services;

use App\Models\Payment;

// Garanti BBVA Sanal POS (GVP) 3D_PAY akisi.
// NOT: banka-ozel; TEST ortaminda dogrulanmali (ozellikle hash_version).
class GarantiService
{
    private array $cfg;

    public function __construct()
    {
        $this->cfg = config('garanti');
    }

    public function isConfigured(): bool
    {
        return ! empty($this->cfg['merchant_id'])
            && ! empty($this->cfg['terminal_id'])
            && ! empty($this->cfg['prov_password'])
            && ! empty($this->cfg['store_key']);
    }

    // Demo odeme: banka bilgisi YOKKEN kart sayfasini gormek/test icin. Gercek para CEKILMEZ.
    // Garanti bilgileri girilince (isConfigured) demo asla devreye girmez -> gercek POS kullanilir.
    // GUVENLIK: production'da ASLA otomatik acilmasin (bedava coin landmine'i). Yalniz local/dev.
    public function isDemo(): bool
    {
        if (app()->isProduction()) {
            return false;
        }

        return ! $this->isConfigured() && (bool) ($this->cfg['demo'] ?? false);
    }

    // Odeme baslatilabilir mi? (gercek POS yapilandirildi VEYA demo acik)
    public function isAvailable(): bool
    {
        return $this->isConfigured() || $this->isDemo();
    }

    private function url(string $key): string
    {
        $mode = $this->cfg['mode'] === 'PROD' ? 'PROD' : 'TEST';
        return $this->cfg['urls'][$mode][$key];
    }

    private function hash(string $data): string
    {
        $algo = ($this->cfg['hash_version'] ?? 'v2') === 'v1' ? 'sha1' : 'sha512';
        return strtoupper(hash($algo, $data));
    }

    // Provizyon sifresi + 9-hane terminal -> hashed password
    private function hashedPassword(): string
    {
        $term = str_pad((string) $this->cfg['terminal_id'], 9, '0', STR_PAD_LEFT);
        return $this->hash((string) $this->cfg['prov_password'].$term);
    }

    // 3D formu icin secure3dhash (terminalid + orderid + amount + currency +
    // successurl + errorurl + type + installment + storekey + hashedPassword)
    private function threeDHash(Payment $p, string $successUrl, string $errorUrl): string
    {
        $type = 'sales';
        $installment = '';
        $data = $this->cfg['terminal_id']
            .$p->order_id
            .$p->amount
            .$p->currency
            .$successUrl
            .$errorUrl
            .$type
            .$installment
            .$this->cfg['store_key']
            .$this->hashedPassword();
        return $this->hash($data);
    }

    // 3D_PAY formu (bankaya auto-submit). Kart bilgileri $card ile gelir.
    public function buildThreeDForm(Payment $p, array $card, string $successUrl, string $errorUrl, string $email, string $ip): array
    {
        $fields = [
            'secure3dsecuritylevel' => '3D_PAY',
            'mode'                  => $this->cfg['mode'] === 'PROD' ? 'PROD' : 'TEST',
            'apiversion'            => 'v0.01',
            'terminalprovuserid'    => $this->cfg['prov_user'],
            'terminaluserid'        => $this->cfg['terminal_user'],
            'terminalid'            => $this->cfg['terminal_id'],
            'terminalmerchantid'    => $this->cfg['merchant_id'],
            'txntype'               => 'sales',
            'txnamount'             => (string) $p->amount,
            'txncurrencycode'       => $p->currency,
            'txninstallmentcount'   => '',
            'orderid'               => $p->order_id,
            'successurl'            => $successUrl,
            'errorurl'              => $errorUrl,
            'customeremailaddress'  => $email,
            'customeripaddress'     => $ip,
            'lang'                  => 'tr',
            'txntimestamp'          => (string) time(),
            'refreshtime'           => '5',
            'secure3dhash'          => $this->threeDHash($p, $successUrl, $errorUrl),
            // Kart (kendi odeme sayfamizdan) — PCI: kart verisi sunucuda tutulmaz
            'cardnumber'            => preg_replace('/\s+/', '', $card['number'] ?? ''),
            'cardexpiredatemonth'   => $card['month'] ?? '',
            'cardexpiredateyear'    => $card['year'] ?? '',
            'cardcvv2'              => $card['cvv'] ?? '',
        ];

        return ['action' => $this->url('3d'), 'fields' => $fields];
    }

    // Banka 3D donusunu dogrula (hashparams/hash). Basari + mesaj doner.
    public function verifyCallback(array $post): array
    {
        // Garanti geri donuste hashparams + hash gonderir; alanlari birlestirip
        // storeKey ile hashleyip 'hash' ile karsilastiririz.
        $hashParams = $post['hashparams'] ?? '';
        $received = $post['hash'] ?? '';
        $calc = '';
        if ($hashParams !== '') {
            $ids = explode(':', $hashParams);
            $concat = '';
            foreach ($ids as $id) {
                $concat .= $post[$id] ?? '';
            }
            $concat .= $this->cfg['store_key'];
            $calc = $this->hash($concat);
        }
        $hashOk = $received !== '' && hash_equals(strtoupper($received), $calc);

        $md = $post['mdstatus'] ?? '';
        $response = $post['response'] ?? '';        // 'Approved'
        $procCode = $post['procreturncode'] ?? '';  // '00' = basarili
        // 3D_PAY'de tek adimda odeme tamamlanir: mdstatus 1 + response Approved + 00
        $ok = $hashOk
            && in_array((string) $md, ['1', '2', '3', '4'], true)
            && strtolower((string) $response) === 'approved'
            && (string) $procCode === '00';

        $msg = $post['errmsg'] ?? ($post['mderrormessage'] ?? ($ok ? 'Onaylandı' : 'Onaylanmadı'));

        return ['ok' => $ok, 'hash_ok' => $hashOk, 'msg' => (string) $msg, 'order_id' => $post['orderid'] ?? ''];
    }
}
