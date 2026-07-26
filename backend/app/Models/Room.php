<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'code',
        'p1_token',
        'p1_name',
        'p1_rating',
        'p1_avatar',
        'p2_token',
        'p2_name',
        'p2_rating',
        'p2_avatar',
        'state',
        'messages',
        'version',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'state' => 'array',
            'messages' => 'array',
        ];
    }

    // Istemciye donen guvenli gorunum (token'lar gizli)
    public function toClient(): array
    {
        return [
            'code' => $this->code,
            'p1_name' => $this->p1_name,
            'p1_rating' => $this->p1_rating,
            'p1_avatar' => $this->p1_avatar,
            'p2_name' => $this->p2_name,
            'p2_rating' => $this->p2_rating,
            'p2_avatar' => $this->p2_avatar,
            'state' => $this->state,
            'messages' => $this->messages ?? [],
            'version' => $this->version,
            'status' => $this->status,
        ];
    }
}
