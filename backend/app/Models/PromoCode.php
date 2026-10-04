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
    /** Bekleyen (ödenmemiş) bir ödemenin kodu rezerve tuttuğu süre (saat). Sonra kod serbest kalır. */
    public const PENDING_HOLD_HOURS = 24;

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

    // Kullanilabilir mi? Degilse null + $reason doldurulur (mesaj icin). $userId verilirse
    // KULLANICI-BASI TEK KULLANIM: ayni hesap ayni kodu tekrar (tamamlanmis 'paid' odeme ile)
    // kullanamaz -> sirali suistimali (kodu tekrar tekrar uygula) engeller.
    public static function usable(string $code, int $subtotalKurus, ?string &$reason = null, ?int $userId = null): ?self
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
        // A-08: kapasite = tamamlanan kullanım + SON 24 SAATTE başlatılmış bekleyen ödemeler. Eskiden yalnız
        // used_count sayılıyordu; ödenmeden önce N eşzamanlı checkout aynı kodla N indirimli ödeme açıp
        // hepsini ödeyebiliyordu (fulfillment'ta bumpUse 0 dönse de indirim zaten uygulanmıştı).
        $pendingWindow = now()->subHours(self::PENDING_HOLD_HOURS);
        if ($promo->max_uses !== null) {
            $pendingAll = \App\Models\Payment::where('discount_code', $norm)
                ->where('status', 'pending')->where('created_at', '>', $pendingWindow)->count();
            if ($promo->used_count + $pendingAll >= $promo->max_uses) {
                $reason = 'exhausted';
                return null;
            }
        }
        if ($subtotalKurus < (int) $promo->min_amount) {
            $reason = 'min_amount';
            return null;
        }
        // KULLANICI-BASI: bu kullanici bu kodu ZATEN kullanmis (paid) -> tekrar YOK.
        if ($userId !== null
            && \App\Models\Payment::where('user_id', $userId)
                ->where('discount_code', $norm)
                ->where(function ($q) use ($pendingWindow) {
                    $q->where('status', 'paid')
                        ->orWhere(fn ($q2) => $q2->where('status', 'pending')->where('created_at', '>', $pendingWindow));
                })
                ->exists()) {
            $reason = 'already_used';
            return null;
        }

        return $promo;
    }

    /**
     * Checkout: kod kontrolü + ödeme kaydı TEK transaction'da, promo satırı KİLİTLİ (A-08). Böylece
     * eşzamanlı checkout'lar aynı tek-kullanımlık kodu ikiden fazla kez rezerve edemez.
     * $create(PromoCode|null $promo): Payment — null promo = kod yok.
     *
     * @return array{0: ?\App\Models\Payment, 1: ?string} [payment, hata nedeni]
     */
    public static function checkoutWithLock(?string $code, int $subtotalKurus, ?int $userId, callable $create): array
    {
        if ($code === null || $code === '') {
            return [$create(null), null];
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($code, $subtotalKurus, $userId, $create) {
            self::where('code', self::normalize($code))->lockForUpdate()->first();
            $reason = null;
            $promo = self::usable($code, $subtotalKurus, $reason, $userId);
            if (! $promo) {
                return [null, $reason];
            }

            return [$create($promo), null];
        });
    }

    // Fulfillment'ta (odeme 'paid' olurken) ATOMIK + yaris-guvenli sayac artir: yalnizca limit
    // dolmamissa (max_uses null VEYA used_count < max_uses). used_count max_uses'i ASLA gecmez.
    // Eszamanli fulfill'ler tek-kullanimlik kodun sayacini sisiremez. Etkilenen satir sayisini doner.
    public static function bumpUse(string $code): int
    {
        return self::where('code', self::normalize($code))
            ->where(function ($q) {
                $q->whereNull('max_uses')->orWhereColumn('used_count', '<', 'max_uses');
            })
            ->increment('used_count');
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
