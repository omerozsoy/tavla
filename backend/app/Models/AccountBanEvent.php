<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Hesap kapatma / yeniden acma denetim izi (bir satir = bir islem).
 * account_ban_events tablosu; UPDATED_AT yok (yalniz created_at, append-only defter).
 */
class AccountBanEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'action', 'actor_id', 'reason', 'note'];

    protected $casts = ['created_at' => 'datetime'];

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function actor(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
