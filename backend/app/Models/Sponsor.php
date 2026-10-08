<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Footer karusel sponsoru: logo + kısa ad (+opsiyonel link). Panelden yönetilir.
class Sponsor extends Model
{
    protected $fillable = [
        'name', 'logo', 'link', 'sort', 'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'sort' => 'integer',
    ];
}
