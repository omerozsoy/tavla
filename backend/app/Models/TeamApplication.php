<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamApplication extends Model
{
    protected $fillable = [
        'team_id', 'user_id', 'status', 'rating_at_apply', 'decided_by', 'decided_at',
    ];

    protected $casts = [
        'rating_at_apply' => 'integer',
        'decided_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
