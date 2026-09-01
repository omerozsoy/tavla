<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * UserStat — basarim motorunun incremental sayac satiri (1:1 users).
 * Bkz. 2026_09_01_150000_create_user_stats_table.
 */
class UserStat extends Model
{
    protected $guarded = [];

    protected $casts = [
        'meta' => 'array',
        'matches_today_date' => 'date',
        'best_error_rate' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Kullanicinin sayac satirini getir/olustur (idempotent). */
    public static function forUser(int $userId): self
    {
        return static::firstOrCreate(['user_id' => $userId]);
    }

    /** meta.flags icinde bir bayrak var mi (ornek: 'seen_66'). */
    public function hasFlag(string $flag): bool
    {
        $flags = $this->meta['flags'] ?? [];
        return in_array($flag, $flags, true);
    }

    /** meta.flags'e bayrak ekle (idempotent). Kaydetmez; cagiran save eder. */
    public function addFlag(string $flag): void
    {
        $meta = $this->meta ?? [];
        $flags = $meta['flags'] ?? [];
        if (! in_array($flag, $flags, true)) {
            $flags[] = $flag;
            $meta['flags'] = $flags;
            $this->meta = $meta;
        }
    }
}
