<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Setting;
use App\Services\GarantiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

class PaymentController extends Controller
{
    // ---- Havale/EFT (admin panel: Ayarlar > Havale/EFT) ----

    /** Havale bilgileri (IBAN + hesap sahibi + banka + müşteri açıklaması). */
    public static function bankTransferInfo(): array
    {
        return [
            'enabled' => Setting::bool('bank_transfer_enabled', false),
            'iban'    => Setting::get('bank_transfer_iban'),
            'name'    => Setting::get('bank_transfer_name'),
            'bank'    => Setting::get('bank_transfer_bank'),
            'note'    => Setting::get('bank_transfer_note'),
        ];
    }

    /** Havale açık VE IBAN dolu mu (checkout için kullanılabilir olması şart). */
    public static function bankEnabled(): bool
    {
        return Setting::bool('bank_transfer_enabled', false) && trim(Setting::get('bank_transfer_iban')) !== '';
    }

    // GET /pay/bank-transfer — halka açık havale bilgisi (frontend ödeme yöntemi seçimi için).
    // Kapalıysa {enabled:false} döner (IBAN sızdırmaz).
    public function bankInfo()
    {
        if (! self::bankEnabled()) {
            return response()->json(['enabled' => false]);
        }
        $i = self::bankTransferInfo();

        return response()->json([
            'enabled' => true,
            'iban'    => $i['iban'],
            'name'    => $i['name'],
            'bank'    => $i['bank'],
            'note'    => $i['note'],
        ]);
    }

    // Checkout ön-kontrol: havale -> açık olmalı; kart -> Garanti hazır olmalı. Uygunsa null.
    private function checkoutGuard(string $method, GarantiService $garanti)
    {
        if ($method === 'bank_transfer') {
            return self::bankEnabled() ? null : $this->fail('Havale/EFT ödemesi şu an kapalı.', 503);
        }

        return $garanti->isAvailable() ? null : $this->fail('Ödeme sistemi henüz yapılandırılmadı.', 503);
    }

    // Ödeme kaydı oluşturulduktan sonra dönen JSON: havale -> IBAN + referans; kart -> imzalı
    // kart/submit URL + demo. $extra: akışa özel alanlar (coins, discount, code...).
    private function checkoutResponse(Payment $payment, string $method, GarantiService $garanti, array $extra = [])
    {
        if ($method === 'bank_transfer') {
            $i = self::bankTransferInfo();

            return response()->json(array_merge([
                'bankTransfer' => true,
                'reference'    => $payment->order_id,
                'amount'       => (int) $payment->amount,
                'iban'         => $i['iban'],
                'name'         => $i['name'],
                'bank'         => $i['bank'],
                'note'         => $i['note'],
            ], $extra));
        }
        $url = URL::temporarySignedRoute('pay.card', now()->addMinutes(30), ['payment' => $payment->id]);
        $submitUrl = URL::temporarySignedRoute('pay.submit', now()->addMinutes(30), ['payment' => $payment->id]);

        return response()->json(array_merge([
            'url'       => $url,
            'submitUrl' => $submitUrl,
            'amount'    => (int) $payment->amount,
            'demo'      => $garanti->isDemo(),
        ], $extra));
    }

    // SPA: abonelik baslat -> odeme kaydi olustur, kart sayfasi (imzali) linki / havale bilgisi don.
    public function subscribe(Request $request, GarantiService $garanti)
    {
        $data = $request->validate([
            'plan'   => ['required', 'in:star'],
            'period' => ['required', 'in:yearly'], // yalnız yıllık üyelik (aylık kaldırıldı)
            'method' => ['nullable', 'in:card,bank_transfer'],
        ]);
        $method = $data['method'] ?? 'card';
        if ($guard = $this->checkoutGuard($method, $garanti)) {
            return $guard;
        }
        $amount = config("garanti.prices.{$data['plan']}.{$data['period']}");
        if (! $amount) {
            return $this->fail('Geçersiz plan.', 422);
        }

        $payment = Payment::create([
            'user_id'        => $request->user()->id,
            'kind'           => 'subscription',
            'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
            'order_id'       => 'TV'.now()->format('ymdHis').mt_rand(100, 999),
            'plan'           => $data['plan'],
            'period'         => $data['period'],
            'amount'         => $amount,
            'currency'       => '949',
            'status'         => 'pending',
        ]);

        return $this->checkoutResponse($payment, $method, $garanti);
    }

