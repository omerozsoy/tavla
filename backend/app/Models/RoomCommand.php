<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoomCommand extends Model
{
    protected $fillable = [
        'room_id', 'command_id', 'action', 'actor_user_id', 'actor_slot',
        'payload_hash', 'expected_version', 'result_version',
    ];

    protected function casts(): array
    {
        return [
            'room_id' => 'integer',
            'actor_user_id' => 'integer',
            'expected_version' => 'integer',
            'result_version' => 'integer',
        ];
    }
}
