<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MatchResult extends Model
{
    protected $fillable = [
        'user_id', 'won', 'opponent_rating', 'opponent_name', 'opponent_pr', 'rating_before', 'rating_after', 'delta',
        'match_length', 'match_type', 'pr', 'coins_after', 'luck', 'score_self', 'score_opp', 'log',
    ];

    protected $casts = [
        'won' => 'boolean',
    ];
}
