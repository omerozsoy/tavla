<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * 5'e 5 karşılaşma. status: proposed → scheduled → live → finished | cancelled.
 * result: home_win | away_win | draw | double_forfeit | cancelled. month_key = planlanan
 * başlangıcın takvim ayı (GMT+3) → aylık sıralama bu tablodan türetilir (doğal arşiv).
 */
class TeamMatch extends Model
{
    protected $fillable = [
        'home_team_id', 'away_team_id', 'proposed_by_team_id', 'scheduled_at', 'status',
        'accepted_at', 'lineup_locked_at', 'home_score', 'away_score', 'result',
        'month_key', 'cancel_requested_by', 'cancelled_by', 'cancel_reason', 'finished_at', 'admin_note',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'accepted_at' => 'datetime',
        'lineup_locked_at' => 'datetime',
        'finished_at' => 'datetime',
        'home_score' => 'float',
        'away_score' => 'float',
    ];

    public function scopeBetweenPair($q, int $a, int $b)
    {
        return $q->where(function ($w) use ($a, $b) {
            $w->where(function ($x) use ($a, $b) {
                $x->where('home_team_id', $a)->where('away_team_id', $b);
            })->orWhere(function ($x) use ($a, $b) {
                $x->where('home_team_id', $b)->where('away_team_id', $a);
            });
        });
    }

    public function homeTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'home_team_id');
    }

    public function awayTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'away_team_id');
    }

    public function lineups(): HasMany
    {
        return $this->hasMany(TeamMatchLineup::class, 'match_id');
    }

    public function games(): HasMany
    {
        return $this->hasMany(TeamMatchGame::class, 'match_id');
    }

    /** Kilit açıldı mı (kadrolar herkese görünür) — gizli kadro serileştirme gate'i. */
    public function lineupRevealed(): bool
    {
        return $this->lineup_locked_at !== null;
    }
}
