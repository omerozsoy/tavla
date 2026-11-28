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
    protected $fillable = ['user_id', 'image_path', 'status', 'flip', 'position', 'hint', 'debug', 'valid', 'error', 'reported_at', 'ground_truth', 'review_status', 'trained_at'];

    protected $casts = [
        'position' => 'array',
        'hint' => 'array',
        'debug' => 'array',
        'ground_truth' => 'array',
        'valid' => 'boolean',
        'flip' => 'boolean',
        'reported_at' => 'datetime',
        'trained_at' => 'datetime',
    ];

    /** Eğitime hazır: admin düzeltti/onayladı (review_status var) + geçerli etiket (ground_truth var). */
    public function scopeTrainReady($query)
    {
        return $query->whereNotNull('review_status')->whereNotNull('ground_truth');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Admin "Doğru işaretle": tanıma DOĞRU çıkmış fotoğrafı etiket seti için onaylar
     * (ground_truth = tanınan konum). Böylece eğitim/gate seti kolay+zor TEMSİLİ olur (yalnız düzeltilenler
     * değil). position yoksa no-op (bozuk/boş etiket yazma). review_status='correct' düzeltilenden ayırır.
     */
    public function markCorrect(): void
    {
        if (is_array($this->position)) {
            $this->update(['ground_truth' => $this->position, 'review_status' => 'correct']);
        }
    }

    /** Panelde etiketlenebilir kayıtlar: bildirilenler (düzeltilecek) + valid+done (doğru-adayları). */
    public function scopeLabelable($query)
    {
        return $query->where(function ($w) {
            $w->whereNotNull('reported_at')
                ->orWhere(fn ($d) => $d->where('status', 'done')->where('valid', true));
        });
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
