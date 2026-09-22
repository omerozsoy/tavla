<?php

namespace App\Filament\Pages;

use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Başarısız Kuyruk İşleri — failed_jobs tablosunu panelden görüntüle + yönet (SSH gerekmez).
 * Kuyruğun tek gerçek işi AnalyzeMatchPrJob (gnubg PR); geçici hata (gnubg timeout / DB deadlock)
 * ile başarısız olanlar burada listelenir. "Tümünü Yeniden Dene" -> queue:retry all (her iş
 * AnalyzeMatchPrJob::$tries=3 ile 3 kez denenir). "Tümünü Temizle" -> queue:flush (kalıcı sil).
 */
class FailedJobs extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-exclamation-triangle';

    protected static ?string $navigationLabel = 'Başarısız İşler';

    protected static ?string $title = 'Başarısız Kuyruk İşleri';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 2;

    protected static string $view = 'filament.pages.failed-jobs';

    /** Sol menüde kırmızı rozet: başarısız iş sayısı (0 ise gizli). */
    public static function getNavigationBadge(): ?string
    {
        try {
            if (! Schema::hasTable('failed_jobs')) {
                return null;
            }
            $n = (int) DB::table('failed_jobs')->count();

            return $n > 0 ? (string) $n : null;
        } catch (\Throwable) {
            return null;
        }
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    /** Blade'e verilecek satırlar: iş adı + hatanın ilk satırı + tarih (en yeni 200). */
    public function getFailedJobs(): array
    {
        try {
            if (! Schema::hasTable('failed_jobs')) {
                return [];
            }

            return DB::table('failed_jobs')->orderByDesc('id')->limit(200)->get()->map(function ($r) {
                $payload = json_decode((string) $r->payload, true);
                $name = $payload['displayName']
                    ?? ($payload['data']['commandName'] ?? 'Bilinmeyen');
                $excFirst = trim((string) strtok((string) $r->exception, "\n"));

                return [
                    'id' => $r->id,
                    'name' => class_basename((string) $name),
                    'queue' => $r->queue,
                    'exception' => mb_substr($excFirst, 0, 200),
                    'failed_at' => $r->failed_at,
                ];
            })->all();
        } catch (\Throwable) {
            return [];
        }
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('retryAll')
                ->label('Tümünü Yeniden Dene')
                ->icon('heroicon-o-arrow-path')
                ->color('primary')
                ->requiresConfirmation()
                ->modalHeading('Başarısız işleri yeniden dene')
                ->modalDescription('Tüm başarısız işler kuyruğa geri konur; her biri en fazla 3 kez denenir. gnubg ayaktaysa eksik PR\'lar dolar.')
                ->action(function () {
                    try {
                        Artisan::call('queue:retry', ['id' => ['all']]);
                    } catch (\Throwable $e) {
                        Notification::make()->title('Yeniden deneme başarısız')
                            ->body($e->getMessage())->danger()->persistent()->send();

                        return;
                    }
                    Notification::make()->title('Başarısız işler yeniden kuyruğa alındı')
                        ->body('Worker sıradaki turda işleyecek (her iş 3 denemeye kadar). Sayfayı yenile.')
                        ->success()->send();
                }),

            Action::make('flushAll')
                ->label('Tümünü Temizle')
                ->icon('heroicon-o-trash')
                ->color('danger')
                ->requiresConfirmation()
                ->modalHeading('Tüm başarısız işleri sil')
                ->modalDescription('Kalıcı olarak silinir (yeniden DENENMEZ). PR\'ı olmayan maçlar boş kalır. Emin misin?')
                ->action(function () {
                    try {
                        Artisan::call('queue:flush');
                    } catch (\Throwable $e) {
                        Notification::make()->title('Temizleme başarısız')
                            ->body($e->getMessage())->danger()->persistent()->send();

                        return;
                    }
                    Notification::make()->title('Başarısız işler temizlendi')->success()->send();
                }),
        ];
    }
}
