<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Ana sayfa turnuva reklam gorseli -> bir turnuvaya baglanir (tiklaninca detaya gider).
class TournamentAd extends Model
{
    protected $fillable = ['tournament_id', 'image', 'sort', 'published'];

    protected $casts = [
        'published' => 'boolean',
    ];

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }
}