    // SPA: sepetteki coin paketlerini satin al -> tek odeme kaydi, kart sayfasi linki don.
    // Sepet [{id, qty}] gelir; FIYAT SUNUCUDA (config/garanti coin_packages) hesaplanir,
    // frontend'den gelen tutara ASLA guvenilmez.
    public function buyCoins(Request $request, GarantiService $garanti)
    {
        $data = $request->validate([
            'items'          => ['required', 'array', 'min:1', 'max:20'],
            'items.*.id'     => ['required', 'string'],
            'items.*.qty'    => ['required', 'integer', 'min:1', 'max:99'],
            'code'           => ['nullable', 'string', 'max:40'],
            'method'         => ['nullable', 'in:card,bank_transfer'],
        ]);
        $method = $data['method'] ?? 'card';
        if ($guard = $this->checkoutGuard($method, $garanti)) {
            return $guard;
        }

        [$totalKurus, $totalCoins, $ids, $err] = $this->coinSubtotal($data['items']);
        if ($err) {
            return $this->fail($err, 422);
        }
        if ($totalKurus <= 0) {
            return $this->fail('Sepet tutarı geçersiz.', 422);
        }

        // Indirim kodu (opsiyonel): SUNUCU-OTORITER dogrulama + uygulama. amount ZATEN indirimli.
        $discountKurus = 0;
        $discountCode = null;
        if (! empty($data['code'])) {
            $reason = null;
            $promo = \App\Models\PromoCode::usable($data['code'], $totalKurus, $reason, $request->user()?->id);
            if (! $promo) {
                return $this->fail($this->promoReason($reason), 422);
            }
            $discountKurus = $promo->discountKurus($totalKurus);
            $discountCode = $promo->code;
        }
        $chargeKurus = $totalKurus - $discountKurus;
        if ($chargeKurus <= 0) {
            return $this->fail('İndirim kodu sepeti tamamen sıfırlıyor; geçersiz.', 422);
        }

        $payment = Payment::create([
            'user_id'        => $request->user()->id,
            'kind'           => 'coins',
            'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
            'order_id'       => 'TC'.now()->format('ymdHis').mt_rand(100, 999),
            'amount'         => $chargeKurus,
            'coins'          => $totalCoins,
            'package_id'     => implode(',', $ids),
            'discount_code'  => $discountCode,
            'discount_kurus' => $discountKurus,
            'currency'       => '949',
            'status'         => 'pending',
        ]);

        // Kart: url (eski ayrı sayfa) + submitUrl (uygulama-içi form) -> Garanti 3D.
        // Havale: IBAN + referans (order_id) döner; ödeme admin panelden elle onaylanır.
        return $this->checkoutResponse($payment, $method, $garanti, [
            'amount'   => $chargeKurus,
            'coins'    => $totalCoins,
            'discount' => $discountKurus,
            'code'     => $discountCode,
        ]);
    }

    // SPA: "Üyeliğini Uzat" -> sepetteki 1 yillik Premium uzatmayi satin al. Tek urun; FIYAT
    // SUNUCUDA (config/garanti.renew), client'a guvenilmez. buyCoins ile ayni donus sekli
    // (url/submitUrl/amount/demo) -> ayni uygulama-ici odeme sayfasi kullanilir. kind='renew':
    // callback'te plan_until'a +1 yil EKLENIR (sifirlanmaz).
    public function buyMembership(Request $request, GarantiService $garanti)
    {
        $data = $request->validate([
            'method' => ['nullable', 'in:card,bank_transfer'],
        ]);
        $method = $data['method'] ?? 'card';
        if ($guard = $this->checkoutGuard($method, $garanti)) {
            return $guard;
        }
        $amount = (int) config('garanti.renew.yearly', 49900);
        if ($amount <= 0) {
            return $this->fail('Üyelik fiyatı yapılandırılmamış.', 422);
        }

        $payment = Payment::create([
            'user_id'        => $request->user()->id,
            'kind'           => 'renew',
            'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
            'order_id'       => 'TM'.now()->format('ymdHis').mt_rand(100, 999),
            'plan'           => 'star',
            'period'         => 'yearly',
            'amount'         => $amount,
            'currency'       => '949',
            'status'         => 'pending',
        ]);

        return $this->checkoutResponse($payment, $method, $garanti);
    }

