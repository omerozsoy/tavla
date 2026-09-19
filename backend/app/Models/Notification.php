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
        'action',   // eyleme donuk bildirim turu (or. 'friend_request')
        'actor_id', // eylemin ilgili oldugu kullanici (or. istegi gonderen)
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

    // Belirli bir kullaniciya bildirim olustur (yardimci). $action/$actorId verilirse bildirim
    // "eyleme donuk" olur (or. arkadaslik istegi -> Bildirimler'de "Kabul Et" butonu). Kolonlar
    // henuz migrate edilmemis olabilir (canli sunucu) -> yoksa sessizce atla, bildirim yine dusar.
    public static function notify(
        int $userId,
        string $title,
        ?string $body = null,
        ?string $icon = null,
        ?string $action = null,
        ?int $actorId = null,
    ): void {
        $row = [
            'user_id' => $userId,
            'title' => $title,
            'body' => $body,
            'icon' => $icon,
            'read' => false,
            'created_at' => now(),
        ];
        if (\Illuminate\Support\Facades\Schema::hasColumn('notifications', 'action')) {
            $row['action'] = $action;
            $row['actor_id'] = $actorId;
        }
        static::create($row);
    }
}
