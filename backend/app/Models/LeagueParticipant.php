<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Lig başvurusu/katılımcısı. status: pending(başvuran) | accepted(asıl) | reserve(yedek) |
 * rejected(elenen başvuru) | withdrawn(sezon içinde çekilen). state = LeagueEngine katılımcı
 * anlık görüntüsü (puan/rakipler/bay); lig başında doldurulur, maç sonucu işlendikçe güncellenir.
 */
class LeagueParticipant extends Model
{
    protected $fillable = [
        'season_id', 'user_id', 'premium_at_apply', 'status', 'seed', 'reserve_order',
        'state', 'withdrawn_at', 'decided_by', 'decided_at',
    ];

    protected $casts = [
        'premium_at_apply' => 'boolean',
        'seed' => 'integer',
        'reserve_order' => 'integer',
        'state' => 'array',
        'withdrawn_at' => 'datetime',
        'decided_by' => 'integer',
        'decided_at' => 'datetime',
    ];

    public function season(): BelongsTo
    {
        return $this->belongsTo(LeagueSeason::class, 'season_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
