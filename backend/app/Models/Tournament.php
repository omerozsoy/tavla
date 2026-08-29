<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tournament extends Model
{
    protected $fillable = [
        'name', 'size', 'status', 'register_until', 'creator_id', 'players', 'bracket', 'champion_id',
        'prize_coins', 'prize_desc', 'prize_paid', 'entry_fee', 'prizes',
    ];

    protected $casts = [
        'players' => 'array',
        'bracket' => 'array',
        'prizes' => 'array',
        'register_until' => 'datetime',
    ];

    // Turnuvayi olusturan kullanici (admin panelde isimle secilir/gosterilir)
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    // Sampiyon kullanici
    public function champion(): BelongsTo
    {
        return $this->belongsTo(User::class, 'champion_id');
    }
}
