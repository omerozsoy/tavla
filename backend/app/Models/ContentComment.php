<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Haber yorumu. Kayitli kullanici haberin (Content type='news') altina birakir; yorum
 * ONAY BEKLER (status='pending'), admin onaylayinca (approved) public listede gorunur.
 */
class ContentComment extends Model
{
    protected $fillable = ['content_id', 'user_id', 'body', 'status', 'approved_at'];

    protected $casts = [
        'approved_at' => 'datetime',
    ];

    public function content(): BelongsTo
    {
        return $this->belongsTo(Content::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Public gosterim adi: takma ad, yoksa ilk ad ("Oyuncu" fallback). E-posta/soyad sizmaz. */
    public function authorName(): string
    {
        return (string) ($this->user?->nickname
            ?: $this->user?->first_name
            ?: 'Oyuncu');
    }
}
