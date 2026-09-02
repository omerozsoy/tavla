<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Services\GarantiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

class PaymentController extends Controller
{
    // SPA: abonelik baslat -> odeme kaydi olustur, kart sayfasi (imzali) linki don.
    public function subscribe(Request $request, GarantiService $garanti)
    {
        if (! $garanti->isConfigured()) {
            return $this->fail('Ödeme sistemi henüz yapılandırılmadı.', 503);
        }
        $data = $request->validate([
            'plan'   => ['required', 'in:star,starpro'],
            'period' => ['required', 'in:yearly,monthly'],
        ]);
        $amount = config("garanti.prices.{$data['plan']}.{$data['period']}");
        if (! $amount) {
            return $this->fail('Geçersiz plan.', 422);
        }

        $payment = Payment::create([
            'user_id'  => $request->user()->id,
            'kind'     => 'subscription',
            'order_id' => 'TV'.now()->format('ymdHis').mt_rand(100, 999),
            'plan'     => $data['plan'],
            'period'   => $data['period'],
            'amount'   => $amount,
            'currency' => '949',
            'status'   => 'pending',
        ]);

        // Kart sayfasi imzali (oturum gerekmeden guvenli, 30 dk)
        $url = URL::temporarySignedRoute('pay.card', now()->addMinutes(30), ['payment' => $payment->id]);
        return response()->json(['url' => $url]);
    }

    // SPA: sepetteki coin paketlerini satin al -> tek odeme kaydi, kart sayfasi linki don.
    // Sepet [{id, qty}] gelir; FIYAT SUNUCUDA (config/garanti coin_packages) hesaplanir,
    // frontend'den gelen tutara ASLA guvenilmez.
    public function buyCoins(Request $request, GarantiService $garanti)
    {
        if (! $garanti->isConfigured()) {
            return $this->fail('Ödeme sistemi henüz yapılandırılmadı.', 503);
        }
        $data = $request->validate([
            'items'          => ['required', 'array', 'min:1', 'max:20'],
            'items.*.id'     => ['required', 'string'],
            'items.*.qty'    => ['required', 'integer', 'min:1', 'max:99'],
        ]);

        $packages = config('garanti.coin_packages', []);
        $totalKurus = 0;
        $totalCoins = 0;
        $ids = [];
        foreach ($data['items'] as $it) {
            $pkg = $packages[$it['id']] ?? null;
            if (! $pkg) {
                return $this->fail('Geçersiz coin paketi: '.$it['id'], 422);
            }
            $totalKurus += (int) $pkg['price'] * (int) $it['qty'];
            $totalCoins += (int) $pkg['gc'] * (int) $it['qty'];
            $ids[] = $it['id'].'x'.$it['qty'];
        }
        if ($totalKurus <= 0) {
            return $this->fail('Sepet tutarı geçersiz.', 422);
        }

        $payment = Payment::create([
            'user_id'    => $request->user()->id,
            'kind'       => 'coins',
            'order_id'   => 'TC'.now()->format('ymdHis').mt_rand(100, 999),
            'amount'     => $totalKurus,
            'coins'      => $totalCoins,
            'package_id' => implode(',', $ids),
            'currency'   => '949',
            'status'     => 'pending',
        ]);

        // url: eski akis (ayri kart sayfasi). submitUrl: uygulama-ici kart formu bu imzali
        // uca POST eder (SPA'da kredi karti sayfasi) -> Garanti 3D. amount kurus, coins jeton.
        $url = URL::temporarySignedRoute('pay.card', now()->addMinutes(30), ['payment' => $payment->id]);
        $submitUrl = URL::temporarySignedRoute('pay.submit', now()->addMinutes(30), ['payment' => $payment->id]);
        return response()->json([
            'url'       => $url,
            'submitUrl' => $submitUrl,
            'amount'    => $totalKurus,
            'coins'     => $totalCoins,
        ]);
    }

    // Kart giris sayfasi (imzali). Kart verisi sunucuda saklanmaz; dogrudan bankaya gider.
    public function card(Request $request, Payment $payment)
    {
        abort_unless($request->hasValidSignature() && $payment->status === 'pending', 403);
        // Form submit URL'i de imzali uretilir (bu sayfa zaten imza dogruladi) -> yalnizca
        // bu odemenin sahibi submit edebilir; baskasinin pending odemesine POST engellenir.
        $submitUrl = URL::temporarySignedRoute('pay.submit', now()->addMinutes(30), ['payment' => $payment->id]);
        return view('pay.card', ['payment' => $payment, 'submitUrl' => $submitUrl]);
    }

    // Kart formu -> Garanti 3D formunu olustur ve bankaya auto-submit et.
    public function submit(Request $request, Payment $payment, GarantiService $garanti)
    {
        abort_unless($payment->status === 'pending', 403);
        $card = $request->validate([
            'number' => ['required', 'string', 'max:25'],
            'month'  => ['required', 'string', 'max:2'],
            'year'   => ['required', 'string', 'max:4'],
            'cvv'    => ['required', 'string', 'max:4'],
        ]);
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
                $claimed = Payment::where('id', $payment->id)
                    ->where('status', 'pending')
                    ->update(['status' => 'paid', 'bank_msg' => $res['msg']]);
                if ($claimed) {
                    $u = $payment->user;
                    if ($payment->kind === 'coins') {
                        // Coin paketi: satin alinan jetonu hesaba yukle (atomik, tek kez).
                        $u->increment('coins', (int) $payment->coins);
                    } else {
                        // Uyelik: plani aktive et / yenile.
                        $u->plan = $payment->plan;
                        $u->plan_until = $payment->period === 'yearly' ? now()->addYear() : now()->addMonth();
                        // Uye olma tarihi yalnizca ILK kez set edilir (yenilemede korunur)
                        if (! $u->plan_since) {
                            $u->plan_since = now();
                        }
                        // Odeme -> otomatik yenileme yeniden acilir
                        $u->auto_renew = true;
                        $u->save();
                    }
                }
            } elseif ($payment->status === 'pending') {
                $payment->status = 'failed';
                $payment->bank_msg = $amountOk ? $res['msg'] : 'Tutar uyusmuyor';
                $payment->save();
            }
        }

        $okMsg = $payment && $payment->kind === 'coins'
            ? number_format((int) $payment->coins, 0, ',', '.').' coin hesabına yüklendi.'
            : 'Üyeliğin etkinleştirildi.';

        return view('pay.result', ['ok' => $res['ok'] && $payment, 'msg' => $res['msg'], 'okMsg' => $okMsg]);
    }
}
