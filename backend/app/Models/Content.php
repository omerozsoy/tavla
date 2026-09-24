<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Content extends Model
{
    protected $fillable = [
        'type', 'title', 'slug', 'body', 'organizer', 'place', 'hotel', 'province', 'country',
        'contact', 'contacts', 'links', 'image', 'gallery', 'video_id', 'event_at', 'event_end', 'sort', 'published',
        'show_tavlatv', 'views',
    ];

    protected $casts = [
        'event_at' => 'datetime',
        'event_end' => 'datetime',
        'published' => 'boolean',
        'show_tavlatv' => 'boolean',
        'gallery' => 'array',
        'contacts' => 'array',
        'links' => 'array',
        'views' => 'integer',
    ];

    protected static function booted(): void
    {
        // Yeni makale/haber okunmasi 40-150 arasi RASTGELE baslar (bos/0 ise). Boylece
        // taze yazi da "sifir okunma" gorunmesin; mevcut yazilari migration doldurur.
        static::creating(function (Content $c): void {
            if (in_array($c->type, ['makale', 'news'], true) && (int) ($c->views ?? 0) === 0) {
                $c->views = random_int(40, 150);
            }
        });
    }
}
