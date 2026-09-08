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
        $products = Product::with('category')
            ->where('published', true)
            ->orderBy('sort')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Product $p) => $p->toCatalog())
            ->values();

        // Yayindaki TUM kategoriler (urunu olmayan 'coin' gibi rezerve kategoriler dahil).
        // Magaza coin sekmesi admin'de verilen kategori adini bundan alir.
        $categories = \App\Models\ProductCategory::where('published', true)
            ->orderBy('sort')
            ->orderBy('name')
            ->get(['slug', 'name'])
            ->map(fn ($c) => ['slug' => $c->slug, 'name' => $c->name])
            ->values();

        return response()->json(['products' => $products, 'categories' => $categories]);
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

    // ---- SEPET (ortak sepet) yardımcıları ----

    // Seçili teslimat adresini (kullanıcıya ait, type=shipping) sipariş ship_* alanlarına çevir.
    public static function resolveShip(int $userId, int $addressId, ?string $note): ?array
    {
        $a = \App\Models\UserAddress::where('user_id', $userId)->where('type', 'shipping')->find($addressId);
        if (! $a) {
            return null;
        }
        return [
            'ship_name'    => $a->name,
            'ship_phone'   => $a->phone,
            'ship_address' => trim($a->address.($a->district ? ', '.$a->district : '')),
            'ship_city'    => $a->city,
            'ship_postal'  => $a->postal,
            'note'         => $note,
        ];
    }

    // Fatura adresini kısa bir admin notuna çevir (ProductOrder'da ayrı fatura alanı yok).
    public static function billingNote(int $userId, ?int $addressId): ?string
    {
        if (! $addressId) {
            return null;
        }
        $a = \App\Models\UserAddress::where('user_id', $userId)->where('type', 'billing')->find($addressId);
        if (! $a) {
            return null;
        }
        return '[Fatura] '.($a->company ? $a->company.' — ' : '').$a->name.' | '.$a->address.' '.$a->city
            .($a->tax_office ? ' | VD: '.$a->tax_office : '').($a->tax_number ? ' | VNo: '.$a->tax_number : '');
    }

    // Renk doğrula: üründe renk yoksa null; varsa seçilen geçerli olmalı (değilse false).
    public static function validColor(Product $p, ?string $color)
    {
        $colors = collect($p->colors ?? [])->pluck('name')->filter()->values()->all();
        if (empty($colors)) {
            return null;
        }
        return ($color && in_array($color, $colors, true)) ? $color : false;
    }

    // POST /products/cart/coin — sepetteki COIN ödemeli ürünleri ATOMIK, çok-ürün, anında sipariş.
    public function cartCoinOrder(Request $request)
    {
        $data = $request->validate([
            'items'               => ['required', 'array', 'min:1', 'max:20'],
            'items.*.product_id'  => ['required', 'integer'],
            'items.*.qty'         => ['required', 'integer', 'min:1', 'max:10'],
            'items.*.color'       => ['nullable', 'string', 'max:40'],
            'shipping_address_id' => ['required', 'integer'],
            'billing_address_id'  => ['nullable', 'integer'],
            'note'                => ['nullable', 'string', 'max:500'],
        ]);

        $ship = self::resolveShip($request->user()->id, $data['shipping_address_id'], $data['note'] ?? null);
        if (! $ship) {
            return $this->fail('Geçerli bir teslimat adresi seç.', 422);
        }
        $billNote = self::billingNote($request->user()->id, $data['billing_address_id'] ?? null);

        // Ürün satırlarını doğrula + coin toplamını hesapla (SUNUCU fiyatı).
        $lines = [];
        $total = 0;
        foreach ($data['items'] as $it) {
            $p = Product::where('published', true)->find($it['product_id']);
            if (! $p) {
                return $this->fail('Ürün bulunamadı.', 404);
            }
            if (! $p->acceptsCoin()) {
                return $this->fail($p->name.' coin ile satılmıyor.', 422);
            }
            $color = self::validColor($p, $it['color'] ?? null);
            if ($color === false) {
                return $this->fail($p->name.' için geçerli bir renk seç.', 422);
            }
            $qty = (int) $it['qty'];
            $total += (int) $p->coin_price * $qty;
            $lines[] = ['p' => $p, 'qty' => $qty, 'color' => $color];
        }

        $r = DB::transaction(function () use ($request, $lines, $total, $ship, $billNote) {
            $u = User::lockForUpdate()->find($request->user()->id);
            if (Room::userInPctStakedPlaying($u->id)) {
                return ['pct_locked' => true];
            }
            if ((($u->coins ?? 0) - ($u->coins_reserved ?? 0)) < $total) {
                return ['insufficient' => true, 'coins' => $u->coins ?? 0];
            }
            // Önce TÜM stokları kilitle+doğrula (kısmi sipariş olmasın), sonra düş+oluştur.
            $fresh = [];
            foreach ($lines as $i => $ln) {
                $f = Product::lockForUpdate()->find($ln['p']->id);
                if (! $f || (int) $f->stock < $ln['qty']) {
                    return ['no_stock' => true, 'name' => $ln['p']->name];
                }
                $fresh[$i] = $f;
            }
            $orders = [];
            foreach ($lines as $i => $ln) {
                $fresh[$i]->decrement('stock', $ln['qty']);
                $orders[] = ProductOrder::create(array_merge($ship, [
                    'user_id'      => $u->id,
                    'product_id'   => $ln['p']->id,
                    'product_name' => $ln['p']->name,
                    'color'        => $ln['color'],
                    'qty'          => $ln['qty'],
                    'payment_type' => 'coin',
                    'coin_cost'    => (int) $ln['p']->coin_price * $ln['qty'],
                    'status'       => 'paid',
                    'admin_note'   => $billNote,
                ]));
            }
            $u->coins = ($u->coins ?? 0) - $total;
            $u->save();
            return ['orders' => $orders, 'coins' => $u->coins];
        });

        if (isset($r['pct_locked'])) {
            return $this->fail('Yüzde bahisli maçtayken coin harcayamazsın. Maç bitince tekrar dene.', 422);
        }
        if (isset($r['insufficient'])) {
            return $this->fail('Yetersiz coin.', 422, ['coins' => $r['coins']]);
        }
        if (isset($r['no_stock'])) {
            return $this->fail(($r['name'] ?? 'Ürün').': yeterli stok yok.', 422);
        }

        return response()->json([
            'ok'     => true,
            'kind'   => 'coin',
            'coins'  => $r['coins'],
            'orders' => collect($r['orders'])->map(fn ($o) => $o->toArray())->values(),
        ]);
    }
}
