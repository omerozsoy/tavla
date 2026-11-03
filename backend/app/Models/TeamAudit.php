<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeamAudit extends Model
{
    public $timestamps = false;

    protected $fillable = ['team_id', 'actor_id', 'action', 'target_user_id', 'meta', 'created_at'];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
    ];
}
