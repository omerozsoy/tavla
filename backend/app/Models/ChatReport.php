<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Oyuncunun maç sohbetinden gönderdiği küfür/uygunsuz dil şikayeti. messages = şikayet anındaki
// son 10 sohbet satırı (slot/name/text). Panelde "Küfür Şikayetleri" sayfasında incelenir.
class ChatReport extends Model
{
    protected $fillable = [
        'room_code', 'reporter_user_id', 'reporter_name', 'reporter_slot',
        'reported_name', 'p1_name', 'p2_name', 'messages', 'status', 'admin_note',
    ];

    protected $casts = [
        'messages' => 'array',
    ];

    public const STATUSES = ['new', 'in_progress', 'resolved'];

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_user_id');
    }
}
