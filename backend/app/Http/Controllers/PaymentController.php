<?php

namespace App\Http\Controllers;

use App\Models\CoinPackage;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductOrder;
use App\Models\PromoCode;
use App\Models\Setting;
use App\Models\Tournament;
use App\Models\User;
use App\Models\UserStat;
use App\Services\PayTRService;
use App\Services\WalletService;
use App\Support\TournamentModeration;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;

class PaymentController extends Controller
{
    // ---- Havale/EFT (admin panel: Ayarlar > Havale/EFT) ----

    /** Havale bilgileri (IBAN + hesap sahibi + banka + müşteri açıklaması). */
    public static function bankTransferInfo(): array
    {
        return [
            'enabled' => Setting::bool('bank_transfer_enabled', false),
            'iban' => Setting::get('bank_transfer_iban'),
            'name' => Setting::get('bank_transfer_name'),
            'bank' => Setting::get('bank_transfer_bank'),
            'note' => Setting::get('bank_transfer_note'),
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
            'iban' => $i['iban'],
            'name' => $i['name'],
            'bank' => $i['bank'],
            'note' => $i['note'],
        ]);
    }

    // Checkout ön-kontrol: havale -> açık olmalı; kart -> PayTR hazır olmalı. Uygunsa null.
    private function checkoutGuard(string $method, PayTRService $paytr)
    {
        if ($method === 'bank_transfer') {
            return self::bankEnabled() ? null : $this->fail('Havale/EFT ödemesi şu an kapalı.', 503);
        }

        return $paytr->isAvailable() ? null : $this->fail('Ödeme sistemi henüz yapılandırılmadı.', 503);
    }

    // Kart ödemesi için imzalı PayTR iframe sayfası URL'i (hem PaymentController hem ProductController
    // kullanır). Sayfa açılınca sunucu PayTR token'ı alıp kart formu iframe'ini gösterir.
    public static function cardCheckoutUrl(Payment $payment): string
    {
        return URL::temporarySignedRoute('pay.iframe', now()->addMinutes(30), ['payment' => $payment->id]);
    }

    // Ödeme kaydı oluşturulduktan sonra dönen JSON: havale -> IBAN + referans; kart -> imzalı PayTR
    // iframe sayfası URL'i + demo. $extra: akışa özel alanlar (coins, discount, code...).
    private function checkoutResponse(Payment $payment, string $method, PayTRService $paytr, array $extra = [])
    {
        if ($method === 'bank_transfer') {
            $i = self::bankTransferInfo();

            return response()->json(array_merge([
                'bankTransfer' => true,
                'reference' => $payment->order_id,
                'amount' => (int) $payment->amount,
                'iban' => $i['iban'],
                'name' => $i['name'],
                'bank' => $i['bank'],
                'note' => $i['note'],
            ], $extra));
        }

        return response()->json(array_merge([
            'url' => self::cardCheckoutUrl($payment), // SPA bu URL'e YÖNLENDİRİR (PayTR iframe sayfası)
            'amount' => (int) $payment->amount,
            'demo' => $paytr->isDemo(),
        ], $extra));
    }

    // SPA: abonelik baslat -> odeme kaydi olustur, kart sayfasi (imzali) linki / havale bilgisi don.
    public function subscribe(Request $request, PayTRService $paytr)
    {
        $data = $request->validate([
            'plan' => ['required', 'in:premium'],
            'period' => ['required', 'in:yearly'], // yalnız yıllık üyelik (aylık kaldırıldı)
            'method' => ['nullable', 'in:card,bank_transfer'],
        ]);
        $method = $data['method'] ?? 'card';
        if ($guard = $this->checkoutGuard($method, $paytr)) {
            return $guard;
        }
        $amount = config("paytr.prices.{$data['plan']}.{$data['period']}");
        if (! $amount) {
            return $this->fail('Geçersiz plan.', 422);
        }

        $payment = Payment::create([
            'user_id' => $request->user()->id,
            'kind' => 'subscription',
            'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
            'order_id' => 'TV'.now()->format('ymdHis').strtoupper(bin2hex(random_bytes(4))),
            'plan' => $data['plan'],
            'period' => $data['period'],
            'amount' => $amount,
            'currency' => '949',
            'status' => 'pending',
        ]);

        return $this->checkoutResponse($payment, $method, $paytr);
    }

    // SPA: sepetteki coin paketlerini satin al -> tek odeme kaydi, kart sayfasi linki don.
    // Sepet [{id, qty}] gelir; FIYAT SUNUCUDA (config/garanti coin_packages) hesaplanir,
    // frontend'den gelen tutara ASLA guvenilmez.
    public function buyCoins(Request $request, PayTRService $paytr)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.id' => ['required', 'string'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
            'code' => ['nullable', 'string', 'max:40'],
            'method' => ['nullable', 'in:card,bank_transfer'],
        ]);
        $method = $data['method'] ?? 'card';
        if ($guard = $this->checkoutGuard($method, $paytr)) {
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
        // Kod kontrolü + ödeme kaydı promo satırı kilitli tek transaction'da (A-08: eşzamanlı checkout).
        $zeroCharge = false;
        [$payment, $reason] = PromoCode::checkoutWithLock($data['code'] ?? null, $totalKurus, $request->user()?->id,
            function ($promo) use ($request, $method, $totalKurus, $totalCoins, $ids, &$zeroCharge) {
                $discountKurus = $promo ? $promo->discountKurus($totalKurus) : 0;
                $chargeKurus = $totalKurus - $discountKurus;
                if ($chargeKurus <= 0) {
                    $zeroCharge = true;

                    return null;
                }

                return Payment::create([
                    'user_id' => $request->user()->id,
                    'kind' => 'coins',
                    'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
                    'order_id' => 'TC'.now()->format('ymdHis').strtoupper(bin2hex(random_bytes(4))),
                    'amount' => $chargeKurus,
                    'coins' => $totalCoins,
                    'package_id' => implode(',', $ids),
                    'discount_code' => $promo?->code,
                    'discount_kurus' => $discountKurus,
                    'currency' => '949',
                    'status' => 'pending',
                ]);
            });
        if ($zeroCharge) {
            return $this->fail('İndirim kodu sepeti tamamen sıfırlıyor; geçersiz.', 422);
        }
        if (! $payment) {
            return $this->fail($this->promoReason($reason), 422);
        }
        $chargeKurus = (int) $payment->amount;
        $discountKurus = (int) $payment->discount_kurus;
        $discountCode = $payment->discount_code;

        // Kart: url (eski ayrı sayfa) + submitUrl (uygulama-içi form) -> Garanti 3D.
        // Havale: IBAN + referans (order_id) döner; ödeme admin panelden elle onaylanır.
        return $this->checkoutResponse($payment, $method, $paytr, [
            'amount' => $chargeKurus,
            'coins' => $totalCoins,
            'discount' => $discountKurus,
            'code' => $discountCode,
        ]);
    }

    // SPA: "Üyeliğini Uzat" -> sepetteki 1 yillik Premium uzatmayi satin al. Tek urun; FIYAT
    // SUNUCUDA (config/garanti.renew), client'a guvenilmez. buyCoins ile ayni donus sekli
    // (url/submitUrl/amount/demo) -> ayni uygulama-ici odeme sayfasi kullanilir. kind='renew':
    // callback'te plan_until'a +1 yil EKLENIR (sifirlanmaz).
    public function buyMembership(Request $request, PayTRService $paytr)
    {
        $data = $request->validate([
            'method' => ['nullable', 'in:card,bank_transfer'],
        ]);
        $method = $data['method'] ?? 'card';
        if ($guard = $this->checkoutGuard($method, $paytr)) {
            return $guard;
        }
        $amount = (int) config('paytr.renew.yearly', 49900);
        if ($amount <= 0) {
            return $this->fail('Üyelik fiyatı yapılandırılmamış.', 422);
        }

        $payment = Payment::create([
            'user_id' => $request->user()->id,
            'kind' => 'renew',
            'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
            'order_id' => 'TM'.now()->format('ymdHis').strtoupper(bin2hex(random_bytes(4))),
            'plan' => 'premium',
            'period' => 'yearly',
            'amount' => $amount,
            'currency' => '949',
            'status' => 'pending',
        ]);

        return $this->checkoutResponse($payment, $method, $paytr);
    }

    // kind='product' odemesi basariliysa bagli siparisi 'paid' yap + stok dus (idempotent:
    // yalniz 'pending' siparis islenir). ATOMIK claim'in ICINDE cagrilir (tek kez). Stok
    // arada tukendiyse siparis yine 'paid' olur (para alindi) ama admin notu dusulur.
    private function fulfillProductOrder(Payment $payment): void
    {
        if (! $payment->product_order_id) {
            return;
        }
        $order = ProductOrder::where('id', $payment->product_order_id)
            ->where('status', 'pending')
            ->first();
        if (! $order) {
            return;
        }
        $order->status = 'paid';
        if ($order->product_id) {
            $dec = Product::where('id', $order->product_id)
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
    private function activateMembership(User $u, Payment $payment): void
    {
        $future = $u->plan_until && Carbon::parse($u->plan_until)->isFuture();
        $base = $future ? Carbon::parse($u->plan_until) : now();
        $u->plan = $payment->plan ?: 'premium';
        $u->plan_until = $payment->period === 'monthly'
            ? $base->copy()->addMonth()
            : $base->copy()->addYear();
        if (! $u->plan_since) {
            $u->plan_since = now();
        }
        $u->auto_renew = true;
        $u->stampPlanSource('payment'); // premium KAYNAĞI = ödeme (panel Cüzdan/Üyelik sekmesi)
        $u->save();
    }

    // Sepet alt toplami (kurus) + coin + id ozetleri. SUNUCU-OTORITER: fiyat DB coin_packages
    // tablosundan (panelden yonetilir), client'a GUVENILMEZ. Donus: [totalKurus, totalCoins, ids[], errorOrNull].
    private function coinSubtotal(array $items): array
    {
        $slugs = array_values(array_unique(array_map(fn ($it) => (string) $it['id'], $items)));
        $packages = CoinPackage::where('published', true)
            ->whereIn('slug', $slugs)
            ->get()
            ->keyBy('slug');
        $totalKurus = 0;
        $totalCoins = 0;
        $ids = [];
        foreach ($items as $it) {
            $pkg = $packages[$it['id']] ?? null;
            if (! $pkg) {
                return [0, 0, [], 'Geçersiz coin paketi: '.$it['id']];
            }
            $totalKurus += (int) $pkg->price * (int) $it['qty'];
            $totalCoins += (int) $pkg->coins * (int) $it['qty'];
            $ids[] = $it['id'].'x'.$it['qty'];
        }

        return [$totalKurus, $totalCoins, $ids, null];
    }

    // PUBLIC katalog: yayindaki coin paketleri (Magaza > Coin Paketleri panelinden yonetilir).
    // Frontend bunu CANLI ceker (src/coinPackages.ts fallback + useCoinPackages) -> panelde fiyat
    // degisince site aninda yansir. id=slug (sepet/odeme anahtari), price TL (kurus/100).
    public function coinPackagesCatalog()
    {
        $packages = CoinPackage::where('published', true)
            ->orderBy('sort')
            ->get()
            ->map(fn ($p) => $p->toCatalog())
            ->values();

        return response()->json(['packages' => $packages]);
    }

    // Promo dogrulama gerekce -> kullanici mesaji.
    private function promoReason(?string $reason): string
    {
        return match ($reason) {
            'expired' => 'İndirim kodunun süresi dolmuş.',
            'exhausted' => 'İndirim kodu kullanım limitine ulaştı.',
            'min_amount' => 'İndirim kodu için sepet tutarı yetersiz.',
            'already_used' => 'Bu indirim kodunu zaten kullandın.',
            default => 'İndirim kodu geçersiz.',
        };
    }

    // POST /shop/promo/validate — sepet + kod -> sunucu indirimi hesaplar (odeme baslatmadan).
    public function promoValidate(Request $request)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.id' => ['required', 'string'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
            'code' => ['required', 'string', 'max:40'],
        ]);
        [$totalKurus, , , $err] = $this->coinSubtotal($data['items']);
        if ($err || $totalKurus <= 0) {
            return $this->fail($err ?: 'Sepet tutarı geçersiz.', 422);
        }
        $reason = null;
        $promo = PromoCode::usable($data['code'], $totalKurus, $reason, $request->user()?->id);
        if (! $promo) {
            return $this->fail($this->promoReason($reason), 422);
        }
        $discount = $promo->discountKurus($totalKurus);

        return response()->json([
            'code' => $promo->code,
            'type' => $promo->type,
            'value' => (int) $promo->value,
            'discount' => $discount,                        // kurus
            'subtotal' => $totalKurus,                      // kurus
            'final' => max(0, $totalKurus - $discount),  // kurus
        ]);
    }

    // PayTR iframe sayfasi (imzali). Sunucu PayTR token'i alir ve kart formu iframe'ini gosterir.
    // Kart verisi PayTR tarafinda girilir; bize ASLA ulasmaz (PCI yuku PayTR'de). Demo'da aninda fulfill.
    public function iframe(Request $request, Payment $payment, PayTRService $paytr)
    {
        abort_if($payment->payment_method === 'bank_transfer', 404); // havale iframe'le ödenmez
        abort_unless($request->hasValidSignature() && $payment->status === 'pending', 403);

        // DEMO: PayTR yapilandirilmadi. Gercek odeme YOK; odemeyi basarili say, coin/plani ver.
        if ($paytr->isDemo()) {
            return $this->fulfillDemo($payment);
        }

        $okUrl = route('pay.result', ['ok' => 1]);
        $failUrl = route('pay.result', ['ok' => 0]);
        try {
            $token = $paytr->createToken(
                $payment,
                $payment->user->email ?? '',
                (string) $request->ip(),
                $okUrl,
                $failUrl,
            );
        } catch (\Throwable $e) {
            Log::error('pay.iframe: PayTR token alinamadi', ['payment_id' => $payment->id, 'err' => $e->getMessage()]);

            return view('pay.result', ['ok' => false, 'msg' => 'Ödeme başlatılamadı. Lütfen tekrar deneyin.', 'okMsg' => '']);
        }

        return view('pay.paytr', ['iframeUrl' => $paytr->iframeUrl($token)]);
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
            $u = User::lockForUpdate()->find($locked->user_id);
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
            'ok' => true,
            'msg' => 'DEMO ödeme — gerçek tahsilat yapılmadı.',
            'okMsg' => $okMsg,
        ]);
    }

    // SPA: TL'li turnuvaya katilim odemesi baslat (YALNIZ KART/3D; havale yok). Fiyat SUNUCU-OTORITER
    // (tournament.entry_fee_try, KURUS). Basarili callback'te oyuncu turnuvaya kaydedilir
    // (fulfillTournamentEntry). Kapasite/kayit son soz callback'te; buradaki kontroller erken-ret icin.
    public function tournamentEntry(Request $request, Tournament $tournament, PayTRService $paytr)
    {
        $me = $request->user();
        $price = (int) ($tournament->entry_fee_try ?? 0);
        if ($price <= 0) {
            return $this->fail('Bu turnuva TL ile ödeme kabul etmiyor.', 422);
        }
        if ($tournament->status !== 'open') {
            return $this->fail('Turnuva kayıtları kapalı.', 422);
        }
        if (TournamentModeration::isRegistered($tournament, $me->id)) {
            return $this->fail('Bu turnuvaya zaten kayıtlısın.', 422);
        }
        if ($tournament->premium_only && $me->plan_active === 'free') {
            return response()->json(['message' => 'Bu turnuva Premium üyelere özeldir.', 'code' => 'premium_required'], 403);
        }
        // Katilim sifresi (varsa) odeme BASLAMADAN dogrulanir (join ile ayni kapi).
        $pw = (string) ($tournament->join_password ?? '');
        if ($pw !== '' && ! hash_equals($pw, (string) $request->input('password', ''))) {
            return response()->json(['message' => 'Turnuva şifresi hatalı.', 'code' => 'password_required'], 403);
        }
        $count = count(array_filter($tournament->players ?? [], fn ($p) => $p !== null));
        if ($tournament->size > 0 && $count >= $tournament->size) {
            return $this->fail('Turnuva dolu.', 422);
        }
        if ($guard = $this->checkoutGuard('card', $paytr)) { // YALNIZ kart
            return $guard;
        }

        $payment = Payment::create([
            'user_id' => $me->id,
            'kind' => 'tournament_entry',
            'order_id' => 'TT'.now()->format('ymdHis').strtoupper(bin2hex(random_bytes(4))),
            'amount' => $price,
            'tournament_id' => $tournament->id,
            'currency' => '949',
            'status' => 'pending',
        ]);

        return $this->checkoutResponse($payment, 'card', $paytr);
    }

    // PayTR bildirim (sunucu->sunucu callback). HMAC dogrula -> basariliysa fulfill. PayTR, govdede
    // DÜZ "OK" bekler; aksi halde bildirimi tekrar tekrar yollar. Bu yuzden imzasi GEÇERLİ her
    // bildirime 'OK' doneriz (isimizi yaptik); yalniz hash BOZUK ise reddederiz (sahte/forged).
    public function paytrCallback(Request $request, PayTRService $paytr)
    {
        $post = $request->all();
        $res = $paytr->verifyCallback($post);

        // Sahte/imzasiz bildirim: ASLA fulfill etme, OK deme (PayTR gecerli imzayla tekrar dener).
        if (! $res['hash_ok']) {
            Log::warning('paytr.callback: hash dogrulanamadi (sahte/forged?)', [
                'order_id' => $res['order_id'] ?? null,
                'ip' => $request->ip(),
            ]);

            return response('PAYTR notification failed: bad hash', 400);
        }

        $payment = Payment::where('order_id', $res['order_id'])->first();

        // Tutar: PayTR total_amount (KURUS). Taksit komisyonu EKLEYEBILIR -> kayitli tutardan AZ olamaz
        // (az ise suphe -> fulfill etme). hash zaten total_amount'u imzaladigindan sahtelenemez.
        $recAmount = $payment ? (int) $payment->amount : 0;
        $bankAmount = (int) round((float) $res['amount']);
        $amountOk = $payment && $bankAmount >= $recAmount;

        Log::info('payment.callback.paytr', [
            'order_id' => $res['order_id'] ?? null,
            'user_id' => $payment->user_id ?? null,
            'paid' => $res['paid'] ?? false,
            'bank_amount' => $res['amount'] ?? null,
            'record_amount' => $recAmount ?: null,
            'amount_ok' => $amountOk,
            'ip' => $request->ip(),
        ]);

        if ($payment) {
            if ($res['paid'] && $amountOk) {
                // ATOMIK idempotency: yalnizca ILK basarili bildirim fulfill eder (retry/replay'de cift yok).
                DB::transaction(function () use ($payment, $res) {
                    $locked = Payment::where('id', $payment->id)->lockForUpdate()->first();
                    if (! $locked || $locked->status !== 'pending') {
                        return;
                    }
                    $u = User::lockForUpdate()->find($locked->user_id);
                    if (! $u) {
                        throw new \RuntimeException('Ödeme hesabı bulunamadı.');
                    }
                    $locked->status = 'paid';
                    $locked->bank_msg = $res['msg'];
                    $locked->setRelation('user', $u);
                    $locked->save();
                    $this->fulfillPayment($locked);
                });
            } elseif ($payment->status === 'pending') {
                // Imzali ama basarisiz (status=failed) VEYA tutar uyumsuz -> bekleyen odemeyi dusur.
                DB::transaction(function () use ($payment, $amountOk, $res) {
                    $locked = Payment::whereKey($payment->id)->lockForUpdate()->first();
                    if (! $locked || $locked->status !== 'pending') {
                        return;
                    }
                    $locked->status = 'failed';
                    $locked->bank_msg = ! $amountOk && $res['paid'] ? 'Tutar uyusmuyor' : $res['msg'];
                    $locked->save();
                });
            }
        }

        // Imza gecerli -> isimizi yaptik: PayTR'ye DÜZ "OK" (yoksa bildirimi tekrarlar).
        return response('OK');
    }

    /** Apply one already-claimed payment while its payment and user rows are locked. */
    private function fulfillPayment(Payment $payment): void
    {
        $u = $payment->user;
        if ($payment->kind === 'coins') {
            app(WalletService::class)->credit($u, (int) $payment->coins, 'payment', Payment::class, $payment->id);
            if (! empty($payment->discount_code)) {
                PromoCode::bumpUse($payment->discount_code); // atomik + limit-güvenli
            }
        } elseif ($payment->kind === 'product') {
            $this->fulfillProductOrder($payment);
        } elseif ($payment->kind === 'cart') {
            $this->fulfillCart($payment);
        } elseif ($payment->kind === 'tournament_entry') {
            $this->fulfillTournamentEntry($payment);
        } else {
            $this->activateMembership($u, $payment);
        }
    }

    // TL ödemesi başarılı -> oyuncuyu turnuvaya kaydet. ATOMIK claim'in İÇİNDE (payment+user kilitli);
    // turnuva satırını da kilitler. feePaid=0 coin verilir: TL iadesi coin DEĞİL (manuel) -> çıkış/iptalde
    // coin mint edilmez. Turnuva kayda kapalıysa (başladı/dolu-değişti) kayıt YAPILMAZ, LOGLANIR: para
    // alındı ama kayıt olmadı -> yönetici elle iade/kayıt eder (TL iadesi zaten manuel).
    private function fulfillTournamentEntry(Payment $payment): void
    {
        $t = Tournament::whereKey($payment->tournament_id)->lockForUpdate()->first();
        if (! $t || $t->status !== 'open') {
            Log::warning('tournament_entry: turnuva kayda uygun değil, ödeme alındı', [
                'payment_id' => $payment->id,
                'tournament_id' => $payment->tournament_id,
                'status' => $t->status ?? null,
            ]);

            return;
        }
        if (TournamentModeration::register($t, $payment->user, 0)) {
            UserStat::forUser($payment->user_id)->increment('tournaments_played');
        }
    }

    // Odeme turune gore basari mesaji.
    private function fulfillMessage(Payment $payment): string
    {
        return match ($payment->kind) {
            'coins' => number_format((int) $payment->coins, 0, ',', '.').' coin hesabına yüklendi.',
            'product' => 'Siparişin alındı. Kargo süreci başlayınca bilgilendirileceksin.',
            'cart' => 'Ödemen alındı. '.((int) $payment->coins > 0 ? number_format((int) $payment->coins, 0, ',', '.').' coin yüklendi; ' : '').'siparişlerin hazırlanıyor.',
            'renew' => 'Üyeliğin uzatıldı.',
            'tournament_entry' => 'Turnuva kaydın tamamlandı. Başarılar!',
            default => 'Üyeliğin etkinleştirildi.',
        };
    }

    // Ortak sepet ödemesi (kind='cart') fulfillment: coin paketlerini yükle + promo + tüm
    // bağlı fiziksel sipariş satırlarını 'paid' yap ve stok düş. ATOMIK claim'in İÇİNDE (tek kez).
    private function fulfillCart(Payment $payment): void
    {
        $u = $payment->user;
        if ((int) $payment->coins > 0) {
            app(WalletService::class)->credit($u, (int) $payment->coins, 'payment_cart', Payment::class, $payment->id);
        }
        if (! empty($payment->discount_code)) {
            PromoCode::bumpUse($payment->discount_code); // atomik + limit-güvenli
        }
        foreach ((array) ($payment->product_order_ids ?? []) as $oid) {
            $order = ProductOrder::where('id', $oid)->where('status', 'pending')->first();
            if (! $order) {
                continue;
            }
            $order->status = 'paid';
            if ($order->product_id) {
                $dec = Product::where('id', $order->product_id)
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
    public function cartCheckout(Request $request, PayTRService $paytr)
    {
        $data = $request->validate([
            'coin_items' => ['nullable', 'array', 'max:20'],
            'coin_items.*.id' => ['required_with:coin_items', 'string'],
            'coin_items.*.qty' => ['required_with:coin_items', 'integer', 'min:1', 'max:99'],
            'products' => ['nullable', 'array', 'max:20'],
            'products.*.product_id' => ['required_with:products', 'integer'],
            'products.*.qty' => ['required_with:products', 'integer', 'min:1', 'max:10'],
            'products.*.color' => ['nullable', 'string', 'max:40'],
            'shipping_address_id' => ['nullable', 'integer'],
            'billing_address_id' => ['nullable', 'integer'],
            'note' => ['nullable', 'string', 'max:500'],
            'code' => ['nullable', 'string', 'max:40'],
            'method' => ['nullable', 'in:card,bank_transfer'],
        ]);
        $method = $data['method'] ?? 'card';
        if ($guard = $this->checkoutGuard($method, $paytr)) {
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
                $p = Product::where('published', true)->find($it['product_id']);
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
                $o = ProductOrder::create(array_merge($ship, [
                    'user_id' => $request->user()->id,
                    'product_id' => $ln['p']->id,
                    'product_name' => $ln['p']->name,
                    'color' => $ln['color'],
                    'qty' => $ln['qty'],
                    'payment_type' => 'money',
                    'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
                    'amount' => (int) $ln['p']->money_price * $ln['qty'],
                    'status' => 'pending',
                    'admin_note' => $billNote,
                ]));
                $orderIds[] = $o->id;
            }
        }

        $totalKurus = $packagesKurus + $productsKurus;
        if ($totalKurus <= 0) {
            return $this->fail('Sepet tutarı geçersiz.', 422);
        }

        // İndirim kodu (opsiyonel): tüm para toplamına uygulanır. Kilitli tek transaction (A-08).
        $zeroCharge = false;
        [$payment, $reason] = PromoCode::checkoutWithLock($data['code'] ?? null, $totalKurus, $request->user()?->id,
            function ($promo) use ($request, $method, $totalKurus, $packageCoins, $ids, $orderIds, &$zeroCharge) {
                $discountKurus = $promo ? $promo->discountKurus($totalKurus) : 0;
                $chargeKurus = max(0, $totalKurus - $discountKurus);
                if ($chargeKurus <= 0) {
                    $zeroCharge = true;

                    return null;
                }

                return Payment::create([
                    'user_id' => $request->user()->id,
                    'kind' => 'cart',
                    'payment_method' => $method === 'bank_transfer' ? 'bank_transfer' : null,
                    'order_id' => 'TK'.now()->format('ymdHis').strtoupper(bin2hex(random_bytes(4))),
                    'amount' => $chargeKurus,
                    'coins' => $packageCoins,
                    'package_id' => implode(',', $ids) ?: 'products',
                    'product_order_ids' => $orderIds,
                    'discount_code' => $promo?->code,
                    'discount_kurus' => $discountKurus,
                    'currency' => '949',
                    'status' => 'pending',
                ]);
            });
        if ($zeroCharge) {
            return $this->fail('İndirim kodu sepeti tamamen sıfırlıyor; geçersiz.', 422);
        }
        if (! $payment) {
            return $this->fail($this->promoReason($reason), 422);
        }
        $chargeKurus = (int) $payment->amount;
        $discountKurus = (int) $payment->discount_kurus;
        $discountCode = $payment->discount_code;

        return $this->checkoutResponse($payment, $method, $paytr, [
            'amount' => $chargeKurus,
            'coins' => $packageCoins,
            'discount' => $discountKurus,
            'code' => $discountCode,
        ]);
    }
}
