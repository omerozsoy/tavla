<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Türkiye Online Tavla Ligi sezonu. Bağımsız modül — Tournament ile ilişkisi YOK.
 *
 * Durum makinesi (§2, §11): draft -> applications -> selection -> league -> knockout -> finished.
 * active_lock: aktif sezonda 1, değilse null (UNIQUE kolon -> ikinci aktif sezon DB düzeyinde engellenir).
 */
class LeagueSeason extends Model
{
    public const MIN_PLAYERS = 33;   // §2 en az 33 seçilmiş oyuncuyla başlayabilir

    public const MAX_PLAYERS = 48;   // §2 hedef ve üst sınır 48 seçilmiş oyuncu

    public const LEAGUE_ROUNDS = 8;  // §3 lig aşaması 8 tur

    /** §2 "aktif" sayılan (aynı anda yalnız bir tane olabilen) durumlar. */
    public const ACTIVE_STATES = ['applications', 'selection', 'league', 'knockout'];

    protected $fillable = [
        'name', 'status', 'active_lock', 'applications_open_at', 'applications_close_at',
        'league_match_length', 'knockout_match_length', 'current_round', 'rounds_total',
        'standings_final', 'bracket', 'tiebreak_manual', 'prizes', 'prizes_paid', 'config', 'rules',
    ];

    protected $casts = [
        'applications_open_at' => 'datetime',
        'applications_close_at' => 'datetime',
        'league_match_length' => 'integer',
        'knockout_match_length' => 'integer',
        'current_round' => 'integer',
        'rounds_total' => 'integer',
        'standings_final' => 'array',
        'bracket' => 'array',
        'tiebreak_manual' => 'array',
        'prizes' => 'array',
        'prizes_paid' => 'boolean',
        'config' => 'array',
    ];

    public function participants(): HasMany
    {
        return $this->hasMany(LeagueParticipant::class, 'season_id');
    }

    public function matches(): HasMany
    {
        return $this->hasMany(LeagueMatch::class, 'season_id');
    }

    public function awards(): HasMany
    {
        return $this->hasMany(LeagueAward::class, 'season_id');
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATES, true);
    }
}
