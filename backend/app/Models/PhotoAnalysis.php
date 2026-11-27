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
    protected $fillable = ['user_id', 'image_path', 'status', 'flip', 'position', 'hint', 'debug', 'valid', 'error', 'reported_at', 'ground_truth', 'review_status'];

    protected $casts = [
        'position' => 'array',
        'hint' => 'array',
        'debug' => 'array',
        'ground_truth' => 'array',
        'valid' => 'boolean',
        'flip' => 'boolean',
        'reported_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Admin'in panelde girdigi JSON metnini egitim etiketi dizisine cevirir. Gecersiz/bos -> null
     * (form 'json' kurali gecerli JSON'u zaten garanti eder; bu son savunma). Yeniden egitim bu
     * ground_truth != null satirlari (foto -> dogru konum) uzerinden calisir.
     */
    public static function parseGroundTruth(?string $json): ?array
    {
        if ($json === null || trim($json) === '') {
            return null;
        }
        $v = json_decode($json, true);

        return is_array($v) ? $v : null;
    }
}
