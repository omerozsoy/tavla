<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'user_id', 'kind', 'order_id', 'plan', 'period', 'amount', 'coins', 'package_id', 'currency', 'status', 'bank_msg',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
