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
        'escrowed', // rezervasyon escrow: bu odanın stake'i coins_reserved'a rezerve edildi mi
        'p1_result',
        'p2_result',
        // Sunucu-otoriter zar (commit-reveal) — Faz 1. dice_seed GİZLİ (toClient'a girmez).
        'dice_seed',
        'dice_commit',
        'dice_client_seed',
        'dice_roll_index',
        'dice_rolls',
        // Sunucu-otoriter oyun durumu — Faz 2b.
        'server_state',
        'server_version',
        'server_winner',
        'server_match',
        'authoritative',
        // BAĞIMSIZ Faz 1: yalnız zar sunucudan (hamle/tahta legacy). authoritative'den AYRI.
        'dice_authority',
        'dice_consumed',
        // CANLI hamle önizlemesi (cosmetic): sıradaki oyuncunun oynadığı/geri aldığı adımlar ->
        // rakip adım adım animasyonla görür. Otorite DEĞİL (roll/move/update ayrı).
        'live',
    ];

    /**
     * Kullanıcı ŞU AN OYNANAN bir % (bet_pct) bahisli maçta mı? %-maçlar escrow'suz (settle-time
     * modeli) olduğundan, bu maç sürerken coin harcaması (mağaza/turnuva) KİLİTLENİR -> kaybeden
     * bakiyesini eritip settle'ı eksik ödetemez.
     */
    public static function userInPctStakedPlaying(?int $uid): bool
    {
        if (! $uid) {
            return false;
        }

        return static::where('status', 'playing')
            ->where('bet_pct', '>', 0)
            ->where(function ($q) use ($uid) {
                $q->where('p1_user_id', $uid)->orWhere('p2_user_id', $uid);
            })
            ->exists();
    }

    protected function casts(): array
    {
        return [
            'state' => 'array',
            'messages' => 'array',
            'targets' => 'array',
            'stakes' => 'array',
            'clock' => 'array',
            'dice_rolls' => 'array',
            'server_state' => 'array',
            'server_match' => 'array',
            'authoritative' => 'boolean',
            'dice_authority' => 'boolean',
            'live' => 'array',
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
            // Sunucu-otoriter mod (Faz 2c). false ise istemci eski akisi kullanir (degisiklik yok).
            'authoritative' => (bool) $this->authoritative,
            'server_state' => $this->server_state, // otoriter tahta (yalniz authoritative iken dolu)
            'server_version' => (int) $this->server_version,
            'server_winner' => $this->server_winner,
            'server_match' => $this->server_match, // otoriter maç skoru {target,score,gameNo,done,winner}
            'dice_commit' => $this->dice_commit, // provably-fair taahhut (dice_seed GIZLI kalir)
            // BAĞIMSIZ Faz 1: bu odada zar sunucudan alınır (istemci serverRoll kullanır).
            'dice_authority' => (bool) $this->dice_authority,
            // Canlı hamle önizlemesi (cosmetic): {slot, steps, turn, seq}. Rakip adım adım animasyon.
            'live' => $this->live,
            // REVEAL: maç bitince (yalnız o zaman) tohumu ve el logunu aç -> iki taraf da
            // commit'i ve tüm zarları provably-fair doğrular. Oyun sürerken dice_seed GİZLİ.
            'dice_seed' => $this->status === 'finished' ? $this->dice_seed : null,
            'dice_rolls' => $this->status === 'finished' ? ($this->dice_rolls ?? []) : null,
        ];
    }
}
