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
            return response()->json(['message' => 'Ödeme sistemi henüz yapılandırılmadı.'], 503);
        }
        $data = $request->validate([
            'plan'   => ['required', 'in:star,starpro'],
            'period' => ['required', 'in:yearly,monthly'],
        ]);
        $amount = config("garanti.prices.{$data['plan']}.{$data['period']}");
        if (! $amount) {
            return response()->json(['message' => 'Geçersiz plan.'], 422);
        }

        $payment = Payment::create([
            'user_id'  => $request->user()->id,
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

    // Kart giris sayfasi (imzali). Kart verisi sunucuda saklanmaz; dogrudan bankaya gider.
    public function card(Request $request, Payment $payment)
    {
        abort_unless($request->hasValidSignature() && $payment->status === 'pending', 403);
        return view('pay.card', ['payment' => $payment]);
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

        if ($payment && $payment->status === 'pending') {
            if ($res['ok']) {
                $payment->status = 'paid';
                $payment->bank_msg = $res['msg'];
                $payment->save();
                // Plani aktive et
                $u = $payment->user;
                $u->plan = $payment->plan;
                $u->plan_until = $payment->period === 'yearly' ? now()->addYear() : now()->addMonth();
                $u->save();
            } else {
                $payment->status = 'failed';
                $payment->bank_msg = $res['msg'];
                $payment->save();
            }
        }

        return view('pay.result', ['ok' => $res['ok'], 'msg' => $res['msg']]);
    }
}
