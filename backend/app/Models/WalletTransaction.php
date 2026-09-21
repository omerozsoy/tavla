<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    protected $fillable = [
        'transaction_id', 'user_id', 'amount', 'balance_before', 'balance_after',
        'type', 'reference_type', 'reference_id', 'actor_user_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'balance_before' => 'integer',
            'balance_after' => 'integer',
            'user_id' => 'integer',
            'reference_id' => 'integer',
            'actor_user_id' => 'integer',
        ];
    }
}
