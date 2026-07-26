<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'code',
        'p1_token',
        'p1_name',
        'p2_token',
        'p2_name',
        'state',
        'version',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'state' => 'array',
        ];
    }

    // Istemciye donen guvenli gorunum (token'lar gizli)
    public function toClient(): array
    {
        return [
            'code' => $this->code,
            'p1_name' => $this->p1_name,
            'p2_name' => $this->p2_name,
            'state' => $this->state,
            'version' => $this->version,
            'status' => $this->status,
        ];
    }
}
