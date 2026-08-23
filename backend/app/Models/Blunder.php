<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Blunder extends Model
{
    protected $fillable = ['user_id', 'loss', 'played', 'best', 'pos', 'steps', 'player'];

    protected $casts = [
        'loss' => 'float',
    ];
}
