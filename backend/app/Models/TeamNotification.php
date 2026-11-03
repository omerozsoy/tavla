<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Takım bildirim defteri (idempotent + tekrar-çalıştırılabilir). unique(match_id,kind,channel,anchor_at)
 * mükerrer gönderimi engeller — league_notifications ile aynı desen.
 */
class TeamNotification extends Model
{
    protected $fillable = ['match_id', 'kind', 'channel', 'anchor_at', 'sent_at'];

    protected $casts = [
        'anchor_at' => 'datetime',
        'sent_at' => 'datetime',
    ];
}
