<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamMatchLineup extends Model
{
    protected $fillable = [
        'match_id', 'team_id', 'slot', 'user_id', 'ready_at', 'premium_at_lock',
    ];

    protected $casts = [
        'slot' => 'integer',
        'ready_at' => 'datetime',
        'premium_at_lock' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
