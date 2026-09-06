<?php

namespace App\Filament\Widgets;

use App\Services\GnuBg\GnuBgClient;
use App\Services\MoveValidatorService;
use App\Support\Backgammon;
use Filament\Notifications\Notification;
use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Servis durumu paneli (admin dashboard): ÇALIŞAN TÜM servislerin yeşil/kırmızı lambası —
 * Node validator (maç hakemi), gnubg analiz servisi, veritabanı, queue worker (shadow PR+luck).
 * Ayrıca otorite + PR/luck modu. Validator "Yeniden Başlat" butonu (süreç exit -> Passenger
 * canlandırır). Her kontrol ~10sn cache + 30sn poll.
 */
class ServiceStatus extends Widget
{
    protected static string $view = 'filament.widgets.service-status';

    protected static ?int $sort = -4; // en üstte

    protected int|string|array $columnSpan = 'full';

    protected static ?string $pollingInterval = '30s'; // lambalar otomatik tazelensin

    /** Blade'in okuduğu durum: tüm servislerin lambaları + otorite/PR/luck modu. */
    public function status(): array
    {
        $data = Cache::remember('admin:services-status', now()->addSeconds(10), function () {
            return [
                'services' => [
                    $this->checkValidator(),
                    $this->checkGnubg(),
                    $this->checkDatabase(),
                    $this->checkQueue(),
                ],
                'validator_required' => (bool) config('validator.required', true),
            ];
        });

        return [
            'services' => $data['services'],
            'validator_required' => $data['validator_required'],
            'authoritative' => (bool) config('game.server_authoritative', false),
            'pr_mode' => (string) config('validator.pr_mode', 'off'),
            'gnubg_pr_mode' => (string) config('gnubg.pr_mode', 'off'),
        ];
    }

    /** Node validator (sunucu-otoriter maç hakemi): gerçek bir doğrulama isteğiyle canlılık. */
    private function checkValidator(): array
    {
        $validator = app(MoveValidatorService::class);
        if (! $validator->isConfigured()) {
            return $this->svc('validator', 'Sunucu Hakem (Validator)', false, null, 'Yapılandırılmamış', true);
        }
        try {
            $s = Backgammon::initialState();
            $s['dice'] = [3, 1];
            $s['diceUsed'] = [false, false];
            $r = $validator->validate($s, [
                ['from' => 5, 'to' => 2, 'die' => 3],
                ['from' => 2, 'to' => 1, 'die' => 1],
            ]);
            $up = (bool) ($r['valid'] ?? false) && empty($r['unreachable']);

            return $this->svc('validator', 'Sunucu Hakem (Validator)', true, $up, 'Hamle doğrulama servisi', true);
        } catch (\Throwable $e) {
            return $this->svc('validator', 'Sunucu Hakem (Validator)', true, false, 'İstisna: '.$e->getMessage(), true);
        }
    }

    /** gnubg analiz servisi (PR + native luck kaynağı): /health. */
    private function checkGnubg(): array
    {
        $url = (string) config('gnubg.url', '');
        if ($url === '') {
            return $this->svc('gnubg', 'gnubg Analiz Servisi', false, null, 'GNUBG_URL boş');
        }
        try {
            $up = app(GnuBgClient::class)->health();

            return $this->svc('gnubg', 'gnubg Analiz Servisi', true, $up, $url);
        } catch (\Throwable $e) {
            return $this->svc('gnubg', 'gnubg Analiz Servisi', true, false, 'İstisna: '.$e->getMessage());
        }
    }

    /** Veritabanı: basit "select 1". */
    private function checkDatabase(): array
    {
        try {
            DB::select('select 1');
            $name = (string) (config('database.connections.'.config('database.default').'.database') ?? '');

            return $this->svc('db', 'Veritabanı', true, true, $name !== '' ? $name : config('database.default'));
        } catch (\Throwable $e) {
            return $this->svc('db', 'Veritabanı', true, false, 'Bağlanılamadı');
        }
    }

    /**
     * Queue worker (shadow PR + gnubg luck işçisi). Doğrudan process kontrolü PHP'den mümkün değil;
     * PROXY: 'jobs' tablosunda bekleyen iş yaşı. Birikmiş (>90sn) iş = worker muhtemelen KAPALI.
     * Boşta (bekleyen 0) = ayırt edilemez -> "boşta" (gri). Taze iş var = çalışıyor (yeşil).
     */
    private function checkQueue(): array
    {
        try {
            $pending = (int) DB::table('jobs')->count();
            $failed = 0;
            try {
                $failed = (int) DB::table('failed_jobs')->count();
            } catch (\Throwable $e) {
                // failed_jobs yoksa yok say
            }
            if ($pending === 0) {
                $detail = 'Boşta (bekleyen iş yok'.($failed > 0 ? ", $failed başarısız" : '').')';

                return $this->svc('queue', 'Kuyruk İşçisi (queue worker)', true, null, $detail);
            }
            $oldest = DB::table('jobs')->min('available_at');
            $age = $oldest ? (time() - (int) $oldest) : 0;
            $up = $age < 90; // 90sn'den eski bekleyen iş -> worker kapalı sinyali
            $detail = "$pending iş bekliyor, en eski {$age}sn".($failed > 0 ? " · $failed başarısız" : '');
            if (! $up) {
                $detail .= ' — birikmiş (worker kapalı olabilir)';
            }

            return $this->svc('queue', 'Kuyruk İşçisi (queue worker)', true, $up, $detail);
        } catch (\Throwable $e) {
            return $this->svc('queue', 'Kuyruk İşçisi (queue worker)', true, false, 'jobs tablosu okunamadı');
        }
    }

    /** Servis satırı: up=true yeşil, false kırmızı, null gri (boşta/yapılandırılmamış). */
    private function svc(string $key, string $name, bool $configured, ?bool $up, string $detail, bool $restart = false): array
    {
        return compact('key', 'name', 'configured', 'up', 'detail', 'restart');
    }

    /** "Yeniden Başlat" butonu -> validator'ı restart et (süreç exit -> Passenger canlandirir). */
    public function restart(): void
    {
        $r = app(MoveValidatorService::class)->restartValidator();
        Cache::forget('admin:services-status'); // durum yeniden ölçülsün
        Cache::forget('admin:validator-status');
        if (! empty($r['ok'])) {
            Notification::make()
                ->title('Validator yeniden başlatılıyor…')
                ->body('Süreç kapandı; birkaç saniye içinde otomatik canlanır. Durum yenilenecek.')
                ->success()
                ->send();
        } elseif (($r['error'] ?? '') === 'status-404') {
            Notification::make()
                ->title('Validator eski sürümde')
                ->body('Çalışıyor ama /restart ucu yok. Plesk → Node uygulaması → Restart App ile BİR KEZ elle yeniden başlatın (yeni kod yüklensin); sonra bu buton çalışır.')
                ->warning()
                ->persistent()
                ->send();
        } else {
            Notification::make()
                ->title('Yeniden başlatılamadı')
                ->body('Hata: '.($r['error'] ?? 'bilinmiyor').' — validator ayakta değilse önce Plesk\'ten başlatın.')
                ->danger()
                ->send();
        }
    }
}
