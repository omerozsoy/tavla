<?php

namespace App\Filament\Widgets;

use App\Services\MoveValidatorService;
use App\Support\Backgammon;
use Filament\Notifications\Notification;
use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Cache;

/**
 * Servis durumu paneli (admin dashboard): sunucu-otoriter maçların "hakemi" olan Node validator
 * ayakta mı? YEŞİL lamba = çalışıyor, KIRMIZI = erişilemiyor. Ayrıca sunucu-otorite + PR modu.
 * "Yeniden Başlat" butonu validator'ı restart eder (süreç kendini kapatır; Plesk/Passenger
 * bir sonraki istekte canlandirir). Kontrol validatorCheck ile aynı; ~10sn cache + 30sn poll.
 */
class ServiceStatus extends Widget
{
    protected static string $view = 'filament.widgets.service-status';

    protected static ?int $sort = -4; // en üstte

    protected int|string|array $columnSpan = 'full';

    protected static ?string $pollingInterval = '30s'; // lamba otomatik tazelensin

    /** Blade'in okuduğu durum: validator (lamp), sunucu-otorite, PR modu. */
    public function status(): array
    {
        $v = Cache::remember('admin:validator-status', now()->addSeconds(10), function () {
            $validator = app(MoveValidatorService::class);
            $required = (bool) config('validator.required', true);
            if (! $validator->isConfigured()) {
                return ['configured' => false, 'up' => false, 'required' => $required];
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

                return ['configured' => true, 'up' => $up, 'required' => $required];
            } catch (\Throwable $e) {
                return ['configured' => true, 'up' => false, 'required' => $required];
            }
        });

        return [
            'validator' => $v,
            'authoritative' => (bool) config('game.server_authoritative', false),
            'pr_mode' => (string) config('validator.pr_mode', 'off'),
        ];
    }

    /** "Yeniden Başlat" butonu -> validator'ı restart et (süreç exit -> Passenger canlandirir). */
    public function restart(): void
    {
        $r = app(MoveValidatorService::class)->restartValidator();
        Cache::forget('admin:validator-status'); // durum yeniden ölçülsün
        if (! empty($r['ok'])) {
            Notification::make()
                ->title('Validator yeniden başlatılıyor…')
                ->body('Süreç kapandı; birkaç saniye içinde otomatik canlanır. Durum yenilenecek.')
                ->success()
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
