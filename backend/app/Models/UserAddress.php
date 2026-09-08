<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Kullanıcı adres defteri kaydı (Adreslerim). type: shipping (teslimat) | billing (fatura).
 * Sepet ödemesinde seçili adres siparişe SNAPSHOT olarak yazılır.
 */
class UserAddress extends Model
{
    protected $fillable = [
        'user_id', 'type', 'title', 'name', 'phone', 'address', 'city', 'district',
        'postal', 'is_default', 'company', 'tax_office', 'tax_number',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public const TYPES = ['shipping', 'billing'];

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
