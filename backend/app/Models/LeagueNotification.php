<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeagueNotification extends Model
{
    protected $fillable = [
        'season_id', 'match_id', 'kind', 'channel', 'anchor_at', 'sent_at',
    ];

    protected $casts = [
        'anchor_at' => 'datetime',
        'sent_at' => 'datetime',
    ];
}
