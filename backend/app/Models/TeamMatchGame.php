<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamMatchGame extends Model
{
    protected $fillable = [
        'match_id', 'slot', 'home_user_id', 'away_user_id', 'room_code',
        'status', 'result', 'winner_user_id', 'ready_home_at', 'ready_away_at', 'started_at', 'finished_at',
    ];

    protected $casts = [
        'slot' => 'integer',
        'ready_home_at' => 'datetime',
        'ready_away_at' => 'datetime',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function match(): BelongsTo
    {
        return $this->belongsTo(TeamMatch::class, 'match_id');
    }
}
