<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamMessage extends Model
{
    protected $fillable = ['team_id', 'user_id', 'body', 'pinned'];

    protected $casts = ['pinned' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
