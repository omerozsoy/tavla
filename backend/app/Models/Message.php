<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    public $timestamps = false; // yalnizca created_at (read_at ayri islenir)

    protected $fillable = [
        'sender_id',
        'receiver_id',
        'body',
        'read_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }
}
