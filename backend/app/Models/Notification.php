<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    public $timestamps = false; // yalnizca created_at

    protected $fillable = [
        'user_id',
        'title',
        'body',
        'icon',
        'read',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'read' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    // Belirli bir kullaniciya bildirim olustur (yardimci)
    public static function notify(int $userId, string $title, ?string $body = null, ?string $icon = null): void
    {
        static::create([
            'user_id' => $userId,
            'title' => $title,
            'body' => $body,
            'icon' => $icon,
            'read' => false,
            'created_at' => now(),
        ]);
    }
}
