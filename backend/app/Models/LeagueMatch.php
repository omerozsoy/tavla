<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Lig/eleme eşleşmesi + kendi oyun odası bağı (room_code). result alanı maç sonucunu, winner_user_id
 * kazananı tutar; rating_applied oynanmış maçın rating'e tek-sefer işlendiğini (§12) garanti eder.
 */
class LeagueMatch extends Model
{
    protected $table = 'league_matches';

    protected $fillable = [
        'season_id', 'phase', 'round', 'bracket_pos', 'p1_user_id', 'p2_user_id',
        'p1_from_match_id', 'p2_from_match_id', 'bye', 'winner_user_id', 'result', 'room_code',
        'target', 'mandatory_at', 'deadline_at', 'appointment', 'ready_p1_at', 'ready_p2_at',
        'rating_applied', 'admin_note',
    ];

    protected $casts = [
        'round' => 'integer',
        'bracket_pos' => 'integer',
        'p1_user_id' => 'integer',
        'p2_user_id' => 'integer',
        'p1_from_match_id' => 'integer',
        'p2_from_match_id' => 'integer',
        'bye' => 'boolean',
        'winner_user_id' => 'integer',
        'target' => 'integer',
        'mandatory_at' => 'datetime',
        'deadline_at' => 'datetime',
        'appointment' => 'array',
        'ready_p1_at' => 'datetime',
        'ready_p2_at' => 'datetime',
        'rating_applied' => 'boolean',
    ];

    public function season(): BelongsTo
    {
        return $this->belongsTo(LeagueSeason::class, 'season_id');
    }

    /**
     * Geçerli randevu saati (§8): iki tarafça onaylı erken randevu (appointment.confirmed_at) varsa o,
     * yoksa adminin belirlediği zorunlu saat (mandatory_at). 15 dk bekleme ve hatırlatmalar buna göre.
     * Bekleyen bir teklif (appointment.proposal) onaylanana kadar yürürlükteki randevuyu DEĞİŞTİRMEZ.
     */
    public function effectiveStartAt(): ?Carbon
    {
        $appt = $this->appointment;
        if (is_array($appt) && ! empty($appt['confirmed_at'])) {
            return Carbon::parse($appt['confirmed_at']);
        }

        return $this->mandatory_at;
    }
}
