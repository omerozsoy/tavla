<?php

namespace App\Filament\Pages;

use App\Models\PhotoAnalysis;
use App\Models\Setting;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Artisan;

/**
 * Eğitim Gönderimi — foto-analiz "eğitime hazır" (admin düzeltti/onayladı) etiketli kayıtları tek
 * yerde toplar. Belli bir LİMİTE gelince admin "Eğitime Gönder" ile seti eğitim verisine döker
 * (photo:export-labels) ve kayıtları trained_at ile işaretler (tekrar gönderilmez, ilerleme görünür).
 * ⚠ Gerçek retrain hattı YOK: bu adım seti HAZIRLAR (recognition/eval-data), model eğitimi çevrimdışı.
 */
class EgitimGonderimi extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-academic-cap';

    protected static ?string $navigationLabel = 'Eğitim Gönderimi';

    protected static ?string $title = 'Eğitim Gönderimi — Foto Etiketleri';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 20;

    protected static string $view = 'filament.pages.egitim-gonderimi';

    /** Limit ayarı (input'a bağlı). */
    public int $limit = 100;

    /** Export hedef dizini (null = komut varsayılanı recognition/eval-data). Yalnız test enjeksiyonu için. */
    public ?string $trainDir = null;

    public function mount(): void
    {
        $this->limit = static::limit();
    }

    public static function limit(): int
    {
        return max(1, Setting::int('photo_train_limit', 100));
    }

    public static function pendingCount(): int
    {
        return PhotoAnalysis::query()->trainReady()->whereNull('trained_at')->count();
    }

    public static function getNavigationBadge(): ?string
    {
        $n = static::pendingCount();

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return static::pendingCount() >= static::limit() ? 'success' : 'warning';
    }

    /** Banner istatistikleri: gönderilmeyi bekleyen / limit / toplam gönderilmiş. */
    public function stats(): array
    {
        $pending = static::pendingCount();
        $limit = static::limit();

        return [
            'pending' => $pending,
            'limit' => $limit,
            'ready' => $pending >= $limit,
            'sent' => PhotoAnalysis::query()->trainReady()->whereNotNull('trained_at')->count(),
            'pct' => $limit > 0 ? min(100, (int) round($pending / $limit * 100)) : 0,
        ];
    }

    /** Gönderilmeyi bekleyen eğitime-hazır kayıtlar (en yeni üstte). */
    public function rows(): array
    {
        return PhotoAnalysis::query()->trainReady()->whereNull('trained_at')
            ->with('user:id,nickname')
            ->latest('reported_at')->latest('id')->limit(500)
            ->get(['id', 'user_id', 'review_status', 'reported_at'])
            ->map(fn (PhotoAnalysis $p) => [
                'id' => $p->id,
                'user' => $p->user?->nickname ?? '—',
                'status' => $p->review_status === 'correct' ? 'otomatik doğru' : 'elle düzeltildi',
                'reported_at' => optional($p->reported_at)->format('d.m.Y H:i') ?? '—',
            ])->all();
    }

    /** Limiti kaydet (admin "belli bir limit" belirler). */
    public function saveLimit(): void
    {
        $v = max(1, min(100000, (int) $this->limit));
        Setting::put('photo_train_limit', $v);
        $this->limit = $v;
        Notification::make()->success()->title("Limit {$v} olarak kaydedildi")->send();
    }

    /**
     * Eğitime gönder: etiketli seti eğitim verisine döker (photo:export-labels) + bekleyenleri
     * trained_at ile işaretler. Limitin altında olsa da gönderilebilir (admin karar verir); banner uyarır.
     */
    public function sendToTraining(): void
    {
        $pending = PhotoAnalysis::query()->trainReady()->whereNull('trained_at');
        $n = (clone $pending)->count();
        if ($n === 0) {
            Notification::make()->warning()->title('Gönderilecek yeni etiket yok')->send();

            return;
        }

        // Etiketli çiftleri eğitim/eval verisine dök (tam set yeniden yazılır).
        Artisan::call('photo:export-labels', $this->trainDir ? ['--dir' => $this->trainDir] : []);

        // Bekleyenleri "gönderildi" işaretle (tekrar gönderilmez, ilerleme sıfırlanır).
        (clone $pending)->update(['trained_at' => now()]);

        Notification::make()->success()
            ->title("{$n} etiket eğitime gönderildi")
            ->body('recognition/eval-data güncellendi. Model eğitimi çevrimdışı bu setten yapılır.')
            ->persistent()->send();
    }
}
