<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Bir çevirme kaydı. reward_snapshot ödülün kazanıldığı andaki halini saklar —
 * admin sonradan ödülü değiştirse/silse bile geçmiş bozulmaz.
 */
class LuckyWheelSpin extends Model
{
    protected $fillable = [
        'user_id', 'reward_id', 'reward_snapshot', 'spin_type',
    ];

    protected function casts(): array
    {
        return [
            'reward_snapshot' => 'array',
        ];
    }

    public function reward(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(LuckyWheelReward::class, 'reward_id');
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
