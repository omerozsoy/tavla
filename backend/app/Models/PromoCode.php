<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Indirim (promo) kodu. Coin sepeti odemesinde SUNUCU-OTORITER indirim.
 * type=percent -> value=%; type=fixed -> value=kurus. Tutarlar KURUS (TL x100).
 */
class PromoCode extends Model
{
    protected $fillable = [
        'code', 'type', 'value', 'min_amount', 'max_uses', 'used_count', 'active', 'expires_at',
    ];

    protected $casts = [
        'active'     => 'boolean',
        'expires_at' => 'datetime',
    ];

    // Kod her zaman BUYUK harf + trim saklanir/aranir (kullanicidan gelen serbest yazim).
    public static function normalize(string $code): string
    {
        return strtoupper(trim($code));
    }

    // Kullanilabilir mi? Degilse null + $reason doldurulur (mesaj icin).
    public static function usable(string $code, int $subtotalKurus, ?string &$reason = null): ?self
    {
        $reason = null;
        $norm = self::normalize($code);
        if ($norm === '') {
            $reason = 'empty';
            return null;
        }
        $promo = self::where('code', $norm)->first();
        if (! $promo || ! $promo->active) {
            $reason = 'not_found';
            return null;
        }
        if ($promo->expires_at && $promo->expires_at->isPast()) {
            $reason = 'expired';
            return null;
        }
        if ($promo->max_uses !== null && $promo->used_count >= $promo->max_uses) {
            $reason = 'exhausted';
            return null;
        }
        if ($subtotalKurus < (int) $promo->min_amount) {
            $reason = 'min_amount';
            return null;
        }

        return $promo;
    }

    // Bu koda gore indirim (kurus). Asla sepetten buyuk olmaz (negatif tahsilat yok).
    public function discountKurus(int $subtotalKurus): int
    {
        $d = $this->type === 'fixed'
            ? (int) $this->value
            : (int) floor($subtotalKurus * min(100, max(0, (int) $this->value)) / 100);

        return max(0, min($d, $subtotalKurus));
    }
}
