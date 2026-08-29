<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Blunder extends Model
{
    protected $fillable = ['user_id', 'loss', 'played', 'best', 'pos', 'steps', 'player', 'opp', 'ai_level', 'score_me', 'score_opp', 'won'];

    protected $casts = [
        'loss' => 'float',
        'won' => 'boolean',
    ];
}
