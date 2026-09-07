<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Fiziksel urun siparisi (tek urun + adet + secili renk). Coin siparis aninda 'paid';
// money siparis odeme callback'inde 'paid'. Fiyat/urun adi SNAPSHOT.
class ProductOrder extends Model
{
    protected $fillable = [
        'user_id', 'product_id', 'product_name', 'color', 'qty',
        'payment_type', 'coin_cost', 'amount', 'payment_id', 'status',
        'ship_name', 'ship_phone', 'ship_address', 'ship_city', 'ship_postal',
        'note', 'tracking', 'admin_note',
    ];

    protected $casts = [
        'qty'       => 'integer',
        'coin_cost' => 'integer',
        'amount'    => 'integer',
    ];

    public const STATUSES = [
        'pending'   => 'Ödeme bekliyor',
        'paid'      => 'Ödendi',
        'shipped'   => 'Kargolandı',
        'delivered' => 'Teslim edildi',
        'cancelled' => 'İptal',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }

    // Kullaniciya donen ozet.
    public function toArray()
    {
        return [
            'id'           => $this->id,
            'product_name' => $this->product_name,
            'color'        => $this->color,
            'qty'          => (int) $this->qty,
            'payment_type' => $this->payment_type,
            'coin_cost'    => $this->coin_cost !== null ? (int) $this->coin_cost : null,
            'amount'       => $this->amount !== null ? (int) $this->amount : null,
            'status'       => $this->status,
            'status_label' => self::STATUSES[$this->status] ?? $this->status,
            'tracking'     => $this->tracking,
            'ship_name'    => $this->ship_name,
            'ship_city'    => $this->ship_city,
            'created_at'   => optional($this->created_at)->toIso8601String(),
        ];
    }
}