    // kind='product' odemesi basariliysa bagli siparisi 'paid' yap + stok dus (idempotent:
    // yalniz 'pending' siparis islenir). ATOMIK claim'in ICINDE cagrilir (tek kez). Stok
    // arada tukendiyse siparis yine 'paid' olur (para alindi) ama admin notu dusulur.
    private function fulfillProductOrder(Payment $payment): void
    {
        if (! $payment->product_order_id) {
            return;
        }
        $order = \App\Models\ProductOrder::where('id', $payment->product_order_id)
            ->where('status', 'pending')
            ->first();
        if (! $order) {
            return;
        }
        $order->status = 'paid';
        if ($order->product_id) {
            $dec = \App\Models\Product::where('id', $order->product_id)
                ->where('stock', '>=', $order->qty)
                ->decrement('stock', $order->qty);
            if (! $dec) {
                $order->admin_note = trim(($order->admin_note ?? '')."\n[sistem] Ödeme alındı ancak stok yetersizdi; stok elle kontrol edilmeli.");
            }
        }
        $order->save();
    }

    // Uyeligi aktive et / UZAT. kind='renew' -> mevcut bitis tarihi gelecekteyse USTUNE ekle
    // (sure kaybi olmaz); dolmus/bos ise bugunden baslat. kind='subscription' -> ayni davranis
    // (ilk abonelikte plan_until bos oldugundan bugunden baslar). ATOMIK caginin ICINDE cagrilir.
    private function activateMembership(\App\Models\User $u, Payment $payment): void
    {
        $future = $u->plan_until && \Illuminate\Support\Carbon::parse($u->plan_until)->isFuture();
        $base = $future ? \Illuminate\Support\Carbon::parse($u->plan_until) : now();
        $u->plan = $payment->plan ?: 'star';
        $u->plan_until = $payment->period === 'monthly'
            ? $base->copy()->addMonth()
            : $base->copy()->addYear();
        if (! $u->plan_since) {
            $u->plan_since = now();
        }
        $u->auto_renew = true;
        $u->save();
    }

    // Sepet alt toplami (kurus) + coin + id ozetleri (config'ten, client'a GUVENILMEZ).
    // Donus: [totalKurus, totalCoins, ids[], errorOrNull].
    private function coinSubtotal(array $items): array
    {
        $packages = config('garanti.coin_packages', []);
        $totalKurus = 0;
        $totalCoins = 0;
        $ids = [];
        foreach ($items as $it) {
            $pkg = $packages[$it['id']] ?? null;
            if (! $pkg) {
                return [0, 0, [], 'Geçersiz coin paketi: '.$it['id']];
            }
            $totalKurus += (int) $pkg['price'] * (int) $it['qty'];
            $totalCoins += (int) $pkg['gc'] * (int) $it['qty'];
            $ids[] = $it['id'].'x'.$it['qty'];
        }

        return [$totalKurus, $totalCoins, $ids, null];
    }

    // Promo dogrulama gerekce -> kullanici mesaji.
    private function promoReason(?string $reason): string
    {
        return match ($reason) {
            'expired'      => 'İndirim kodunun süresi dolmuş.',
            'exhausted'    => 'İndirim kodu kullanım limitine ulaştı.',
            'min_amount'   => 'İndirim kodu için sepet tutarı yetersiz.',
            'already_used' => 'Bu indirim kodunu zaten kullandın.',
            default        => 'İndirim kodu geçersiz.',
        };
    }

