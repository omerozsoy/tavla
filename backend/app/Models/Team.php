<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Takımlar Ligi takımı (turnuva/league_* modüllerinden bağımsız). name_key/tag_key =
 * NFC+trim+lowercase benzersizlik anahtarı. rating_avg/member_count = sıralama önbelleği.
 */
class Team extends Model
{
    protected $fillable = [
        'name', 'name_key', 'tag', 'tag_key', 'logo', 'logo_pending',
        'color1', 'color2', 'description', 'founder_id', 'status',
        'applications_open', 'min_apply_rating', 'member_count', 'rating_avg',
        'pending_transfer_to', 'name_changed_at', 'champion_badge_until', 'closed_at', 'closed_by',
        'coin_balance',
    ];

    protected $casts = [
        'applications_open' => 'boolean',
        'min_apply_rating' => 'integer',
        'member_count' => 'integer',
        'rating_avg' => 'float',
        'coin_balance' => 'integer',
        'name_changed_at' => 'datetime',
        'champion_badge_until' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function members(): HasMany
    {
        return $this->hasMany(TeamMember::class);
    }

    public function founder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'founder_id');
    }

    public function awards(): HasMany
    {
        return $this->hasMany(TeamAward::class);
    }

    public function isChampionNow(): bool
    {
        return $this->champion_badge_until && $this->champion_badge_until->isFuture();
    }
}
