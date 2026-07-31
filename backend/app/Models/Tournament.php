<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tournament extends Model
{
    protected $fillable = [
        'name', 'size', 'status', 'creator_id', 'players', 'bracket', 'champion_id',
        'prize_coins', 'prize_desc', 'prize_paid',
    ];

    protected $casts = [
        'players' => 'array',
        'bracket' => 'array',
    ];
}
