<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Message extends Model
{
    public $timestamps = false; // yalnizca created_at (read_at ayri islenir)

    /**
     * Kullanıcının okunmamış DM rozet sayısı — thread listesinin (MessageController::threads)
     * GÖSTERDİĞİ mesajlarla AYNI küme. TEK KAYNAK: rozet hem /messages/unread hem presence/ping'de
     * (dm_unread) buradan okunur; iki yerde ayrı sayılırsa thread'in gizlediği mesaj "hayalet" rozet
     * bırakır (açılıp okunamayan kalıcı sayı; ÖmerÖzsoy #4 vakası = reddedilen istek mesajı).
     * GİZLENENLER: (1) reddettiğim gelen istek konuşmaları, (2) "Sohbeti sil" çizgisi altı (id <= cleared).
     */
    public static function unreadCountFor(int $userId): int
    {
        return static::query()
            ->where('messages.receiver_id', $userId)
            ->whereNull('read_at')
            ->when(Schema::hasTable('message_requests'), function ($q) use ($userId) {
                $q->whereNotIn('sender_id', DB::table('message_requests')
                    ->where('target_id', $userId)->where('status', 'declined')->pluck('requester_id'));
            })
            ->when(Schema::hasTable('dm_clears'), function ($q) use ($userId) {
                $q->whereNotExists(fn ($s) => $s->selectRaw('1')->from('dm_clears')
                    ->where('dm_clears.user_id', $userId)
                    ->whereColumn('dm_clears.peer_id', 'messages.sender_id')
                    ->whereColumn('dm_clears.cleared_msg_id', '>=', 'messages.id'));
            })
            ->count();
    }

    protected $fillable = [
        'sender_id',
        'receiver_id',
        'body',
        'image',
        'read_at',
        'edited_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'edited_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }
}
