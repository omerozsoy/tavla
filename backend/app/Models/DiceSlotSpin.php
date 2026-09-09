<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Bir zar slotu çevirme kaydı. reels üç sembolü, win_type/payout sonucu saklar —
 * jackpot kazançları jackpot_won ile işaretlenir (admin izlenebilirliği).
 */
class DiceSlotSpin extends Model
{
    protected $fillable = [
        'user_id', 'reels', 'win_type', 'payout', 'cost', 'spin_type', 'jackpot_won',
    ];

    protected function casts(): array
    {
        return [
            'reels' => 'array',
            'payout' => 'integer',
            'cost' => 'integer',
            'jackpot_won' => 'boolean',
        ];
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
