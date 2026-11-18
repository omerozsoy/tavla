<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Açılış pratiği pozisyonu (statik, motor-doğrulanmış). timestamps YOK (salt veri).
class OpeningPosition extends Model
{
    public $timestamps = false;

    protected $guarded = [];
}
