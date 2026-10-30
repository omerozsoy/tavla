<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Kullanici hata bildirimi ("Hata Bildir" formu). Sayfanin sag kenarindaki butondan
// gonderilir; misafir de gonderebilir (user_id null). Ekran goruntusu uploads diskinde.
class BugReport extends Model
{
    protected $fillable = [
        'user_id', 'name', 'email', 'page', 'url', 'message',
        'screenshot', 'user_agent', 'status', 'admin_note',
        'admin_reply', 'admin_reply_image', 'replied_at', 'archived_at',
    ];

    protected $casts = [
        'replied_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public const STATUSES = ['new', 'in_progress', 'resolved'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
