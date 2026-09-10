<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Bilgi sayfalari: /bilgi/<slug> sekmeleri (about/services/ranks/scoring/badges/fair).
 *  Her biri admin panelden RichEditor ile duzenlenir. Sabit 6 satir (slug degismez). */
class InfoPage extends Model
{
    protected $fillable = ['slug', 'title', 'body', 'gallery', 'galleries', 'sort', 'published'];

    protected $casts = [
        'gallery' => 'array',
        'galleries' => 'array',
        'published' => 'boolean',
    ];
}
