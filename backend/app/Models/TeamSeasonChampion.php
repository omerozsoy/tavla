<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Takımlar Ligi sezon şampiyonları (geçmiş kayıt). Sezon bitince ilk 3 takım + final puanı yazılır.
 */
class TeamSeasonChampion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'season_key', 'team_id', 'rank', 'points', 'diff', 'wins', 'played', 'team_name', 'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }
}
