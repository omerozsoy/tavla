<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Content extends Model
{
    protected $fillable = [
        'type', 'title', 'body', 'organizer', 'place', 'province',
        'contact', 'image', 'gallery', 'video_id', 'event_at', 'sort', 'published',
    ];

    protected $casts = [
        'event_at' => 'datetime',
        'published' => 'boolean',
        'gallery' => 'array',
    ];
}