    // POST /shop/promo/validate — sepet + kod -> sunucu indirimi hesaplar (odeme baslatmadan).
    public function promoValidate(Request $request)
    {
        $data = $request->validate([
            'items'       => ['required', 'array', 'min:1', 'max:20'],
            'items.*.id'  => ['required', 'string'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
            'code'        => ['required', 'string', 'max:40'],
        ]);
        [$totalKurus, , , $err] = $this->coinSubtotal($data['items']);
        if ($err || $totalKurus <= 0) {
            return $this->fail($err ?: 'Sepet tutarı geçersiz.', 422);
        }
        $reason = null;
        $promo = \App\Models\PromoCode::usable($data['code'], $totalKurus, $reason, $request->user()?->id);
        if (! $promo) {
            return $this->fail($this->promoReason($reason), 422);
        }
        $discount = $promo->discountKurus($totalKurus);

        return response()->json([
            'code'     => $promo->code,
            'type'     => $promo->type,
            'value'    => (int) $promo->value,
            'discount' => $discount,                        // kurus
            'subtotal' => $totalKurus,                      // kurus
            'final'    => max(0, $totalKurus - $discount),  // kurus
        ]);
    }

    // Kart giris sayfasi (imzali). Kart verisi sunucuda saklanmaz; dogrudan bankaya gider.
    public function card(Request $request, Payment $payment)
    {
        abort_if($payment->payment_method === 'bank_transfer', 404); // havale kart sayfasıyla ödenmez
        abort_unless($request->hasValidSignature() && $payment->status === 'pending', 403);
        // Form submit URL'i de imzali uretilir (bu sayfa zaten imza dogruladi) -> yalnizca
        // bu odemenin sahibi submit edebilir; baskasinin pending odemesine POST engellenir.
        $submitUrl = URL::temporarySignedRoute('pay.submit', now()->addMinutes(30), ['payment' => $payment->id]);
        return view('pay.card', ['payment' => $payment, 'submitUrl' => $submitUrl]);
    }

    // Kart formu -> Garanti 3D formunu olustur ve bankaya auto-submit et.
    public function submit(Request $request, Payment $payment, GarantiService $garanti)
    {
        abort_if($payment->payment_method === 'bank_transfer', 404); // havale kart formuyla ödenmez
        abort_unless($payment->status === 'pending', 403);
        $card = $request->validate([
            'number' => ['required', 'string', 'max:25'],
            'month'  => ['required', 'string', 'max:2'],
            'year'   => ['required', 'string', 'max:4'],
            'cvv'    => ['required', 'string', 'max:4'],
        ]);

        // DEMO: banka yapilandirilmadi. Gercek POS'a GITME; odemeyi basarili say, coin/plani ver.
        // (Kart bilgileri hicbir yere gonderilmez/saklanmaz.) Gercek POS acilinca bu dal calismaz.
        if ($garanti->isDemo()) {
            return $this->fulfillDemo($payment);
        }

        $success = route('pay.callback');
        $error = route('pay.callback');
        $user = $payment->user;
        $form = $garanti->buildThreeDForm(
            $payment,
            $card,
            $success,
            $error,
            $user->email ?? '',
            $request->ip(),
        );
        return view('pay.redirect', ['action' => $form['action'], 'fields' => $form['fields']]);
    }

    // DEMO tahsilat: banka olmadan odemeyi basarili say ve coin/uyeligi ATOMIK (tek kez) ver.
    // Callback'teki gercek akisla ayni idempotency: yalnizca 'pending' -> 'paid' iddia edilen
    // odeme hesaba islenir; yenileme/cift submit'te tekrar yuklenmez.
    private function fulfillDemo(Payment $payment)
    {
        $claimed = DB::transaction(function () use ($payment) {
            $locked = Payment::where('id', $payment->id)->lockForUpdate()->first();
            if (! $locked || $locked->status !== 'pending') {
                return false;
            }
            $locked->status = 'paid';
            $locked->bank_msg = 'DEMO — gerçek tahsilat yapılmadı';
            $u = \App\Models\User::lockForUpdate()->find($locked->user_id);
            if (! $u) {
                throw new \RuntimeException('Ödeme hesabı bulunamadı.');
            }
            $locked->setRelation('user', $u);
            $locked->save();
            $this->fulfillPayment($locked);

            return true;
        });
        if ($claimed) {
            $payment->status = 'paid';
        }

        $okMsg = $this->fulfillMessage($payment);

        return view('pay.result', [
            'ok'    => true,
            'msg'   => 'DEMO ödeme — gerçek tahsilat yapılmadı.',
            'okMsg' => $okMsg,
        ]);
    }

    // Banka 3D donusu -> dogrula, basariliysa plani aktive et.
    public function callback(Request $request, GarantiService $garanti)
    {
        $post = $request->all();
        $res = $garanti->verifyCallback($post);
        $payment = Payment::where('order_id', $res['order_id'])->first();

        // Tutar dogrulamasi. Fiyatlar KURUS tam sayi (config/garanti); bankaya (string)amount
        // gonderilir ve banka txnamount'u ayni kurus degerini echo eder -> TAM SAYI karsilastir
        // (ondalik/bosluk/sifir-dolgu format varyantlarina dayanikli; TL/kurus belirsizligi YOK).
        // Uyumsuz tutar HER ZAMAN reddedilir. Bos txnamount: hash zaten sahteciligi engeller;
        // strict degilse gecirilir ama LOGLANIR, strict ise (banka test sonrasi) reddedilir.
        $strict = (bool) config('garanti.strict_amount', false);
        $bankRaw = trim((string) ($post['txnamount'] ?? ''));
        $amountMissing = ($bankRaw === '');
        $amountMatches = ! $amountMissing
            && is_numeric($bankRaw)
            && $payment
            && (int) round((float) $bankRaw) === (int) $payment->amount;
        $amountOk = $amountMatches || ($amountMissing && ! $strict);

        // Denetim gunlugu: her callback + tutar karari (anlasmazlik/inceleme icin).
        \Illuminate\Support\Facades\Log::info('payment.callback', [
            'order_id' => $res['order_id'] ?? null,
            'user_id' => $payment->user_id ?? null,
            'ok' => $res['ok'] ?? false,
            'hash_ok' => $res['hash_ok'] ?? false,
            'bank_amount' => $post['txnamount'] ?? null,
            'record_amount' => $payment->amount ?? null,
            'amount_ok' => $amountOk,
            'amount_missing' => $amountMissing,
            'strict' => $strict,
            'ip' => $request->ip(),
        ]);
        if ($amountMissing) {
            \Illuminate\Support\Facades\Log::warning('payment.callback: txnamount bos -> tutar dogrulanamadi', [
                'order_id' => $res['order_id'] ?? null,
                'strict' => $strict,
            ]);
        }

        if ($payment) {
            if ($res['ok'] && $amountOk) {
                // ATOMIK idempotency: yalnizca ILK basarili callback plani aktive eder.
                // (Banka retry'i / replay / yaris kosulunda cift aktivasyon olmaz.)
                $claimed = DB::transaction(function () use ($payment, $res) {
                    $locked = Payment::where('id', $payment->id)->lockForUpdate()->first();
                    if (! $locked || $locked->status !== 'pending') {
                        return false;
                    }
                    $u = \App\Models\User::lockForUpdate()->find($locked->user_id);
                    if (! $u) {
                        throw new \RuntimeException('Ödeme hesabı bulunamadı.');
                    }
                    $locked->status = 'paid';
                    $locked->bank_msg = $res['msg'];
                    $locked->setRelation('user', $u);
                    $locked->save();
                    $this->fulfillPayment($locked);

                    return true;
                });
                if ($claimed) {
                    $payment->status = 'paid';
                }
            } elseif ($payment->status === 'pending') {
                // A failed callback must not overwrite a concurrent successful callback.
                // Re-read and lock the payment row before changing its terminal status.
                DB::transaction(function () use ($payment, $amountOk, $res) {
                    $locked = Payment::whereKey($payment->id)->lockForUpdate()->first();
                    if (! $locked || $locked->status !== 'pending') {
                        return;
                    }
                    $locked->status = 'failed';
                    $locked->bank_msg = $amountOk ? $res['msg'] : 'Tutar uyusmuyor';
                    $locked->save();
                });
            }
        }

        $okMsg = $payment ? $this->fulfillMessage($payment) : 'İşlem tamamlandı.';

        return view('pay.result', ['ok' => $res['ok'] && $payment, 'msg' => $res['msg'], 'okMsg' => $okMsg]);
    }

    /** Apply one already-claimed payment while its payment and user rows are locked. */
    private function fulfillPayment(Payment $payment): void
    {
        $u = $payment->user;
        if ($payment->kind === 'coins') {
            app(\App\Services\WalletService::class)->credit($u, (int) $payment->coins, 'payment', Payment::class, $payment->id);
            if (! empty($payment->discount_code)) {
                \App\Models\PromoCode::bumpUse($payment->discount_code); // atomik + limit-güvenli
            }
        } elseif ($payment->kind === 'product') {
            $this->fulfillProductOrder($payment);
        } elseif ($payment->kind === 'cart') {
            $this->fulfillCart($payment);
        } else {
            $this->activateMembership($u, $payment);
        }
    }

    // Odeme turune gore basari mesaji.
    private function fulfillMessage(Payment $payment): string
    {
        return match ($payment->kind) {
            'coins'   => number_format((int) $payment->coins, 0, ',', '.').' coin hesabına yüklendi.',
            'product' => 'Siparişin alındı. Kargo süreci başlayınca bilgilendirileceksin.',
            'cart'    => 'Ödemen alındı. '.((int) $payment->coins > 0 ? number_format((int) $payment->coins, 0, ',', '.').' coin yüklendi; ' : '').'siparişlerin hazırlanıyor.',
            'renew'   => 'Üyeliğin uzatıldı.',
            default   => 'Üyeliğin etkinleştirildi.',
        };
    }

    // Ortak sepet ödemesi (kind='cart') fulfillment: coin paketlerini yükle + promo + tüm
    // bağlı fiziksel sipariş satırlarını 'paid' yap ve stok düş. ATOMIK claim'in İÇİNDE (tek kez).
    private function fulfillCart(Payment $payment): void
    {
        $u = $payment->user;
        if ((int) $payment->coins > 0) {
            app(\App\Services\WalletService::class)->credit($u, (int) $payment->coins, 'payment_cart', Payment::class, $payment->id);
        }
        if (! empty($payment->discount_code)) {
            \App\Models\PromoCode::bumpUse($payment->discount_code); // atomik + limit-güvenli
        }
        foreach ((array) ($payment->product_order_ids ?? []) as $oid) {
            $order = \App\Models\ProductOrder::where('id', $oid)->where('status', 'pending')->first();
            if (! $order) {
                continue;
            }
            $order->status = 'paid';
            if ($order->product_id) {
                $dec = \App\Models\Product::where('id', $order->product_id)
                    ->where('stock', '>=', $order->qty)
                    ->decrement('stock', $order->qty);
                if (! $dec) {
                    $order->admin_note = trim(($order->admin_note ?? '')."\n[sistem] Ödeme alındı ancak stok yetersizdi; stok elle kontrol edilmeli.");
                }
            }
            $order->save();
        }
    }

    // POST /shop/cart-checkout — ortak sepetin PARA kısmı (coin paketleri + para-ürünleri)
    // TEK Garanti ödemesi (kind='cart'). Para-ürünleri için 'pending' sipariş oluşturulur;
    // ödeme başarılıysa callback fulfillCart ile hepsini karşılar. Fiyatlar SUNUCU-OTORİTER.
    public function cartCheckout(Request $request, GarantiService $garanti)
    {
        $data = $request->validate([
            'coin_items'                   => ['nullable', 'array', 'max:20'],
            'coin_items.*.id'              => ['required_with:coin_items', 'string'],
            'coin_items.*.qty'             => ['required_with:coin_items', 'integer', 'min:1', 'max:99'],
            'products'                     => ['nullable', 'array', 'max:20'],
            'products.*.product_id'        => ['required_with:products', 'integer'],
            'products.*.qty'               => ['required_with:products', 'integer', 'min:1', 'max:10'],
            'products.*.color'             => ['nullable', 'string', 'max:40'],
            'shipping_address_id'          => ['nullable', 'integer'],
            'billing_address_id'           => ['nullable', 'integer'],
            'note'                         => ['nullable', 'string', 'max:500'],
            'code'                         => ['nullable', 'string', 'max:40'],
            'method'                       => ['nullable', 'in:card,bank_transfer'],
        ]);
        $method = $data['method'] ?? 'card';
        if ($guard = $this->checkoutGuard($method, $garanti)) {
            return $guard;
        }

        $coinItems = $data['coin_items'] ?? [];
        $products = $data['products'] ?? [];
        if (empty($coinItems) && empty($products)) {
            return $this->fail('Sepette ödenecek bir şey yok.', 422);
        }

        // Coin paketleri alt toplamı (config, client'a güvenilmez).
        $packagesKurus = 0;
        $packageCoins = 0;
        $ids = [];
        if (! empty($coinItems)) {
            [$packagesKurus, $packageCoins, $ids, $err] = $this->coinSubtotal($coinItems);
            if ($err) {
                return $this->fail($err, 422);
            }
        }

        // Para-ürünleri: adres + doğrulama gerekli.
        $productsKurus = 0;
        $orderIds = [];
        if (! empty($products)) {
            $ship = ProductController::resolveShip($request->user()->id, (int) ($data['shipping_address_id'] ?? 0), $data['note'] ?? null);
            if (! $ship) {
                return $this->fail('Ürünler için geçerli bir teslimat adresi seç.', 422);
            }
            $billNote = ProductController::billingNote($request->user()->id, $data['billing_address_id'] ?? null);

            $lines = [];
            foreach ($products as $it) {
                $p = \App\Models\Product::where('published', true)->find($it['product_id']);
                if (! $p) {
                    return $this->fail('Ürün bulunamadı.', 404);
                }
                if (! $p->acceptsMoney()) {
                    return $this->fail($p->name.' nakit ile satılmıyor.', 422);
                }
                $color = ProductController::validColor($p, $it['color'] ?? null);
                if ($color === false) {
                    return $this->fail($p->name.' için geçerli bir renk seç.', 422);
                }
                $qty = (int) $it['qty'];
                if ((int) $p->stock < $qty) {
                    return $this->fail($p->name.': yeterli stok yok.', 422);
                }
                $productsKurus += (int) $p->money_price * $qty;
                $lines[] = ['p' => $p, 'qty' => $qty, 'color' => $color];
            }
            // Pending siparişleri oluştur (ödeme başarılı olunca fulfillCart 'paid' yapar).
            foreach ($lines as $ln) {
                $o = \App\Models\ProductOrder::create(array_merge($ship, [
                    'user_id'        => $request->user()->id,
                    'product_id'     => $ln['p']->id,
                    'product_name'   => $ln['p']->name,
                    'color'          => $ln['color'],
                    'qty'            => $ln['qty'],
                    'payment_type'   => 'money',
                    'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
                    'amount'         => (int) $ln['p']->money_price * $ln['qty'],
                    'status'         => 'pending',
                    'admin_note'     => $billNote,
                ]));
                $orderIds[] = $o->id;
            }
        }

        $totalKurus = $packagesKurus + $productsKurus;
        if ($totalKurus <= 0) {
            return $this->fail('Sepet tutarı geçersiz.', 422);
        }

        // İndirim kodu (opsiyonel): tüm para toplamına uygulanır.
        $discountKurus = 0;
        $discountCode = null;
        if (! empty($data['code'])) {
            $reason = null;
            $promo = \App\Models\PromoCode::usable($data['code'], $totalKurus, $reason, $request->user()?->id);
            if (! $promo) {
                return $this->fail($this->promoReason($reason), 422);
            }
            $discountKurus = $promo->discountKurus($totalKurus);
            $discountCode = $promo->code;
        }
        $chargeKurus = max(0, $totalKurus - $discountKurus);
        if ($chargeKurus <= 0) {
            return $this->fail('İndirim kodu sepeti tamamen sıfırlıyor; geçersiz.', 422);
        }

        $payment = Payment::create([
            'user_id'           => $request->user()->id,
            'kind'              => 'cart',
            'payment_method'    => $method === 'bank_transfer' ? 'bank_transfer' : null,
            'order_id'          => 'TK'.now()->format('ymdHis').mt_rand(100, 999),
            'amount'            => $chargeKurus,
            'coins'             => $packageCoins,
            'package_id'        => implode(',', $ids) ?: 'products',
            'product_order_ids' => $orderIds,
            'discount_code'     => $discountCode,
            'discount_kurus'    => $discountKurus,
            'currency'          => '949',
            'status'            => 'pending',
        ]);

        return $this->checkoutResponse($payment, $method, $garanti, [
            'amount'   => $chargeKurus,
            'coins'    => $packageCoins,
            'discount' => $discountKurus,
            'code'     => $discountCode,
        ]);
    }
}
