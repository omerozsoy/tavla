<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Periyodik turnuva şablonu: haftanın seçilen günlerinde (weekdays, ISO 1=Pzt..7=Paz) gece 00:00'da
 * otomatik turnuva kuran tekrar kuralı. Turnuva ayarları kolonlara birebir kopyalanır; kuran komut
 * CreateScheduledTournaments bunları yeni Tournament satırına geçirir. Katılımcı/ağaç yoktur (şablon).
 */
class TournamentSchedule extends Model
{
    protected $fillable = [
        'name', 'active', 'weekdays', 'start_time',
        'type', 'venue', 'organizer_id', 'size',
        'match_length', 'semi_length', 'final_length',
        'round_minutes', 'semi_minutes', 'final_minutes',
        'prize_coins', 'prizes', 'prize_desc', 'entry_fee', 'premium_only',
        'creator_id', 'last_created_on',
    ];

    protected $casts = [
        'active' => 'boolean',
        'weekdays' => 'array',
        'prizes' => 'array',
        'premium_only' => 'boolean',
        'last_created_on' => 'date',
        'size' => 'integer',
        'match_length' => 'integer',
        'semi_length' => 'integer',
        'final_length' => 'integer',
        'round_minutes' => 'integer',
        'semi_minutes' => 'integer',
        'final_minutes' => 'integer',
        'prize_coins' => 'integer',
        'entry_fee' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(Content::class, 'organizer_id');
    }
}
