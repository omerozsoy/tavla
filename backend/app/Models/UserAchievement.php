<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * UserAchievement — kazanilan bir basarim kaydi (unlock). Katalog config'de.
 * unique(user_id, achievement_slug) DB seviyesinde tekrar/duplicate odulu engeller.
 */
class UserAchievement extends Model
{
    protected $guarded = [];

    protected $casts = [
        'unlocked_at' => 'datetime',
        'notified' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
