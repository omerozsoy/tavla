<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// WXP ledger satiri (immutable). Source of truth: bu tablonun SUM(amount)'i.
class UserWxpTransaction extends Model
{
    protected $fillable = [
        'user_id', 'match_result_id', 'amount', 'source', 'metadata',
    ];

    protected $casts = [
        'amount' => 'integer',
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function matchResult(): BelongsTo
    {
        return $this->belongsTo(MatchResult::class);
    }
}
