<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MatchResult extends Model
{
    protected $fillable = [
        'user_id', 'won', 'opponent_rating', 'opponent_name', 'opponent_pr', 'room_code', 'rating_before', 'rating_after', 'delta',
        'match_length', 'match_type', 'pr', 'coins_after', 'luck', 'score_self', 'score_opp', 'log',
        'analyzed_at', 'analysis_version',
        // XG-style havuzlama totalleri (§13): dogru lifetime PR icin ham toplamlar.
        'pr_equity_lost', 'pr_decisions',
    ];

    protected $casts = [
        'won' => 'boolean',
        'analyzed_at' => 'datetime',
        'pr_equity_lost' => 'float',
        'pr_decisions' => 'integer',
    ];
}
