<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Content extends Model
{
    protected $fillable = [
        'type', 'title', 'body', 'organizer', 'place', 'hotel', 'province',
        'contact', 'contacts', 'links', 'image', 'gallery', 'video_id', 'event_at', 'event_end', 'sort', 'published',
    ];

    protected $casts = [
        'event_at' => 'datetime',
        'event_end' => 'datetime',
        'published' => 'boolean',
        'gallery' => 'array',
        'contacts' => 'array',
        'links' => 'array',
    ];
}
