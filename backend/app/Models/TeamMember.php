<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * role: founder | assistant | member. premium_grace_until = Premium bitince başlayan 7 günlük
 * yenileme süresinin bitişi (null = aktif premium / grace yok). appointed_seq = yardımcı atama
 * sırası (kurucu 60 gün inaktifse en önce atanmış yardımcıya otomatik devir — §5).
 */
class TeamMember extends Model
{
    protected $fillable = [
        'team_id', 'user_id', 'role', 'appointed_seq', 'premium_grace_until', 'joined_at',
    ];

    protected $casts = [
        'appointed_seq' => 'integer',
        'premium_grace_until' => 'datetime',
        'joined_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isManager(): bool
    {
        return in_array($this->role, ['founder', 'assistant'], true);
    }
}
