<?php

namespace App\Models;

use App\Services\WalletService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Fotograftan Pozisyon Analizi: yuklenen tahta fotografinin tanima + gnubg hint kaydi.
 * status: pending (kuyrukta) | done (hint hazir) | invalid (tanima guvenilmez) | failed (hata).
 */
class PhotoAnalysis extends Model
{
    /** Dogru hata bildirimi odulu: admin bildirilen taramayi elle duzeltince bildiren kullaniciya. */
    public const REPORT_REWARD = 100;

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
     * Admin bildirilen taramayi elle DUZELTTI (tarama gercekten hataliydi -> bildirim DOGRU):
     * ground_truth + review_status='labeled' yazar VE bildiren kullaniciya REPORT_REWARD coin verir.
     * Idempotent (idempotency_key photo_report:{id} -> tekrar kaydetsen bile tek kez oder). Odul YALNIZ
     * kullanici gercekten bildirdiyse (reported_at + user_id). review_status='correct' (tarama zaten
     * dogruydu, bildirim yanlis) bu yoldan GECMEZ -> odul yok (yanlis bildirim tesvik edilmez).
     */
    public function labelCorrected(array $groundTruth): void
    {
        $firstLabel = $this->review_status !== 'labeled';
        $this->update(['ground_truth' => $groundTruth, 'review_status' => 'labeled']);
        if ($firstLabel && $this->user_id && $this->reported_at) {
            app(WalletService::class)->credit(
                $this->user, self::REPORT_REWARD, 'photo_report_reward',
                'photo_analysis', $this->id, "photo_report:{$this->id}",
            );
        }
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
