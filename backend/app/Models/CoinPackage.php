<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Coin (jeton) paketi — "TL öde -> coin al". Panelden yonetilir. price KURUS, coins verilen jeton.
// Odemede SUNUCU-OTORITER kaynak (PaymentController::coinSubtotal buradan okur).
class CoinPackage extends Model
{
    protected $fillable = [
        'slug', 'name', 'price', 'coins', 'discount', 'popular', 'published', 'sort',
    ];

    protected $casts = [
        'price'     => 'integer',   // KURUS
        'coins'     => 'integer',
        'discount'  => 'integer',
        'popular'   => 'boolean',
        'published' => 'boolean',
        'sort'      => 'integer',
    ];

    // Frontend katalog gorunumu (public). id=slug (sepet + odeme anahtari), price TL (kurus/100).
    // Frontend src/coinPackages.ts CoinPackage sekliyle BIREBIR (id/name/gc/price/discount/popular).
    public function toCatalog(): array
    {
        return [
            'id'       => $this->slug,
            'name'     => $this->name,
            'gc'       => (int) $this->coins,
            'price'    => (int) $this->price / 100, // TL (frontend TL bekler; fmtTL/per-coin hesabi)
            'discount' => (int) $this->discount,
            'popular'  => (bool) $this->popular,
        ];
    }
}
