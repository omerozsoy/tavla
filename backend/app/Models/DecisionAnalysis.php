<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Hata Gunlugu: bir macin bir kararinin analizi (match_results.log'dan cikarilir).
 * Kaynak equity/best/loss tarayicida hesaplanip log'a yazilir; siniflandirma+pip
 * burada saklanir. Uniqueness: (match_result_id, move_index).
 */
class DecisionAnalysis extends Model
{
    protected $fillable = [
        'user_id', 'match_result_id', 'move_index', 'played_at',
        'player', 'is_opponent', 'decision_type', 'dice',
        'played', 'best', 'played_equity', 'best_equity', 'equity_loss',
        'severity', 'primary_category', 'category_tags',
        'my_pip', 'opp_pip',
        'pos', 'steps', 'played_steps', 'cands',
        'engine_version', 'analysis_version',
    ];

    protected $casts = [
        'played_at' => 'datetime',
        'is_opponent' => 'boolean',
        'played_equity' => 'float',
        'best_equity' => 'float',
        'equity_loss' => 'float',
        'category_tags' => 'array',
    ];

    public function match(): BelongsTo
    {
        return $this->belongsTo(MatchResult::class, 'match_result_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
