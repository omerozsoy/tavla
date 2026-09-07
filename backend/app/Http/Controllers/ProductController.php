<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductOrder;
use App\Models\Room;
use App\Models\User;
use App\Services\GarantiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

/**
 * Fiziksel magaza (Tavla, zar, kitap, zar kulesi vb.). Katalog halka acik; siparis authed.
 * Odeme tipi urun bazinda: coin -> aninda 'paid' (atomik stok+coin dusumu), money -> Garanti
 * odemesi (kind='product', callback'te fulfill). Fiyat/stok SUNUCU-OTORITER (client'a guvenilmez).
 */
class ProductController extends Controller
{
    // GET /products — yayindaki urun katalogu (misafir dahil).
    public function index()
    {
        $products = Product::where('published', true)
            ->orderBy('sort')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Product $p) => $p->toCatalog())
            ->values();

        return response()->json(['products' => $products]);
    }

    // GET /me/orders — kullanicinin siparisleri.
    public function myOrders(Request $request)
    {
        $orders = ProductOrder::where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (ProductOrder $o) => $o->toArray())
            ->values();

        return response()->json(['orders' => $orders]);
    }

    // POST /products/order — tek urun + adet + secili renk siparisi. Odeme tipi 'coin' | 'money'.
    public function order(Request $request, GarantiService $garanti)
    {
        $data = $request->validate([
            'product_id'   => ['required', 'integer'],
            'qty'          => ['required', 'integer', 'min:1', 'max:10'],
            'color'        => ['nullable', 'string', 'max:40'],
            'payment_type' => ['required', 'in:coin,money'],
            'ship_name'    => ['required', 'string', 'max:120'],
            'ship_phone'   => ['required', 'string', 'max:40'],
            'ship_address' => ['required', 'string', 'max:1000'],
            'ship_city'    => ['required', 'string', 'max:80'],
            'ship_postal'  => ['nullable', 'string', 'max:20'],
            'note'         => ['nullable', 'string', 'max:500'],
        ]);

        $product = Product::where('published', true)->find($data['product_id']);
        if (! $product) {
            return $this->fail('Ürün bulunamadı.', 404);
        }

        $qty = (int) $data['qty'];
        if ((int) $product->stock < $qty) {
            return $this->fail('Yeterli stok yok.', 422);
        }

        // Renk dogrulama: urunun renkleri tanimliysa secilen renk gecerli olmali.
        $colors = collect($product->colors ?? [])->pluck('name')->filter()->values()->all();
        $color = $data['color'] ?? null;
        if (! empty($colors)) {
            if (! $color || ! in_array($color, $colors, true)) {
                return $this->fail('Lütfen geçerli bir renk seçin.', 422);
            }
        } else {
            $color = null; // urunun rengi yoksa yok say
        }

        $paymentType = $data['payment_type'];
        if ($paymentType === 'coin' && ! $product->acceptsCoin()) {
            return $this->fail('Bu ürün coin ile satılmıyor.', 422);
        }
        if ($paymentType === 'money' && ! $product->acceptsMoney()) {
            return $this->fail('Bu ürün nakit ile satılmıyor.', 422);
        }

        $ship = [
            'ship_name'    => $data['ship_name'],
            'ship_phone'   => $data['ship_phone'],
            'ship_address' => $data['ship_address'],
            'ship_city'    => $data['ship_city'],
            'ship_postal'  => $data['ship_postal'] ?? null,
            'note'         => $data['note'] ?? null,
        ];

        return $paymentType === 'coin'
            ? $this->orderWithCoins($request, $product, $qty, $color, $ship)
            : $this->orderWithMoney($request, $product, $qty, $color, $ship, $garanti);
    }

    // Coin ile: ATOMIK stok + coin dusumu, siparis aninda 'paid'. ShopController::buy ile ayni
    // koruma (pct-bahis kilidi + KULLANILABILIR bakiye = coins - reserved).
    private function orderWithCoins(Request $request, Product $product, int $qty, ?string $color, array $ship)
    {
        $unit = (int) $product->coin_price;
        $cost = $unit * $qty;

        $r = DB::transaction(function () use ($request, $product, $qty, $color, $ship, $cost) {
            $u = User::lockForUpdate()->find($request->user()->id);

            if (Room::userInPctStakedPlaying($u->id)) {
                return ['pct_locked' => true];
            }
            if ((($u->coins ?? 0) - ($u->coins_reserved ?? 0)) < $cost) {
                return ['insufficient' => true, 'coins' => $u->coins ?? 0];
            }
            // Stok satir kilidi: eszamanli satista asiri satisi engelle.
            $fresh = Product::lockForUpdate()->find($product->id);
            if (! $fresh || (int) $fresh->stock < $qty) {
                return ['no_stock' => true];
            }

            $u->coins = ($u->coins ?? 0) - $cost;
            $u->save();
            $fresh->decrement('stock', $qty);

            $order = ProductOrder::create(array_merge($ship, [
                'user_id'      => $u->id,
                'product_id'   => $product->id,
                'product_name' => $product->name,
                'color'        => $color,
                'qty'          => $qty,
                'payment_type' => 'coin',
                'coin_cost'    => $cost,
                'status'       => 'paid',
            ]));

            return ['order' => $order, 'coins' => $u->coins];
        });

        if (isset($r['pct_locked'])) {
            return $this->fail('Yüzde bahisli maçtayken coin harcayamazsın. Maç bitince tekrar dene.', 422);
        }
        if (isset($r['insufficient'])) {
            return $this->fail('Yetersiz coin.', 422, ['coins' => $r['coins']]);
        }
        if (isset($r['no_stock'])) {
            return $this->fail('Yeterli stok yok.', 422);
        }

        return response()->json([
            'ok'    => true,
            'kind'  => 'coin',
            'coins' => $r['coins'],
            'order' => $r['order']->toArray(),
        ]);
    }

    // Gercek para ile: siparis 'pending' + Payment kind='product'; kart sayfasi/submit imzali
    // URL doner (buyCoins ile ayni akis). Odeme basariliysa callback/demo siparisi 'paid' yapar.
    private function orderWithMoney(Request $request, Product $product, int $qty, ?string $color, array $ship, GarantiService $garanti)
    {
        if (! $garanti->isAvailable()) {
            return $this->fail('Ödeme sistemi henüz yapılandırılmadı.', 503);
        }

        $amount = (int) $product->money_price * $qty; // KURUS
        if ($amount <= 0) {
            return $this->fail('Ürün fiyatı geçersiz.', 422);
        }

        $order = ProductOrder::create(array_merge($ship, [
            'user_id'      => $request->user()->id,
            'product_id'   => $product->id,
            'product_name' => $product->name,
            'color'        => $color,
            'qty'          => $qty,
            'payment_type' => 'money',
            'amount'       => $amount,
            'status'       => 'pending',
        ]));

        $payment = Payment::create([
            'user_id'          => $request->user()->id,
            'kind'             => 'product',
            'order_id'         => 'TP'.now()->format('ymdHis').mt_rand(100, 999),
            'amount'           => $amount,
            'package_id'       => $product->slug.'x'.$qty,
            'product_order_id' => $order->id,
            'currency'         => '949',
            'status'           => 'pending',
        ]);
        $order->payment_id = $payment->id;
        $order->save();

        $url = URL::temporarySignedRoute('pay.card', now()->addMinutes(30), ['payment' => $payment->id]);
        $submitUrl = URL::temporarySignedRoute('pay.submit', now()->addMinutes(30), ['payment' => $payment->id]);

        return response()->json([
            'ok'        => true,
            'kind'      => 'money',
            'url'       => $url,
            'submitUrl' => $submitUrl,
            'amount'    => $amount,
            'order_id'  => $order->id,
            'demo'      => $garanti->isDemo(),
        ]);
    }
}
