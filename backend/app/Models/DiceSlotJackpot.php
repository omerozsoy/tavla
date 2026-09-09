<?php

namespace App\Models;

use App\Support\DiceSlotSettings;
use Illuminate\Database\Eloquent\Model;

/**
 * Artan jackpot havuzu — tek satır (id=1). Yalnız spin transaction'ında (lockForUpdate)
 * değiştirilir; okuma için current() kullanılır (kilitsiz, gösterim amaçlı).
 */
class DiceSlotJackpot extends Model
{
    protected $table = 'dice_slot_jackpot';

    protected $fillable = [
        'pool', 'total_contributed', 'last_won_user_id', 'last_won_amount', 'last_won_at',
    ];

    protected function casts(): array
    {
        return [
            'pool' => 'integer',
            'total_contributed' => 'integer',
            'last_won_amount' => 'integer',
            'last_won_at' => 'datetime',
        ];
    }

    /** Gösterim için havuz satırı (yoksa taban değerle oluşturulur). Kilitsiz. */
    public static function current(): self
    {
        $row = static::find(1);
        if (! $row) {
            $row = new self;
            $row->id = 1;
            $row->pool = max(0, DiceSlotSettings::int('jackpot_base'));
            $row->total_contributed = 0;
            $row->save();
        }

        return $row;
    }
}
