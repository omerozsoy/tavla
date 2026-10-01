<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Tek turnuva duyurusu. Admin panelden girilir, turnuva lobisinde gosterilir.
class TournamentAnnouncement extends Model
{
    protected $fillable = ['tournament_id', 'message'];

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }
}
