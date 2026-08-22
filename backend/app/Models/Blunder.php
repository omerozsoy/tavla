<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Blunder extends Model
{
    protected $fillable = ['user_id', 'loss', 'played', 'best'];

    protected $casts = [
        'loss' => 'float',
    ];
}
