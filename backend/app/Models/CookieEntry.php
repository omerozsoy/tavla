<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Cerez Politikasi "Kullanilan Cerezler" tablosunun bir satiri.
class CookieEntry extends Model
{
    protected $fillable = [
        'name', 'provider', 'purpose', 'category', 'duration', 'sort', 'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public const CATEGORIES = ['necessary', 'functional', 'analytics', 'marketing'];
}
