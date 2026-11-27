<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Fotograftan Pozisyon Analizi: yuklenen tahta fotografinin tanima + gnubg hint kaydi.
 * status: pending (kuyrukta) | done (hint hazir) | invalid (tanima guvenilmez) | failed (hata).
 */
class PhotoAnalysis extends Model
{
    protected $fillable = ['user_id', 'image_path', 'status', 'flip', 'position', 'hint', 'debug', 'valid', 'error'];

    protected $casts = [
        'position' => 'array',
        'hint' => 'array',
        'debug' => 'array',
        'valid' => 'boolean',
        'flip' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
