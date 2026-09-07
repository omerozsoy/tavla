<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Kullanıcının çark durumu: günlük ücretsiz hak kullanımı + bonus (ekstra) haklar.
 * Günlük haklar reset_date değiştiğinde (yeni gün) sıfırlanır.
 */
class LuckyWheelUserState extends Model
{
    protected $primaryKey = 'user_id';
    public $incrementing = false;

    protected $fillable = [
        'user_id', 'daily_free_spins_used', 'bonus_spins', 'last_spin_at', 'reset_date',
    ];

    protected function casts(): array
    {
        return [
            'daily_free_spins_used' => 'integer',
            'bonus_spins' => 'integer',
            'last_spin_at' => 'datetime',
            'reset_date' => 'date',
        ];
    }

    public static function forUser(int $userId): self
    {
        return static::firstOrCreate(['user_id' => $userId], [
            'daily_free_spins_used' => 0,
            'bonus_spins' => 0,
        ]);
    }
}
