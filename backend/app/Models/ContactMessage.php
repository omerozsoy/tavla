<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// İletişim / turnuva organizasyonu talebi. Footer "İletişim" sayfasindaki ve turnuva
// organizasyonu landing'lerindeki formdan gonderilir. Misafir de gonderebilir (user_id null).
class ContactMessage extends Model
{
    protected $fillable = [
        'user_id', 'name', 'org', 'email', 'phone', 'subject', 'city',
        'event_date', 'participants', 'message', 'source_page', 'url',
        'user_agent', 'status', 'admin_note', 'admin_reply', 'replied_at',
    ];

    protected $casts = [
        'participants' => 'integer',
        'replied_at' => 'datetime',
    ];

    public const STATUSES = ['new', 'in_progress', 'resolved'];

    // Talep turu etiketleri (form select degerleri ile birebir).
    public const SUBJECTS = [
        'kurumsal' => 'Kurumsal Turnuva',
        'belediye' => 'Belediye Turnuvası',
        'avm' => 'AVM Turnuvası',
        'online' => 'Online Turnuva',
        'genel' => 'Genel / Diğer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
