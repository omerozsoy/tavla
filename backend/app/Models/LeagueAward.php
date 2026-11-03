<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeagueAward extends Model
{
    protected $fillable = [
        'season_id', 'user_id', 'award_key', 'coins', 'badge', 'desc', 'error',
    ];

    protected $casts = [
        'coins' => 'integer',
    ];

    public function season(): BelongsTo
    {
        return $this->belongsTo(LeagueSeason::class, 'season_id');
    }
}
