<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'code',
        'p1_token',
        'p1_user_id',
        'p1_name',
        'p1_rating',
        'p1_avatar',
        'p2_token',
        'p2_user_id',
        'p2_name',
        'p2_rating',
        'p2_avatar',
        'state',
        'messages',
        'version',
        'status',
        'stake',
        'stakes',
        'bet_pct',
        'target',
        'targets',
        'mode',
        'time_control',
        'clock',
        'end_reason',
        'settled',
        'p1_result',
        'p2_result',
    ];

    protected function casts(): array
    {
        return [
            'state' => 'array',
            'messages' => 'array',
            'targets' => 'array',
            'stakes' => 'array',
            'clock' => 'array',
        ];
    }

    // Istemciye donen guvenli gorunum (token'lar gizli)
    public function toClient(): array
    {
        // Iki oyuncunun cercevesini TEK sorguda cek (onceki hali 2 ayri sorgu = N+1).
        $ids = array_values(array_filter([$this->p1_user_id, $this->p2_user_id]));
        $frames = $ids
            ? User::whereIn('id', $ids)->pluck('avatar_frame', 'id')
            : collect();

        return [
            'code' => $this->code,
            'p1_name' => $this->p1_name,
            'p1_rating' => $this->p1_rating,
            'p1_avatar' => $this->p1_avatar,
            'p1_frame' => $this->p1_user_id ? ($frames[$this->p1_user_id] ?? null) : null,
            'p2_name' => $this->p2_name,
            'p2_rating' => $this->p2_rating,
            'p2_avatar' => $this->p2_avatar,
            'p2_frame' => $this->p2_user_id ? ($frames[$this->p2_user_id] ?? null) : null,
            'state' => $this->state,
            'messages' => $this->messages ?? [],
            'version' => $this->version,
            'status' => $this->status,
            'stake' => (int) $this->stake,
            'bet_pct' => (int) $this->bet_pct,
            'target' => $this->target !== null ? (int) $this->target : null,
        ];
    }
}
