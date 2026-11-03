<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 72 saatlik katılım yasağı (ayrılma/çıkarılma/Premium düşmesi/takım kapanması). En geç biten
 * (max until) kayıt bağlayıcıdır; yeni yasak eski kaydı silmez (izlenebilirlik).
 */
class TeamCooldown extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'until', 'reason', 'created_at'];

    protected $casts = [
        'until' => 'datetime',
        'created_at' => 'datetime',
    ];
}
