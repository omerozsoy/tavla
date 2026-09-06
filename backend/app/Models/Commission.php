<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Komisyon (rake) ledger kaydı — bahisli maç settle'ında platformun aldığı komisyon. Kimseye kredi
 * edilmez; yalnız raporlama/muhasebe için tutulur (dolaşımdan çıkar). Bkz RoomController::settle.
 */
class Commission extends Model
{
    protected $fillable = [
        'room_code', 'winner_id', 'loser_id', 'stake', 'commission', 'pct',
    ];

    protected function casts(): array
    {
        return [
            'stake' => 'integer',
            'commission' => 'integer',
            'pct' => 'integer',
        ];
    }
}
