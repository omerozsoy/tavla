<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MatchResult extends Model
{
    protected $fillable = [
        'user_id', 'won', 'opponent_rating', 'rating_before', 'rating_after', 'delta',
    ];

    protected $casts = [
        'won' => 'boolean',
    ];
}
