<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Club extends Model
{
    protected $fillable = [
        'name', 'tag', 'description', 'owner_id', 'members_count', 'points',
    ];

    public function members(): HasMany
    {
        return $this->hasMany(ClubMember::class);
    }
}
