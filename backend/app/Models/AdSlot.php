<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Ana sayfada paneller arasindaki yatay reklam seridi. Bir slota (top/middle/bottom)
// baglanir; masaustu + opsiyonel mobil gorsel + hedef link tutar. Panelden yonetilir.
class AdSlot extends Model
{
    protected $fillable = [
        'slot', 'image', 'image_mobile', 'link', 'sort', 'published',
    ];

    protected $casts = [
        'published' => 'boolean',
    ];

    // Gecerli slot degerleri (ana sayfadaki 3 konum).
    public const SLOTS = ['top', 'middle', 'bottom'];
}
