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
    //
    // GUVENLIK UYARISI: demo = BEDAVA COIN acigi (demo odeme "basarili" sayilip coin yukler).
    // Bu yuzden demo yalniz PAYMENT_DEMO bayragi ACIKCA true ise acilir. Local'de APP_DEBUG=true
    // oldugundan otomatik acik gelir; production'da APP_DEBUG=false oldugundan demo yalniz
    // .env'e ELLE `PAYMENT_DEMO=true` yazilirsa acilir (gecici canli test icin).
    // TEST BITINCE: PAYMENT_DEMO'yu kaldir + `php artisan config:clear` + PHP-FPM restart.
    public function isDemo(): bool
    {
        // Gercek POS yapilandirildiysa demo asla devreye girmez.
        if ($this->isConfigured()) {
            return false;
        }

        return (bool) ($this->cfg['demo'] ?? false);
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

    /**
     * Karar veren alanlar: banka imzasinin (hash) KAPSAMINDA olmak ZORUNDA. Aksi halde hash dogru
     * olsa bile bu alanlar imzasiz olur ve degistirilebilir.
     */
    private const SIGNED_DECISION_FIELDS = ['mdstatus', 'procreturncode', 'response'];

    // Banka 3D donusunu dogrula (hashparams/hash). Basari + mesaj doner.
    //
    // GUVENLIK (denetim A-01): 'hashparams' istekten gelir (saldirgan kontrolunde) ve kendisi hash'e
    // girmez. Eskiden yalniz listedeki alanlarin degerleri birlestirilip hash'leniyordu; karar alanlari
    // (orderid/mdstatus/response/procreturncode) listede olmak zorunda degildi. Bankanin imzaladigi
    // HERHANGI bir dizi baska bir alan adina konup (hashparams=x&x=<dizi>) gecerli hash elde edilip,
    // imzasiz karar alanlariyla baska bir siparis "onaylandi" yapilabiliyordu (bedava coin/uyelik).
    // Artik: karar alanlari + siparis no hash KAPSAMINDA olmak zorunda; listede tekrar eden ad yok;
    // oid ve orderid ikisi de geldiyse ayni olmali. Kararlar yalniz imzali alanlardan okunur.
    public function verifyCallback(array $post): array
    {
        $hashParams = (string) ($post['hashparams'] ?? '');
        $received = (string) ($post['hash'] ?? '');
        $ids = array_values(array_filter(explode(':', $hashParams), fn ($x) => $x !== ''));
        $signed = array_flip($ids);

        // Siparis no: bankanin imzaladigi alan (oid veya orderid). Ikisi de geldiyse ESIT olmali.
        $oid = isset($post['oid']) ? (string) $post['oid'] : null;
        $orderid = isset($post['orderid']) ? (string) $post['orderid'] : null;
        $orderConsistent = $oid === null || $orderid === null || $oid === $orderid;
        $orderId = $orderid ?? $oid ?? '';
        // Ikisi de geldiyse esit olmak zorunda (orderConsistent) -> hangisi imzaliysa yeter.
        $orderSigned = ($orderid !== null && isset($signed['orderid'])) || ($oid !== null && isset($signed['oid']));
        $decisionSigned = $orderSigned;
        foreach (self::SIGNED_DECISION_FIELDS as $f) {
            $decisionSigned = $decisionSigned && isset($signed[$f]);
        }
        $noDuplicates = count($ids) === count($signed);

        $calc = '';
        if ($ids !== [] && $decisionSigned && $noDuplicates && $orderConsistent) {
            $concat = '';
            foreach ($ids as $id) {
                $concat .= $post[$id] ?? '';
            }
            $concat .= $this->cfg['store_key'];
            $calc = $this->hash($concat);
        }
        $hashOk = $received !== '' && $calc !== '' && hash_equals($calc, strtoupper($received));

        $md = $post['mdstatus'] ?? '';
        $response = $post['response'] ?? '';        // 'Approved'
        $procCode = $post['procreturncode'] ?? '';  // '00' = basarili
        // 3D_PAY'de tek adimda odeme tamamlanir: mdstatus 1 + response Approved + 00
        $ok = $hashOk
            && in_array((string) $md, ['1', '2', '3', '4'], true)
            && strtolower((string) $response) === 'approved'
            && (string) $procCode === '00';

        $msg = $post['errmsg'] ?? ($post['mderrormessage'] ?? ($ok ? 'Onaylandı' : 'Onaylanmadı'));

        return ['ok' => $ok, 'hash_ok' => $hashOk, 'msg' => (string) $msg, 'order_id' => $orderId];
    }
}
