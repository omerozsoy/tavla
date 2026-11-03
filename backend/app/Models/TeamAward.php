<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamAward extends Model
{
    public $timestamps = false;

    protected $fillable = ['team_id', 'month_key', 'rank', 'kind', 'created_at'];

    protected $casts = [
        'rank' => 'integer',
        'created_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }
}
