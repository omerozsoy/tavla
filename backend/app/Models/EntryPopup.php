<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Siteye ilk girildiginde gosterilen KARE reklam pop-up'i ("Giris Kare Banner").
// Yayindaki ilk kayit gosterilir; sikligi (session/daily/always) ve hedef kitlesi
// (all/guest/member) panelden ayarlanir. Frontend localStorage ile gate'ler.
class EntryPopup extends Model
{
    protected $fillable = [
        'image', 'image_mobile', 'link', 'frequency', 'audience', 'sort', 'published',
    ];

    protected $casts = [
        'published' => 'boolean',
    ];

    public const FREQUENCIES = ['session', 'daily', 'always'];

    public const AUDIENCES = ['all', 'guest', 'member'];
}
