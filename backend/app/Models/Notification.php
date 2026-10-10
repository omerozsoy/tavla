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
        bool $push = true,
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

        // Ayni bildirimi cihaza PUSH olarak da gonder (uygulama kabugu). FCM yapilandirilmamissa
        // veya kuyruk yoksa sessizce atlanir -> bildirim kaydi her halukarda dusmustur.
        if ($push) {
            try {
                \App\Jobs\SendPushJob::dispatch($userId, $title, $body, array_filter([
                    'action' => $action,
                    'actor_id' => $actorId !== null ? (string) $actorId : null,
                ]));
            } catch (\Throwable $e) {
                // push dagitimi bildirimi bozmasin
            }
        }
    }
}
